import { Injectable, NotFoundException, BadRequestException, Logger, Inject, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
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

  private cachedMediaList: any[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 30000; // 30 seconds cache TTL
  private sidecarCache: Map<string, { mtime: number; data: any }> = new Map();

  /**
   * Invalidate in-memory scan cache
   */
  invalidateCache(): void {
    this.cachedMediaList = null;
    this.cacheTimestamp = 0;
  }

  private get catalogerBaseUrl(): string {
    return this.config.catalogerApiUrl.replace(/\/+$/, '');
  }

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

  /**
   * Find candidate sidecar JSON file for a given media file path across output and input folders.
   */
  findSidecarFile(filePath: string, baseFolder?: string, sidecarHint?: string | null): string | null {
    const baseName = path.basename(filePath);
    const ext = path.extname(filePath);
    const stem = ext ? baseName.slice(0, -ext.length) : baseName;

    const candidates: string[] = [];

    if (sidecarHint && String(sidecarHint).trim()) {
      candidates.push(path.resolve(sidecarHint));
      candidates.push(path.join(this.config.outputFolder, path.basename(sidecarHint)));
    }

    // Direct output folder candidates
    candidates.push(path.join(this.config.outputFolder, `${baseName}.json`));
    candidates.push(path.join(this.config.outputFolder, `${stem}.json`));
    candidates.push(path.join(this.config.outputFolder, `${baseName}.info.json`));

    // Nested relative candidates in outputFolder
    if (baseFolder) {
      try {
        const rel = path.relative(baseFolder, filePath);
        if (rel && !rel.startsWith('..')) {
          candidates.push(path.join(this.config.outputFolder, `${rel}.json`));
          const relStem = ext ? rel.slice(0, -ext.length) : rel;
          candidates.push(path.join(this.config.outputFolder, `${relStem}.json`));
        }
      } catch {
        // ignore relative path errors
      }
    }

    // Adjacent candidates next to media file
    const dir = path.dirname(filePath);
    candidates.push(path.join(dir, `${baseName}.json`));
    candidates.push(path.join(dir, `${stem}.json`));
    candidates.push(path.join(dir, `${baseName}.info.json`));

    for (const cand of candidates) {
      try {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
          return cand;
        }
      } catch {
        // ignore stat errors
      }
    }

    return null;
  }

  private readParsedSidecar(resolvedSidecar: string): any | null {
    try {
      const stat = fs.statSync(resolvedSidecar);
      const cached = this.sidecarCache.get(resolvedSidecar);
      if (cached && cached.mtime === stat.mtimeMs) {
        return cached.data;
      }
      const raw = fs.readFileSync(resolvedSidecar, 'utf-8');
      const data = JSON.parse(raw);
      this.sidecarCache.set(resolvedSidecar, { mtime: stat.mtimeMs, data });
      return data;
    } catch {
      return null;
    }
  }

  async listMediaFiles(query?: {
    offset?: number | string;
    limit?: number | string;
    page?: number | string;
    search?: string;
    type?: 'all' | 'images' | 'videos';
    status?: 'all' | 'PROCESSED' | 'UNPROCESSED' | 'PENDING';
    face_filter?: 'all' | 'with_faces' | 'no_faces' | 'unassigned';
    person?: string;
    folder?: string;
    sort_by?: 'name' | 'date' | 'size' | 'status' | 'faces';
    sort_order?: 'asc' | 'desc';
    refresh?: boolean | string;
  }) {
    this.db.initDb();

    const isRefresh = query?.refresh === true || query?.refresh === 'true';
    const now = Date.now();

    // If cache is empty, expired, or refresh requested, re-scan and build full index
    if (!this.cachedMediaList || isRefresh || now - this.cacheTimestamp > this.CACHE_TTL_MS) {
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
        if (!fileFacesRaw || fileFacesRaw.length === 0) {
          fileFacesRaw = baseFaces[baseName.toLowerCase()] || [];
        }

        const seenFids = new Set<string>();
        const dedupFaces: any[] = [];
        const faceNames: string[] = [];
        let hasUnassigned = false;

        for (const f of fileFacesRaw) {
          const fid = f.face_id || f.id;
          if (fid && seenFids.has(fid)) continue;
          if (fid) seenFids.add(fid);
          dedupFaces.push(f);
          const fname = f.name || f.person_name;
          if (fname && !faceNames.includes(fname)) {
            faceNames.push(fname);
          }
          if (!f.is_reference || (fname && fname.startsWith('face_'))) {
            hasUnassigned = true;
          }
        }

        let status = syncRec ? syncRec.status : 'UNPROCESSED';
        let sidecar = syncRec ? syncRec.sidecar_path : null;

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
          if (m.timeline_events) {
            try {
              timelineEvents = typeof m.timeline_events === 'string' ? JSON.parse(m.timeline_events) : m.timeline_events;
            } catch {
              timelineEvents = m.timeline_events;
            }
          }
        }

        // Check and ingest sidecar JSON file from disk (using sidecar cache)
        const resolvedSidecar = this.findSidecarFile(filePath, folder, sidecar);
        if (resolvedSidecar) {
          sidecar = resolvedSidecar;
          const sdata = this.readParsedSidecar(resolvedSidecar);
          if (sdata) {
            const ga = sdata.gemini_analysis || sdata.analysis || sdata.metadata || {};

            if (!desc) desc = ga.description || sdata.description || null;
            if (!descRu) descRu = ga.description_ru || sdata.description_ru || null;
            if (!summ) summ = ga.summary || sdata.summary || null;
            if (!summRu) summRu = ga.summary_ru || sdata.summary_ru || null;
            if (!environment) environment = ga.environment || sdata.environment || null;
            if (!lighting) lighting = ga.lighting || sdata.lighting || null;
            if (!lightingRu) lightingRu = ga.lighting_ru || sdata.lighting_ru || null;
            if (!weather) weather = ga.weather || sdata.weather || null;
            if (!weatherRu) weatherRu = ga.weather_ru || sdata.weather_ru || null;
            if (!timeOfDay) timeOfDay = ga.time_of_day || sdata.time_of_day || null;
            if (!timeOfDayRu) timeOfDayRu = ga.time_of_day_ru || sdata.time_of_day_ru || null;
            if (!ocrText) ocrText = ga.ocr_text || sdata.ocr_text || null;
            if (!exifAnalysis) exifAnalysis = ga.exif_analysis || sdata.exif_analysis || null;
            if (!exifAnalysisRu) exifAnalysisRu = ga.exif_analysis_ru || sdata.exif_analysis_ru || null;
            if (!transcription) transcription = ga.transcription || sdata.transcription || null;
            if (!transcriptionRu) transcriptionRu = ga.transcription_ru || sdata.transcription_ru || null;
            if (!timelineEvents) timelineEvents = ga.timeline_events || sdata.timeline_events || null;

            // If faces are missing from DB, extract them from sidecar JSON
            const rawSidecarFaces = sdata.faces || sdata.detected_faces || ga.faces || ga.detected_faces || [];
            if (Array.isArray(rawSidecarFaces) && rawSidecarFaces.length > 0) {
              const sidecarFaceObjs = rawSidecarFaces.map((item: any, idx: number) => {
                if (typeof item === 'string') {
                  return {
                    face_id: `face_${baseName}_${idx}`,
                    name: item,
                    confidence: 1.0,
                    is_reference: !item.startsWith('face_') ? 1 : 0,
                    source_file: filePath,
                  };
                }
                return {
                  face_id: item.face_id || item.id || `face_${baseName}_${idx}`,
                  person_id: item.person_id || null,
                  name: item.name || item.person_name || `face_${idx}`,
                  confidence: typeof item.confidence === 'number' ? item.confidence : 0.95,
                  bbox: item.bbox || null,
                  image_path: item.image_path || item.crop_path || item.image || null,
                  time_start: item.time_start || null,
                  time_end: item.time_end || null,
                  is_reference: item.is_reference !== undefined ? (item.is_reference ? 1 : 0) : (item.name && !item.name.startsWith('face_') ? 1 : 0),
                  source_file: filePath,
                };
              });

              for (const sf of sidecarFaceObjs) {
                const fid = sf.face_id;
                if (fid && !seenFids.has(fid)) {
                  seenFids.add(fid);
                  dedupFaces.push(sf);
                  if (sf.name && !faceNames.includes(sf.name)) {
                    faceNames.push(sf.name);
                  }
                  if (!sf.is_reference || (sf.name && sf.name.startsWith('face_'))) {
                    hasUnassigned = true;
                  }
                }
              }

              // Auto-persist sidecar faces to SQLite
              try {
                this.db.saveMediaFaces(filePath, dedupFaces);
              } catch {
                // ignore persistence failures during list scan
              }
            }

            if (sdata.face_names && Array.isArray(sdata.face_names)) {
              for (const fn of sdata.face_names) {
                if (fn && !faceNames.includes(fn)) {
                  faceNames.push(fn);
                }
              }
            }

            // If sidecar exists with analysis or metadata, mark status as PROCESSED
            if (desc || descRu || summ || summRu || dedupFaces.length > 0 || status === 'UNPROCESSED') {
              status = 'PROCESSED';
            }

            // Auto-persist sidecar metadata to SQLite
            try {
              this.db.saveSyncRecord({
                filePath: filePath,
                fileSize: size,
                mtime: mtime,
                status: status,
                sidecarPath: sidecar,
              });

              this.db.saveMediaMetadata(filePath, {
                media_type: isVideo ? 'video' : 'photo',
                file_size: size,
                mtime: mtime,
                summary: summ,
                summary_ru: summRu,
                description: desc,
                description_ru: descRu,
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
                camera_make: sdata.camera_make || null,
                camera_model: sdata.camera_model || null,
                location_name: sdata.location_name || null,
              });
            } catch {
              // ignore persistence failures during scan
            }
          }
        }

        const fc = dedupFaces.length > 0 ? dedupFaces.length : (faceCounts[filePath] || baseFaceCounts[baseName.toLowerCase()] || 0);

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

      this.cachedMediaList = items;
      this.cacheTimestamp = now;
    }

    const allItems = this.cachedMediaList || [];

    // Catalog stats over complete set
    const stats = {
      total: allItems.length,
      processed: allItems.filter((f) => f.status === 'PROCESSED').length,
      photos: allItems.filter((f) => f.is_image).length,
      videos: allItems.filter((f) => f.is_video).length,
    };

    // Filter items
    let filtered = allItems;

    if (query) {
      const search = query.search?.trim().toLowerCase();
      if (search) {
        filtered = filtered.filter((item) => {
          const matchDesc = Boolean(item.description && item.description.toLowerCase().includes(search));
          const matchDescRu = Boolean(item.description_ru && item.description_ru.toLowerCase().includes(search));
          const matchSummary = Boolean(item.summary && item.summary.toLowerCase().includes(search));
          const matchSummaryRu = Boolean(item.summary_ru && item.summary_ru.toLowerCase().includes(search));
          const matchName = Boolean(item.filename && item.filename.toLowerCase().includes(search));
          const matchFolder = Boolean(item.folder && item.folder.toLowerCase().includes(search));
          const matchFaces = Boolean(item.face_names && item.face_names.some((fn: string) => fn.toLowerCase().includes(search)));
          const matchOcr = Boolean(item.ocr_text && item.ocr_text.toLowerCase().includes(search));
          return matchDesc || matchDescRu || matchSummary || matchSummaryRu || matchName || matchFolder || matchFaces || matchOcr;
        });
      }

      if (query.type && query.type !== 'all') {
        if (query.type === 'images') filtered = filtered.filter((f) => f.is_image);
        if (query.type === 'videos') filtered = filtered.filter((f) => f.is_video);
      }

      if (query.status && query.status !== 'all') {
        filtered = filtered.filter((f) => (f.status || 'UNPROCESSED') === query.status);
      }

      if (query.face_filter && query.face_filter !== 'all') {
        if (query.face_filter === 'with_faces') {
          filtered = filtered.filter((f) => (f.face_count && f.face_count > 0) || (f.faces && f.faces.length > 0));
        } else if (query.face_filter === 'no_faces') {
          filtered = filtered.filter((f) => (!f.face_count || f.face_count === 0) && (!f.faces || f.faces.length === 0));
        } else if (query.face_filter === 'unassigned') {
          filtered = filtered.filter((f) => f.has_unassigned_faces);
        }
      }

      if (query.person && query.person !== 'all') {
        filtered = filtered.filter(
          (f) =>
            (f.face_names && f.face_names.includes(query.person)) ||
            (f.faces && f.faces.some((fc: any) => fc.name === query.person || fc.person_id === query.person))
        );
      }

      if (query.folder) {
        const folderTarget = query.folder.toLowerCase();
        filtered = filtered.filter(
          (f) =>
            (f.folder && f.folder.toLowerCase() === folderTarget) ||
            (f.file_path && f.file_path.toLowerCase().includes(folderTarget))
        );
      }

      // Sorting
      if (query.sort_by) {
        const order = query.sort_order === 'asc' ? 1 : -1;
        filtered = [...filtered].sort((a, b) => {
          if (query.sort_by === 'name') {
            return order * (a.filename || '').localeCompare(b.filename || '');
          }
          if (query.sort_by === 'date') {
            return order * ((a.mtime || 0) - (b.mtime || 0));
          }
          if (query.sort_by === 'size') {
            return order * ((a.file_size || 0) - (b.file_size || 0));
          }
          if (query.sort_by === 'status') {
            return order * (a.status || '').localeCompare(b.status || '');
          }
          if (query.sort_by === 'faces') {
            return order * ((a.face_count || 0) - (b.face_count || 0));
          }
          return 0;
        });
      }
    }

    const totalFiltered = filtered.length;

    // Pagination
    let limitNum: number | undefined;
    let offsetNum = 0;

    if (query?.limit !== undefined) {
      limitNum = Math.max(1, Number(query.limit));
    }
    if (query?.offset !== undefined) {
      offsetNum = Math.max(0, Number(query.offset));
    } else if (query?.page !== undefined) {
      const pageNum = Math.max(1, Number(query.page));
      offsetNum = (pageNum - 1) * (limitNum || 50);
    }

    let pagedFiles = filtered;
    let hasMore = false;

    if (limitNum !== undefined) {
      pagedFiles = filtered.slice(offsetNum, offsetNum + limitNum);
      hasMore = offsetNum + limitNum < totalFiltered;
    }

    return {
      total_files: totalFiltered,
      total: totalFiltered,
      files: pagedFiles,
      offset: offsetNum,
      limit: limitNum || totalFiltered,
      has_more: hasMore,
      hasMore: hasMore,
      stats: stats,
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

  /**
   * Verify read access to a given media file target path or filename.
   */
  verifyFileAccess(target: string): { accessible: boolean; resolvedPath?: string; error?: string } {
    try {
      const resolved = this.resolveMediaFilePath(target);
      fs.accessSync(resolved, fs.constants.R_OK);
      return { accessible: true, resolvedPath: resolved };
    } catch (err: any) {
      return {
        accessible: false,
        error: err.message || `File '${target}' is not accessible or not found`,
      };
    }
  }

  async getMediaSidecar(target: string): Promise<any> {
    const trimmed = target.trim();
    this.db.initDb();

    // Check if sidecar file exists on disk
    const sidecarFile = this.findSidecarFile(trimmed);
    if (sidecarFile && fs.existsSync(sidecarFile)) {
      try {
        const raw = fs.readFileSync(sidecarFile, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        throw new BadRequestException(`Failed to read sidecar file: ${err}`);
      }
    }

    // Check database records if sidecar file is not on disk
    const allMeta = this.db.getAllMediaMetadata();
    const meta = allMeta[trimmed] || allMeta[path.basename(trimmed).toLowerCase()];
    const faces = this.db.getFacesBySourceFile(trimmed);

    if (meta || faces.length > 0) {
      return {
        file: trimmed,
        filename: path.basename(trimmed),
        description: meta?.description || null,
        description_ru: meta?.description_ru || null,
        summary: meta?.summary || null,
        summary_ru: meta?.summary_ru || null,
        gemini_analysis: {
          description: meta?.description || null,
          description_ru: meta?.description_ru || null,
          summary: meta?.summary || null,
          summary_ru: meta?.summary_ru || null,
          environment: meta?.environment || null,
          lighting: meta?.lighting || null,
          lighting_ru: meta?.lighting_ru || null,
          weather: meta?.weather || null,
          weather_ru: meta?.weather_ru || null,
          time_of_day: meta?.time_of_day || null,
          time_of_day_ru: meta?.time_of_day_ru || null,
          ocr_text: meta?.ocr_text || null,
          exif_analysis: meta?.exif_analysis || null,
          exif_analysis_ru: meta?.exif_analysis_ru || null,
          transcription: meta?.transcription || null,
          transcription_ru: meta?.transcription_ru || null,
          timeline_events: meta?.timeline_events || null,
        },
        faces: faces,
        face_names: Array.from(new Set(faces.map((f: any) => f.name).filter(Boolean))),
      };
    }

    // Fallback: Query remote cataloger daemon API
    try {
      const res = await axios.get(
        `${this.catalogerBaseUrl}/api/media/sidecar?file=${encodeURIComponent(trimmed)}`,
        { timeout: 4000 }
      );
      if (res.data && typeof res.data === 'object' && res.data.file_path) {
        const sdata = res.data;
        const outFolder = this.config.outputFolder;
        if (!fs.existsSync(outFolder)) {
          fs.mkdirSync(outFolder, { recursive: true });
        }
        const localSidecarPath = path.join(outFolder, `${path.basename(trimmed)}.json`);
        try {
          fs.writeFileSync(localSidecarPath, JSON.stringify(sdata, null, 2), 'utf-8');
        } catch {
          // ignore
        }

        const ga = sdata.gemini_analysis || sdata.analysis || sdata.metadata || {};
        this.db.saveSyncRecord({
          filePath: trimmed,
          fileSize: sdata.file_size || 0,
          mtime: sdata.mtime || 0,
          status: 'PROCESSED',
          sidecarPath: localSidecarPath,
        });
        this.db.saveMediaMetadata(trimmed, {
          summary: ga.summary || sdata.summary,
          summary_ru: ga.summary_ru || sdata.summary_ru,
          description: ga.description || sdata.description,
          description_ru: ga.description_ru || sdata.description_ru,
          environment: ga.environment || sdata.environment,
          lighting: ga.lighting || sdata.lighting,
          lighting_ru: ga.lighting_ru || sdata.lighting_ru,
          weather: ga.weather || sdata.weather,
          weather_ru: ga.weather_ru || sdata.weather_ru,
          time_of_day: ga.time_of_day || sdata.time_of_day,
          time_of_day_ru: ga.time_of_day_ru || sdata.time_of_day_ru,
          ocr_text: ga.ocr_text || sdata.ocr_text,
          exif_analysis: ga.exif_analysis || sdata.exif_analysis,
          exif_analysis_ru: ga.exif_analysis_ru || sdata.exif_analysis_ru,
          transcription: ga.transcription || sdata.transcription,
          transcription_ru: ga.transcription_ru || sdata.transcription_ru,
          timeline_events: ga.timeline_events || sdata.timeline_events,
          camera_make: sdata.exif?.camera_make || null,
          camera_model: sdata.exif?.camera_model || null,
          location_name: ga.location_name || null,
          media_type: sdata.media_type || 'image',
        });

        if (Array.isArray(sdata.faces) && sdata.faces.length > 0) {
          this.db.saveMediaFaces(trimmed, sdata.faces);
        }

        return sdata;
      }
    } catch {
      // ignore
    }

    throw new NotFoundException(`Sidecar metadata not found for '${trimmed}'`);
  }

  async getFacesForFile(file: string): Promise<any[]> {
    if (!file || !file.trim()) {
      throw new BadRequestException('File parameter cannot be empty');
    }
    this.db.initDb();
    const trimmed = file.trim();
    let faces = this.db.getFacesBySourceFile(trimmed);
    if (faces.length > 0) {
      return faces;
    }

    // Fallback: check sidecar on disk
    const sidecarFile = this.findSidecarFile(trimmed);
    if (sidecarFile && fs.existsSync(sidecarFile)) {
      try {
        const raw = fs.readFileSync(sidecarFile, 'utf-8');
        const sdata = JSON.parse(raw);
        const rawFaces = sdata.faces || sdata.detected_faces || sdata.gemini_analysis?.faces || [];
        if (Array.isArray(rawFaces) && rawFaces.length > 0) {
          const dedupMap = new Map<string, any>();
          for (let idx = 0; idx < rawFaces.length; idx++) {
            const item = rawFaces[idx];
            if (typeof item === 'string') {
              const fid = `face_${path.basename(trimmed)}_${idx}`;
              if (!dedupMap.has(fid)) {
                dedupMap.set(fid, {
                  face_id: fid,
                  name: item,
                  confidence: 1.0,
                  is_reference: !item.startsWith('face_') ? 1 : 0,
                  source_file: trimmed,
                });
              }
            } else if (item && typeof item === 'object') {
              const fid = item.face_id || item.id || `face_${path.basename(trimmed)}_${idx}`;
              if (!dedupMap.has(fid)) {
                const name = item.name || item.person_name || `face_${idx}`;
                dedupMap.set(fid, {
                  face_id: fid,
                  person_id: item.person_id || null,
                  name: name,
                  confidence: typeof item.confidence === 'number' ? item.confidence : 0.95,
                  bbox: item.bbox || null,
                  image_path: item.image_path || item.crop_path || item.image || null,
                  time_start: item.time_start || null,
                  time_end: item.time_end || null,
                  is_reference: item.is_reference !== undefined ? (item.is_reference ? 1 : 0) : (name && !name.startsWith('face_') ? 1 : 0),
                  source_file: trimmed,
                });
              }
            }
          }

          const sidecarFaces = Array.from(dedupMap.values());

          // Ingest into database
          try {
            this.db.saveMediaFaces(trimmed, sidecarFaces);
          } catch {
            // ignore
          }

          return sidecarFaces;
        }
      } catch {
        // ignore
      }
    }

    // Fallback: query remote cataloger faces API
    try {
      const res = await axios.get(
        `${this.catalogerBaseUrl}/api/media/faces-for-file?file=${encodeURIComponent(trimmed)}`,
        { timeout: 4000 }
      );
      if (Array.isArray(res.data) && res.data.length > 0) {
        this.db.saveMediaFaces(trimmed, res.data);
        return res.data;
      }
    } catch {
      // ignore
    }

    return [];
  }

  addPersonToFile(file: string, name: string) {
    if (!file || !file.trim()) throw new BadRequestException('File parameter cannot be empty');
    if (!name || !name.trim()) throw new BadRequestException('Person name cannot be empty');

    const trimmedFile = file.trim();
    const trimmedName = name.trim();

    this.db.initDb();
    const res = this.db.addPersonToMediaFile(trimmedFile, trimmedName);

    // Sync with sidecar JSON on disk if exists
    const sidecarFile = this.findSidecarFile(trimmedFile);
    if (sidecarFile && fs.existsSync(sidecarFile)) {
      try {
        const raw = fs.readFileSync(sidecarFile, 'utf-8');
        const sdata = JSON.parse(raw);
        if (!Array.isArray(sdata.faces)) sdata.faces = [];
        if (!Array.isArray(sdata.face_names)) sdata.face_names = [];

        sdata.faces.push({
          face_id: res.face_id,
          person_id: res.person_id,
          name: trimmedName,
          confidence: 1.0,
          is_reference: 1,
        });

        if (!sdata.face_names.includes(trimmedName)) {
          sdata.face_names.push(trimmedName);
        }

        fs.writeFileSync(sidecarFile, JSON.stringify(sdata, null, 2), 'utf-8');
      } catch {
        // ignore sidecar write error
      }
    }

    this.invalidateCache();

    return {
      status: 'success',
      message: `Person '${trimmedName}' successfully linked to file.`,
      data: res,
    };
  }

  removeFaceFromFile(file: string, faceId: string) {
    if (!file || !file.trim()) throw new BadRequestException('File parameter cannot be empty');
    if (!faceId || !faceId.trim()) throw new BadRequestException('Face ID cannot be empty');

    const trimmedFile = file.trim();
    const trimmedFaceId = faceId.trim();

    this.db.initDb();
    this.db.removeFaceFromMediaFile(trimmedFile, trimmedFaceId);

    // Sync with sidecar JSON on disk if exists
    const sidecarFile = this.findSidecarFile(trimmedFile);
    if (sidecarFile && fs.existsSync(sidecarFile)) {
      try {
        const raw = fs.readFileSync(sidecarFile, 'utf-8');
        const sdata = JSON.parse(raw);
        if (Array.isArray(sdata.faces)) {
          sdata.faces = sdata.faces.filter((f: any) => (typeof f === 'string' ? f !== trimmedFaceId : f.face_id !== trimmedFaceId));
          sdata.face_names = Array.from(new Set(sdata.faces.map((f: any) => (typeof f === 'string' ? f : f.name)).filter(Boolean)));
          fs.writeFileSync(sidecarFile, JSON.stringify(sdata, null, 2), 'utf-8');
        }
      } catch {
        // ignore sidecar write error
      }
    }

    this.invalidateCache();

    return {
      status: 'success',
      message: `Face/Person '${trimmedFaceId}' removed from file.`,
    };
  }
}

