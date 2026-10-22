import { Injectable, Inject } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../database/database.service.js';
import { AppConfigService } from '../config/config.service.js';

@Injectable()
export class TagsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}

  get outputFolder(): string {
    return this.config.outputFolder || '';
  }

  getTags(search?: string, category?: string, sort?: string, limit?: number, offset?: number) {
    this.db.initDb();
    return this.db.getTagsCatalog(search, category, sort, limit, offset);
  }

  createTag(tag: string, category: string = 'general') {
    this.db.initDb();
    return this.db.createGlobalTag(tag, category);
  }

  renameOrMergeTag(oldTag: string, newTag: string, category?: string) {
    this.db.initDb();
    const result = this.db.renameOrMergeTag(oldTag, newTag, category);

    // Update on-disk sidecars where oldTag exists
    try {
      this.syncSidecarsForTagRename(oldTag, newTag);
    } catch {
      // non-blocking sidecar sync
    }

    return result;
  }

  deleteTag(tag: string) {
    this.db.initDb();
    const result = this.db.deleteGlobalTag(tag);

    try {
      this.syncSidecarsForTagDelete(tag);
    } catch {
      // non-blocking
    }

    return result;
  }

  addMediaTag(mediaIdOrPath: string, tag: string, category: string = 'general') {
    this.db.initDb();
    this.db.addMediaTag(mediaIdOrPath, tag, category);

    // Update sidecar JSON if filePath
    this.updateMediaSidecarTag(mediaIdOrPath, tag, category, 'add');

    return {
      status: 'success',
      message: `Tag '#${tag}' added successfully.`,
      tags: this.db.getMediaTags(mediaIdOrPath),
    };
  }

  removeMediaTag(mediaIdOrPath: string, tag: string) {
    this.db.initDb();
    this.db.removeMediaTag(mediaIdOrPath, tag);

    // Update sidecar JSON if filePath
    this.updateMediaSidecarTag(mediaIdOrPath, tag, '', 'remove');

    return {
      status: 'success',
      message: `Tag '#${tag}' removed successfully.`,
      tags: this.db.getMediaTags(mediaIdOrPath),
    };
  }

  getPersonTags(personIdOrName: string) {
    this.db.initDb();
    return this.db.getPersonTags(personIdOrName);
  }

  setPersonTags(personIdOrName: string, tags: { tag: string; category?: string }[]) {
    this.db.initDb();
    this.db.setPersonTags(personIdOrName, tags);
    return {
      status: 'success',
      person_id: personIdOrName,
      tags: this.db.getPersonTags(personIdOrName),
    };
  }

  getMediaTags(mediaIdOrPath: string) {
    this.db.initDb();
    return this.db.getMediaTags(mediaIdOrPath);
  }

  private updateMediaSidecarTag(filePathOrId: string, tag: string, category: string, action: 'add' | 'remove') {
    const cleanTag = (tag || '').trim().toLowerCase();
    if (!cleanTag) return;

    let targetFile = filePathOrId;
    if (!filePathOrId.includes('/') && !filePathOrId.includes('\\')) {
      try {
        const row = this.db.getDb().prepare('SELECT file_path FROM media_items WHERE id = ?').get(filePathOrId) as any;
        if (row?.file_path) targetFile = row.file_path;
      } catch {}
    }

    const baseName = path.basename(targetFile);
    const candidateSidecars = [
      path.join(this.outputFolder, `${baseName}.json`),
      path.join(path.dirname(targetFile), `${baseName}.json`),
      path.join(this.outputFolder, `${targetFile}.json`),
      `${targetFile}.json`,
    ];

    for (const sc of candidateSidecars) {
      try {
        if (fs.existsSync(sc)) {
          const raw = fs.readFileSync(sc, 'utf-8');
          const data = JSON.parse(raw);
          let tagsList = Array.isArray(data.tags) ? data.tags : [];

          if (action === 'add') {
            const hasTag = tagsList.some((t: any) => {
              const str = typeof t === 'string' ? t : (t.tag || t.name);
              return String(str).toLowerCase() === cleanTag;
            });
            if (!hasTag) {
              tagsList.push({ tag: cleanTag, category: category || 'general', confidence: 1.0 });
              data.tags = tagsList;
              fs.writeFileSync(sc, JSON.stringify(data, null, 2), 'utf-8');
            }
          } else {
            const origLen = tagsList.length;
            tagsList = tagsList.filter((t: any) => {
              const str = typeof t === 'string' ? t : (t.tag || t.name);
              return String(str).toLowerCase() !== cleanTag;
            });
            if (tagsList.length !== origLen) {
              data.tags = tagsList;
              fs.writeFileSync(sc, JSON.stringify(data, null, 2), 'utf-8');
            }
          }
          break;
        }
      } catch {}
    }
  }

  private syncSidecarsForTagRename(oldTag: string, newTag: string) {
    const cleanOld = oldTag.trim().toLowerCase();
    const cleanNew = newTag.trim().toLowerCase();
    if (!this.outputFolder || !fs.existsSync(this.outputFolder)) return;

    try {
      const files = fs.readdirSync(this.outputFolder);
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        const p = path.join(this.outputFolder, f);
        try {
          const raw = fs.readFileSync(p, 'utf-8');
          if (raw.toLowerCase().includes(`"${cleanOld}"`)) {
            const data = JSON.parse(raw);
            if (Array.isArray(data.tags)) {
              let changed = false;
              data.tags = data.tags.map((t: any) => {
                if (typeof t === 'string' && t.toLowerCase() === cleanOld) {
                  changed = true;
                  return cleanNew;
                }
                if (typeof t === 'object' && t && String(t.tag || t.name).toLowerCase() === cleanOld) {
                  changed = true;
                  return { ...t, tag: cleanNew };
                }
                return t;
              });
              if (changed) {
                fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
              }
            }
          }
        } catch {}
      }
    } catch {}
  }

  private syncSidecarsForTagDelete(tag: string) {
    const cleanTag = tag.trim().toLowerCase();
    if (!this.outputFolder || !fs.existsSync(this.outputFolder)) return;

    try {
      const files = fs.readdirSync(this.outputFolder);
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        const p = path.join(this.outputFolder, f);
        try {
          const raw = fs.readFileSync(p, 'utf-8');
          if (raw.toLowerCase().includes(`"${cleanTag}"`)) {
            const data = JSON.parse(raw);
            if (Array.isArray(data.tags)) {
              const origLen = data.tags.length;
              data.tags = data.tags.filter((t: any) => {
                const str = typeof t === 'string' ? t : (t.tag || t.name);
                return String(str).toLowerCase() !== cleanTag;
              });
              if (data.tags.length !== origLen) {
                fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
              }
            }
          }
        } catch {}
      }
    } catch {}
  }
}
