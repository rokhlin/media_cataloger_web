import { Injectable, NotFoundException, BadRequestException, Logger, Inject, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfigService } from '../config/config.service.js';
import { DatabaseService } from '../database/database.service.js';
import { FamilyTreePublicService } from '../family-tree/family-tree-public.service.js';

export interface ScannedMediaFile {
  filePath: string;
  folder: string;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Optional() @Inject(FamilyTreePublicService) private readonly familyTreePublicService?: FamilyTreePublicService,
  ) {}

  scanInputFolders(): ScannedMediaFile[] {
    const results: ScannedMediaFile[] = [];
    const supported = new Set([...this.config.supportedPhotoExts, ...this.config.supportedVideoExts]);

    const traverse = (dir: string, baseFolder: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            // Ignore hidden directories or outputs
            if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') {
              continue;
            }
            traverse(fullPath, baseFolder);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (supported.has(ext)) {
              results.push({ filePath: fullPath, folder: baseFolder });
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Failed reading directory ${dir}: ${err}`);
      }
    };

    for (const folder of this.config.inputFolders) {
      let scanTarget = folder;
      if (!fs.existsSync(scanTarget)) {
        // If in Docker container with Windows UNC / drive path, fallback to mounted container media_input
        const cand1 = path.resolve(this.config.projectRoot, 'media_input');
        const cand2 = '/app/media_input';
        if (fs.existsSync(cand1) && fs.statSync(cand1).isDirectory()) {
          scanTarget = cand1;
        } else if (fs.existsSync(cand2) && fs.statSync(cand2).isDirectory()) {
          scanTarget = cand2;
        }
      }

      if (fs.existsSync(scanTarget)) {
        traverse(scanTarget, folder);
      }
    }

    return results;
  }

  async listMediaFiles() {
    this.db.initDb();
    const scanned = this.scanInputFolders();
    const syncRecords = this.db.getAllSyncRecords();
    const faceCounts = this.db.getFacesCountBySourceFile();
    const allFacesByFile = this.db.getAllFacesBySourceFile();
    const dbMetadata = this.db.getAllMediaMetadata();

    // Secondary index by basename
    const baseFaceCounts: Record<string, number> = {};
    for (const [srcFile, count] of Object.entries(faceCounts)) {
      const bn = path.basename(srcFile).toLowerCase();
      baseFaceCounts[bn] = (baseFaceCounts[bn] || 0) + count;
    }

    const baseFaces: Record<string, any[]> = {};
    for (const [srcFile, fList] of Object.entries(allFacesByFile)) {
      const bn = path.basename(srcFile).toLowerCase();
      if (!baseFaces[bn]) baseFaces[bn] = [];
      baseFaces[bn].push(...fList);
    }

    const items: any[] = [];
    for (const { filePath, folder } of scanned) {
      let size = 0;
      let mtime = 0;
      try {
        const stat = fs.statSync(filePath);
        size = stat.size;
        mtime = stat.mtimeMs / 1000;
      } catch {
        // file unreadable
      }

      const baseName = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const isVideo = this.config.supportedVideoExts.has(ext);
      const isImage = this.config.supportedPhotoExts.has(ext);

      let syncRec = syncRecords[filePath];
      if (!syncRec) {
        for (const [k, v] of Object.entries(syncRecords)) {
          if (path.basename(k).toLowerCase() === baseName.toLowerCase()) {
            syncRec = v;
            break;
          }
        }
      }

      let fileFacesRaw = allFacesByFile[filePath];
      if (!fileFacesRaw) {
        fileFacesRaw = baseFaces[baseName.toLowerCase()] || [];
      }

      const seenFids = new Set<string>();
      const dedupFaces: any[] = [];
      const faceNames: string[] = [];
      let hasUnassigned = false;

      for (const f of fileFacesRaw) {
        const fid = f.face_id;
        if (fid && seenFids.has(fid)) continue;
        if (fid) seenFids.add(fid);
        dedupFaces.push(f);
        const fname = f.name;
        if (fname && !faceNames.includes(fname)) {
          faceNames.push(fname);
        }
        if (!f.is_reference || (fname && fname.startsWith('face_'))) {
          hasUnassigned = true;
        }
      }

      const fc = dedupFaces.length > 0 ? dedupFaces.length : (faceCounts[filePath] || baseFaceCounts[baseName.toLowerCase()] || 0);
      const status = syncRec ? syncRec.status : 'UNPROCESSED';
      const sidecar = syncRec ? syncRec.sidecar_path : null;

      let desc: string | null = null;
      let descRu: string | null = null;
      let summ: string | null = null;
      let summRu: string | null = null;
      let environment: string | null = null;
      let lighting: string | null = null;
      let lightingRu: string | null = null;
      let weather: string | null = null;
      let weatherRu: string | null = null;
      let timeOfDay: string | null = null;
      let timeOfDayRu: string | null = null;
      let ocrText: string | null = null;
      let exifAnalysis: string | null = null;
      let exifAnalysisRu: string | null = null;
      let transcription: string | null = null;
      let transcriptionRu: string | null = null;
      let timelineEvents: any = null;

      const m = dbMetadata[filePath] || dbMetadata[baseName.toLowerCase()];
      if (m) {
        desc = m.description || null;
        descRu = m.description_ru || null;
        summ = m.summary || null;
        summRu = m.summary_ru || null;
        environment = m.environment || null;
        lighting = m.lighting || null;
        lightingRu = m.lighting_ru || null;
        weather = m.weather || null;
        weatherRu = m.weather_ru || null;
        timeOfDay = m.time_of_day || null;
        timeOfDayRu = m.time_of_day_ru || null;
        ocrText = m.ocr_text || null;
        exifAnalysis = m.exif_analysis || null;
        exifAnalysisRu = m.exif_analysis_ru || null;
        transcription = m.transcription || null;
        transcriptionRu = m.transcription_ru || null;
        timelineEvents = m.timeline_events || null;
      }

      // Sidecar file on disk fallback
      if (!desc && !descRu && !summ && !summRu && sidecar) {
        let sidecarFile = path.resolve(sidecar);
        if (!fs.existsSync(sidecarFile)) {
          sidecarFile = path.resolve(this.config.outputFolder, path.basename(sidecar));
        }
        if (fs.existsSync(sidecarFile)) {
          try {
            const raw = fs.readFileSync(sidecarFile, 'utf-8');
            const sdata = JSON.parse(raw);
            const ga = sdata.gemini_analysis || {};
            desc = ga.description || sdata.description || null;
            descRu = ga.description_ru || sdata.description_ru || null;
            summ = ga.summary || sdata.summary || null;
            summRu = ga.summary_ru || sdata.summary_ru || null;
            environment = ga.environment || null;
            lighting = ga.lighting || null;
            lightingRu = ga.lighting_ru || null;
            weather = ga.weather || null;
            weatherRu = ga.weather_ru || null;
            timeOfDay = ga.time_of_day || null;
            timeOfDayRu = ga.time_of_day_ru || null;
            ocrText = ga.ocr_text || null;
            exifAnalysis = ga.exif_analysis || null;
            exifAnalysisRu = ga.exif_analysis_ru || null;
            transcription = ga.transcription || null;
            transcriptionRu = ga.transcription_ru || null;
            timelineEvents = ga.timeline_events || null;
          } catch {
            // ignore
          }
        }
      }

      const item: any = {
        file_path: filePath,
        filename: baseName,
        folder: folder,
        file_size: size,
        mtime: mtime,
        is_video: isVideo,
        is_image: isImage,
        status: status,
        sidecar_path: sidecar,
        description: desc,
        description_ru: descRu,
        summary: summ,
        summary_ru: summRu,
        environment: environment,
        lighting: lighting,
        lighting_ru: lightingRu,
        weather: weather,
        weather_ru: weatherRu,
        time_of_day: timeOfDay,
        time_of_day_ru: timeOfDayRu,
        ocr_text: ocrText,
        exif_analysis: exifAnalysis,
        exif_analysis_ru: exifAnalysisRu,
        transcription: transcription,
        transcription_ru: transcriptionRu,
        timeline_events: timelineEvents,
        face_count: fc,
        faces: dedupFaces,
        face_names: faceNames,
        has_unassigned_faces: hasUnassigned,
        error_message: syncRec ? syncRec.error_message : null,
      };

      // Enrich with family context if face names are recognized
      if (this.familyTreePublicService && faceNames.length > 0) {
        try {
          const photoKinship = this.familyTreePublicService.analyzePhotoKinship({
            person_names: faceNames,
            media_file_path: filePath,
          });

          if (photoKinship.identifiedPersons.length > 0) {
            item.family_context = {
              suggested_caption: photoKinship.suggestedCaption,
              summary_description: photoKinship.summaryDescription,
              identified_members: photoKinship.identifiedPersons.map((p) => ({
                name: p.name,
                tree_person_id: p.treePersonId,
                kinship: p.kinshipToRoot?.primaryTerm || null,
                category: p.kinshipToRoot?.category || null,
              })),
              relationships: photoKinship.relationships.map((r) => ({
                person_a: r.personA,
                person_b: r.personB,
                kinship: r.kinshipAtoB,
              })),
              milestones: photoKinship.contextualMilestones,
            };

            // If no AI description exists, use the rich family kinship caption
            if (!item.description && photoKinship.suggestedCaption) {
              item.enriched_family_caption = photoKinship.suggestedCaption;
            }
          }
        } catch {
          // ignore family context enrichment failures
        }
      }

      items.push(item);
    }

    return {
      total_files: items.length,
      files: items,
    };
  }

  resolveMediaFilePath(target: string): string {
    const trimmed = target.trim();
    const targetPath = path.resolve(trimmed);

    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
      return targetPath;
    }

    const baseName = path.basename(trimmed);
    for (const folder of this.config.inputFolders) {
      const cand1 = path.join(folder, trimmed);
      if (fs.existsSync(cand1) && fs.statSync(cand1).isFile()) return cand1;
      const cand2 = path.join(folder, baseName);
      if (fs.existsSync(cand2) && fs.statSync(cand2).isFile()) return cand2;
    }

    const candOut1 = path.join(this.config.outputFolder, trimmed);
    if (fs.existsSync(candOut1) && fs.statSync(candOut1).isFile()) return candOut1;
    const candOut2 = path.join(this.config.outputFolder, baseName);
    if (fs.existsSync(candOut2) && fs.statSync(candOut2).isFile()) return candOut2;

    const scanned = this.scanInputFolders();
    for (const s of scanned) {
      if (path.basename(s.filePath).toLowerCase() === baseName.toLowerCase() || s.filePath.toLowerCase() === trimmed.toLowerCase()) {
        return s.filePath;
      }
    }

    throw new NotFoundException(`Media file '${trimmed}' not found`);
  }

  getMediaSidecar(target: string): any {
    const trimmed = target.trim();
    const baseName = path.basename(trimmed);
    let sidecarPath: string | null = null;

    this.db.initDb();
    let syncRec = this.db.getSyncRecord(trimmed);
    if (!syncRec) {
      const syncs = this.db.getAllSyncRecords();
      for (const [k, v] of Object.entries(syncs)) {
        if (path.basename(k).toLowerCase() === baseName.toLowerCase()) {
          syncRec = v;
          break;
        }
      }
    }

    if (syncRec && syncRec.sidecar_path) {
      const cand = path.resolve(syncRec.sidecar_path);
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        sidecarPath = cand;
      } else {
        const alt = path.join(this.config.outputFolder, path.basename(cand));
        if (fs.existsSync(alt) && fs.statSync(alt).isFile()) {
          sidecarPath = alt;
        }
      }
    }

    if (!sidecarPath) {
      const cand = path.join(this.config.outputFolder, `${baseName}.json`);
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        sidecarPath = cand;
      }
    }

    if (!sidecarPath || !fs.existsSync(sidecarPath)) {
      throw new NotFoundException(`Sidecar metadata not found for '${trimmed}'`);
    }

    try {
      const raw = fs.readFileSync(sidecarPath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      throw new BadRequestException(`Failed to read sidecar file: ${err}`);
    }
  }

  getFacesForFile(file: string) {
    if (!file || !file.trim()) {
      throw new BadRequestException('File parameter cannot be empty');
    }
    this.db.initDb();
    return this.db.getFacesBySourceFile(file.trim());
  }

  addPersonToFile(file: string, name: string) {
    if (!file || !file.trim()) throw new BadRequestException('File parameter cannot be empty');
    if (!name || !name.trim()) throw new BadRequestException('Person name cannot be empty');

    this.db.initDb();
    const res = this.db.addPersonToMediaFile(file.trim(), name.trim());
    return {
      status: 'success',
      message: `Person '${name.trim()}' successfully linked to file.`,
      data: res,
    };
  }

  removeFaceFromFile(file: string, faceId: string) {
    if (!file || !file.trim()) throw new BadRequestException('File parameter cannot be empty');
    if (!faceId || !faceId.trim()) throw new BadRequestException('Face ID cannot be empty');

    this.db.initDb();
    this.db.removeFaceFromMediaFile(file.trim(), faceId.trim());
    return {
      status: 'success',
      message: `Face/Person '${faceId.trim()}' removed from file.`,
    };
  }
}
