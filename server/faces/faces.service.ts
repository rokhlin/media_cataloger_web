import { Injectable, NotFoundException, BadRequestException, Inject, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfigService } from '../config/config.service.js';
import { DatabaseService } from '../database/database.service.js';
import { FamilyTreePublicService } from '../family-tree/family-tree-public.service.js';

@Injectable()
export class FacesService {
  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Optional() @Inject(FamilyTreePublicService) private readonly familyTreePublicService?: FamilyTreePublicService,
  ) {}

  get catalogerApiUrl(): string {
    return this.config.catalogerApiUrl.replace(/\/+$/, '');
  }

  get facesFolder(): string {
    return this.config.facesFolder || (this.config.outputFolder ? path.join(this.config.outputFolder, 'facess') : '');
  }

  get outputFolder(): string {
    return this.config.outputFolder || '';
  }

  getAllRegisteredFaces() {
    this.db.initDb();
    return this.db.getAllRegisteredFaces();
  }

  getKnownPersons() {
    this.db.initDb();
    const persons = this.db.getKnownPersons();

    if (this.familyTreePublicService) {
      for (const p of persons) {
        try {
          const ctx = this.familyTreePublicService.getPersonContext({ name: p.name, mediaPersonId: p.person_id });
          if (ctx.found) {
            p.family_tree = {
              is_in_tree: true,
              tree_person_id: ctx.treePersonId,
              kinship_to_root: ctx.kinshipToRoot?.primaryTerm || null,
              category: ctx.kinshipToRoot?.category || null,
              birth_year: ctx.birthYear || null,
              is_living: ctx.isLiving,
              recent_milestones: ctx.recentMilestones || [],
            };
          } else {
            p.family_tree = {
              is_in_tree: false,
            };
          }
        } catch {
          p.family_tree = { is_in_tree: false };
        }
      }
    }

    return persons;
  }

  getUnrecognizedFaces() {
    this.db.initDb();
    return this.db.getUnrecognizedFaces();
  }

  getUnrecognizedGroups(threshold?: number) {
    this.db.initDb();
    return this.db.getUnrecognizedFaceGroups(threshold || 0.65);
  }

  getFaceImagePath(filename: string): string {
    const trimmed = filename.trim();
    if (!trimmed) {
      throw new NotFoundException('Face image parameter is empty');
    }

    // Direct existing path check
    if (fs.existsSync(trimmed)) {
      try {
        if (fs.statSync(trimmed).isFile()) return trimmed;
      } catch {
        // ignore
      }
    }

    this.db.initDb();
    const safeName = path.basename(trimmed);
    const targetNames = new Set<string>([safeName, trimmed]);

    // Check if filename is a registered face_id in database
    try {
      const regFace = this.db.getDb().prepare(`
        SELECT image_path FROM face_registry WHERE face_id = ? OR face_id = ?
        UNION
        SELECT image_path FROM media_faces WHERE face_id = ? OR face_id = ?
        LIMIT 1
      `).get(trimmed, safeName, trimmed, safeName) as any;

      if (regFace?.image_path) {
        targetNames.add(regFace.image_path);
        targetNames.add(path.basename(regFace.image_path));
      }
    } catch {
      // ignore
    }

    // Add extensions and normalized names
    const rawBase = safeName.replace(/\.(jpg|jpeg|png|webp|bmp)+$/gi, '');
    targetNames.add(rawBase);
    const exts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.jpg.jpg'];
    const baseTargets = Array.from(targetNames);
    for (const t of baseTargets) {
      for (const e of exts) {
        targetNames.add(`${t}${e}`);
        targetNames.add(`${path.basename(t, path.extname(t))}${e}`);
      }
    }

    const searchDirs: string[] = [
      this.config.facesFolder,
      this.config.outputFolder ? path.join(this.config.outputFolder, 'faces') : '',
      this.config.outputFolder ? path.join(this.config.outputFolder, 'facess') : '',
      this.config.outputFolder ? path.join(this.config.outputFolder, 'crops') : '',
      this.config.outputFolder || '',
      this.config.projectRoot ? path.join(this.config.projectRoot, 'media_output', 'faces') : '',
      this.config.projectRoot ? path.join(this.config.projectRoot, 'media_output', 'facess') : '',
      this.config.projectRoot ? path.join(this.config.projectRoot, 'media_output', 'crops') : '',
      this.config.projectRoot ? path.join(this.config.projectRoot, 'media_output') : '',
    ].filter(Boolean);

    if (Array.isArray(this.config.inputFolders)) {
      for (const folder of this.config.inputFolders) {
        if (folder) {
          searchDirs.push(path.join(folder, 'faces'));
          searchDirs.push(path.join(folder, 'facess'));
          searchDirs.push(folder);
        }
      }
    }

    for (const dir of searchDirs) {
      if (!dir) continue;
      for (const tName of targetNames) {
        const candidate = path.isAbsolute(tName) ? tName : path.join(dir, tName);
        if (fs.existsSync(candidate)) {
          try {
            if (fs.statSync(candidate).isFile()) {
              return candidate;
            }
          } catch {
            // ignore
          }
        }
      }
    }

    throw new NotFoundException(`Face image '${filename}' not found`);
  }

  renameFace(faceId: string, name: string) {
    this.db.initDb();
    const mapping = this.db.getFaceNameMapping();
    if (!mapping[faceId]) {
      throw new NotFoundException(`Face ID '${faceId}' not found in registry.`);
    }
    this.db.updateFaceName(faceId, name.trim());
    return {
      status: 'success',
      message: `Face '${faceId}' renamed to '${name.trim()}'.`,
    };
  }

  assignFace(faceId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Person name cannot be empty.');

    this.db.initDb();
    const mapping = this.db.getFaceNameMapping();
    if (!mapping[faceId]) {
      throw new NotFoundException(`Face ID '${faceId}' not found in registry.`);
    }

    this.db.assignFaceToPerson(faceId, trimmed);
    return {
      status: 'success',
      message: `Face '${faceId}' successfully assigned to '${trimmed}' as a reference face.`,
    };
  }

  assignGroup(faceIds: string[], name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Person name cannot be empty.');
    if (!faceIds || faceIds.length === 0) throw new BadRequestException('List of face IDs cannot be empty.');

    this.db.initDb();
    this.db.assignGroupToPerson(faceIds, trimmed);
    return {
      status: 'success',
      message: `Successfully assigned ${faceIds.length} face(s) to '${trimmed}'.`,
    };
  }

  resetFace(faceId: string) {
    this.db.initDb();
    const mapping = this.db.getFaceNameMapping();
    if (!mapping[faceId]) {
      throw new NotFoundException(`Face ID '${faceId}' not found in registry.`);
    }
    this.db.resetFaceAssignment(faceId);
    return {
      status: 'success',
      message: `Face '${faceId}' assignment reset to unassigned.`,
    };
  }

  resetFacesByFilename(filename: string) {
    const trimmed = filename.trim();
    if (!trimmed) throw new BadRequestException('Filename parameter cannot be empty.');

    this.db.initDb();
    const result = this.db.resetFaceAssignmentsByFilename(trimmed);
    return {
      status: 'success',
      message: `Reset ${result.reset_count} face assignment(s) for file '${trimmed}'.`,
      reset_count: result.reset_count,
      face_ids: result.face_ids,
    };
  }

  deleteFace(faceId: string) {
    if (!faceId || !faceId.trim()) {
      throw new BadRequestException('Face ID cannot be empty');
    }
    this.db.initDb();
    const cleanId = faceId.trim();

    // 1. Gather associated source files and image paths before deleting from DB
    const db = this.db.getDb();
    let rows: any[] = [];
    try {
      rows = db.prepare(`
        SELECT face_id, image_path, source_file FROM face_registry WHERE face_id = ?
        UNION
        SELECT face_id, image_path, source_file FROM media_faces WHERE face_id = ?
      `).all(cleanId, cleanId);
    } catch {
      // ignore
    }

    const mapping = this.db.getFaceNameMapping();
    if (!mapping[cleanId] && rows.length === 0) {
      throw new NotFoundException(`Face ID '${faceId}' not found in registry.`);
    }

    // 2. Delete physical face crop files from disk
    const targetCropNames = new Set<string>([
      cleanId,
      `${cleanId}.jpg`,
      `${cleanId}.jpeg`,
      `${cleanId}.png`,
      `${cleanId}.jpg.jpg`,
    ]);
    for (const r of rows) {
      if (r.image_path) {
        targetCropNames.add(r.image_path);
        targetCropNames.add(path.basename(r.image_path));
      }
    }

    const searchDirs: string[] = [
      this.facesFolder,
      this.config.facesFolder,
      this.outputFolder ? path.join(this.outputFolder, 'faces') : '',
      this.outputFolder ? path.join(this.outputFolder, 'facess') : '',
      this.outputFolder ? path.join(this.outputFolder, 'crops') : '',
      this.outputFolder,
      this.config.projectRoot ? path.join(this.config.projectRoot, 'media_output', 'faces') : '',
      this.config.projectRoot ? path.join(this.config.projectRoot, 'media_output', 'facess') : '',
      this.config.projectRoot ? path.join(this.config.projectRoot, 'media_output') : '',
    ].filter(Boolean);

    for (const dir of searchDirs) {
      for (const tName of targetCropNames) {
        const candidate = path.isAbsolute(tName) ? tName : path.join(dir, tName);
        try {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            fs.unlinkSync(candidate);
          }
        } catch {
          // ignore
        }
      }
    }

    // 3. Remove face from sidecar JSON files if source files exist
    const sourceFiles = new Set<string>();
    for (const r of rows) {
      if (r.source_file) sourceFiles.add(r.source_file);
    }

    for (const srcFile of sourceFiles) {
      const baseName = path.basename(srcFile);
      const possibleSidecars = [
        path.join(this.outputFolder, `${baseName}.json`),
        path.join(path.dirname(srcFile), `${baseName}.json`),
        path.join(this.outputFolder, `${srcFile}.json`),
      ];
      for (const scPath of possibleSidecars) {
        try {
          if (fs.existsSync(scPath)) {
            const raw = fs.readFileSync(scPath, 'utf-8');
            const sdata = JSON.parse(raw);
            let modified = false;

            if (Array.isArray(sdata.faces)) {
              const origLen = sdata.faces.length;
              sdata.faces = sdata.faces.filter((f: any) => {
                const fid = typeof f === 'string' ? f : (f.face_id || f.id);
                return fid !== cleanId;
              });
              if (sdata.faces.length !== origLen) modified = true;
            }

            if (Array.isArray(sdata.detected_faces)) {
              const origLen = sdata.detected_faces.length;
              sdata.detected_faces = sdata.detected_faces.filter((f: any) => {
                const fid = typeof f === 'string' ? f : (f.face_id || f.id);
                return fid !== cleanId;
              });
              if (sdata.detected_faces.length !== origLen) modified = true;
            }

            if (sdata.gemini_analysis && Array.isArray(sdata.gemini_analysis.faces)) {
              const origLen = sdata.gemini_analysis.faces.length;
              sdata.gemini_analysis.faces = sdata.gemini_analysis.faces.filter((f: any) => {
                const fid = typeof f === 'string' ? f : (f.face_id || f.id);
                return fid !== cleanId;
              });
              if (sdata.gemini_analysis.faces.length !== origLen) modified = true;
            }

            if (modified) {
              fs.writeFileSync(scPath, JSON.stringify(sdata, null, 2), 'utf-8');
            }
          }
        } catch {
          // ignore
        }
      }
    }

    // 4. Delete from SQLite database
    this.db.deleteFace(cleanId);

    return {
      status: 'success',
      message: `Face '${cleanId}' and associated assets deleted successfully.`,
    };
  }

  deleteFacesBatch(faceIds: string[]) {
    if (!Array.isArray(faceIds) || faceIds.length === 0) {
      throw new BadRequestException('face_ids array cannot be empty');
    }
    let count = 0;
    for (const fid of faceIds) {
      if (fid && fid.trim()) {
        try {
          this.deleteFace(fid.trim());
          count++;
        } catch {
          // ignore
        }
      }
    }
    return {
      status: 'success',
      message: `Successfully deleted ${count} face(s) and associated assets.`,
      deleted_count: count,
    };
  }

  async rejectAssignment(faceId: string, name?: string, filePath?: string) {
    if (!faceId) {
      throw new BadRequestException('face_id is required');
    }
    const cleanId = faceId.trim();
    this.db.rejectFaceAssignment(cleanId, name, filePath);

    // Update sidecar if filePath is known
    if (filePath) {
      const baseName = path.basename(filePath);
      const possibleSidecars = [
        path.join(this.outputFolder, `${baseName}.json`),
        path.join(path.dirname(filePath), `${baseName}.json`),
        path.join(this.outputFolder, `${filePath}.json`),
      ];
      for (const sc of possibleSidecars) {
        try {
          if (fs.existsSync(sc)) {
            const raw = fs.readFileSync(sc, 'utf-8');
            const data = JSON.parse(raw);
            let modified = false;
            for (const key of ['faces', 'detected_faces']) {
              if (Array.isArray(data[key])) {
                for (const f of data[key]) {
                  const fid = typeof f === 'string' ? f : (f.face_id || f.id);
                  if (fid === cleanId) {
                    f.name = '';
                    f.person_id = null;
                    modified = true;
                  }
                }
              }
            }
            if (modified) {
              fs.writeFileSync(sc, JSON.stringify(data, null, 2), 'utf-8');
            }
          }
        } catch {}
      }
    }

    return {
      status: 'success',
      message: `Face '${cleanId}' disassociated from person '${name || ''}'.`,
    };
  }

  async resetPrimary(personId?: string, name?: string) {
    if (!personId && !name) {
      throw new BadRequestException('person_id or name is required');
    }
    this.db.resetPrimaryFace(personId, name);
    return {
      status: 'success',
      message: `Primary photo reset to default silhouette for ${name || personId}.`,
    };
  }

  async setPrimary(personId?: string, name?: string, faceId?: string) {
    if (!faceId) {
      throw new BadRequestException('face_id is required');
    }
    const targetName = (name || personId || '').trim();
    if (!targetName) {
      throw new BadRequestException('Person name or ID is required');
    }
    this.db.setPrimaryFace(personId || targetName, targetName, faceId);
    return {
      status: 'success',
      message: `Set face ${faceId} as primary avatar for ${targetName}.`,
    };
  }

  async manualCrop(dto: {
    name: string;
    file_path?: string;
    image_base64?: string;
    box?: number[];
    set_primary?: boolean;
  }) {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Person name is required');
    }
    const personName = dto.name.trim();
    const faceId = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const facesFolder = this.facesFolder || (this.outputFolder ? path.join(this.outputFolder, 'facess') : path.join(process.cwd(), 'data', 'faces'));
    if (!fs.existsSync(facesFolder)) {
      fs.mkdirSync(facesFolder, { recursive: true });
    }
    const faceFilename = `${faceId}.jpg`;
    const targetPath = path.join(facesFolder, faceFilename);

    let cropBuffer: Buffer | null = null;

    if (dto.image_base64 && dto.image_base64.trim()) {
      const base64Data = dto.image_base64.replace(/^data:image\/\w+;base64,/, '');
      cropBuffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(targetPath, cropBuffer);
    } else if (dto.file_path && fs.existsSync(dto.file_path)) {
      try {
        const sharpModule = await import('sharp');
        const sharp = sharpModule.default;
        const img = sharp(dto.file_path);
        const meta = await img.metadata();
        const width = meta.width || 800;
        const height = meta.height || 600;

        if (Array.isArray(dto.box) && dto.box.length === 4) {
          const [ymin, xmin, ymax, xmax] = dto.box;
          const left = Math.max(0, Math.round(xmin * width));
          const top = Math.max(0, Math.round(ymin * height));
          const extractWidth = Math.min(width - left, Math.round((xmax - xmin) * width));
          const extractHeight = Math.min(height - top, Math.round((ymax - ymin) * height));
          cropBuffer = await img.extract({ left, top, width: extractWidth, height: extractHeight }).jpeg().toBuffer();
        } else {
          cropBuffer = await img.resize(300, 300, { fit: 'cover' }).jpeg().toBuffer();
        }
        fs.writeFileSync(targetPath, cropBuffer);
      } catch (err: any) {
        throw new BadRequestException(`Failed to crop face from file: ${err.message}`);
      }
    } else {
      throw new BadRequestException('Either image_base64 or a valid file_path must be provided');
    }

    const saved = this.db.saveManualCropFace(
      faceId,
      personName,
      cropBuffer,
      dto.file_path,
      dto.set_primary !== false
    );

    return {
      status: 'success',
      face: {
        face_id: faceId,
        name: personName,
        image_path: faceFilename,
        image_url: `/api/faces/image/${faceFilename}`,
        is_reference: dto.set_primary !== false,
      },
      ...saved,
    };
  }
}
