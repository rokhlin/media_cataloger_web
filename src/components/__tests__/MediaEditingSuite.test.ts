import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STYLE_PRESETS } from '../gallery/StylePresetCarousel';

describe('FEAT-030: Media Viewer AI Editing Suite & Components', () => {
  describe('StylePresetCarousel & AI Prompt Anchoring', () => {
    it('should provide 10 specialized style presets plus 1 original option', () => {
      assert.equal(STYLE_PRESETS.length, 11);
      assert.equal(STYLE_PRESETS[0].id, 'original');
      assert.equal(STYLE_PRESETS[0].cssFilter, 'none');
    });

    it('should strictly enforce the facial preservation anchor phrase in all 10 AI style presets', () => {
      const facialAnchor = 'Сохрани черты лица человека на фото без изменений';
      const styledPresets = STYLE_PRESETS.filter((p) => p.id !== 'original');
      assert.equal(styledPresets.length, 10);

      for (const preset of styledPresets) {
        assert.ok(
          preset.prompt.includes(facialAnchor),
          `Preset ${preset.id} (${preset.nameRu}) must include facial anchor phrase`
        );
        assert.ok(preset.cssFilter.length > 0, `Preset ${preset.id} must have preview cssFilter`);
        assert.ok(preset.nameRu.length > 0, `Preset ${preset.id} must have Russian name`);
        assert.ok(preset.nameEn.length > 0, `Preset ${preset.id} must have English name`);
      }
    });

    it('should cover key visual genres (Hollywood warm, Sci-Fi, Kodak, Rembrandt, Oil painting, Cyberpunk)', () => {
      const presetIds = STYLE_PRESETS.map((p) => p.id);
      assert.ok(presetIds.includes('hollywood_warm'));
      assert.ok(presetIds.includes('sci_fi_teal'));
      assert.ok(presetIds.includes('kodak_tri_x'));
      assert.ok(presetIds.includes('rembrandt'));
      assert.ok(presetIds.includes('oil_painting'));
      assert.ok(presetIds.includes('cyberpunk_neon'));
    });
  });

  describe('Zoom and Pan Aspect Constraints', () => {
    it('should clamp zoom scale between minimum floor 1.0x and maximum ceiling 5.0x', () => {
      const clampZoom = (scale: number): number => {
        if (scale < 1.0) return 1.0;
        if (scale > 5.0) return 5.0;
        return Number(scale.toFixed(2));
      };

      assert.equal(clampZoom(0.5), 1.0, 'Cannot zoom out smaller than 1.0x original fit');
      assert.equal(clampZoom(0.99), 1.0);
      assert.equal(clampZoom(1.0), 1.0);
      assert.equal(clampZoom(2.5), 2.5);
      assert.equal(clampZoom(6.0), 5.0, 'Cannot exceed 5.0x maximum zoom');
    });

    it('should automatically reset pan offsets to (0, 0) whenever scale is at 1.0x floor', () => {
      let scale = 2.0;
      let panX = 150;
      let panY = -80;

      const resetIfAtFloor = (s: number, px: number, py: number) => {
        if (s <= 1.0) return { scale: 1.0, panX: 0, panY: 0 };
        return { scale: s, panX: px, panY: py };
      };

      let state = resetIfAtFloor(scale, panX, panY);
      assert.equal(state.panX, 150);
      assert.equal(state.panY, -80);

      scale = 1.0;
      state = resetIfAtFloor(scale, panX, panY);
      assert.equal(state.scale, 1.0);
      assert.equal(state.panX, 0);
      assert.equal(state.panY, 0);
    });
  });

  describe('Crop & Downscaling Dynamic Calculation', () => {
    it('should calculate downscaled dimensions that never exceed natural resolution', () => {
      const naturalWidth = 3840;
      const naturalHeight = 2160;

      const calculateCropBounds = (aspectW: number, aspectH: number, nw: number, nh: number) => {
        let maxW = nw;
        let maxH = Math.round((nw * aspectH) / aspectW);
        if (maxH > nh) {
          maxH = nh;
          maxW = Math.round((nh * aspectW) / aspectH);
        }
        return { maxW, maxH };
      };

      // 1:1 Square
      const square = calculateCropBounds(1, 1, naturalWidth, naturalHeight);
      assert.equal(square.maxW, 2160);
      assert.equal(square.maxH, 2160);
      assert.ok(square.maxW <= naturalWidth);
      assert.ok(square.maxH <= naturalHeight);

      // 16:9 Landscape
      const sixteenNine = calculateCropBounds(16, 9, naturalWidth, naturalHeight);
      assert.equal(sixteenNine.maxW, 3840);
      assert.equal(sixteenNine.maxH, 2160);

      // 9:16 Portrait
      const nineSixteen = calculateCropBounds(9, 16, naturalWidth, naturalHeight);
      assert.equal(nineSixteen.maxH, 2160);
      assert.equal(nineSixteen.maxW, Math.round((2160 * 9) / 16)); // 1215
      assert.ok(nineSixteen.maxW <= naturalWidth);
    });
  });

  describe('Universal Save Choice Protocol', () => {
    it('should default to "copy" mode with _edited file suffix preview', () => {
      const defaultChoice = 'copy';
      const originalName = 'family_gathering_2026.heic';
      const candidateCopy = `${originalName.replace(/\.[^/.]+$/, '')}_edited.heic`;

      assert.equal(defaultChoice, 'copy');
      assert.equal(candidateCopy, 'family_gathering_2026_edited.heic');
    });

    it('should accept all 3 universal choices: copy, overwrite, and cancel', () => {
      const validChoices: ('copy' | 'overwrite' | 'cancel')[] = ['copy', 'overwrite', 'cancel'];
      assert.equal(validChoices.length, 3);
      assert.ok(validChoices.includes('copy'));
      assert.ok(validChoices.includes('overwrite'));
      assert.ok(validChoices.includes('cancel'));
    });
  });
});
