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

    // Add extensions if name has no extension
    const ext = path.extname(safeName);
    if (!ext) {
      const exts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
      const baseTargets = Array.from(targetNames);
      for (const t of baseTargets) {
        for (const e of exts) {
          targetNames.add(`${t}${e}`);
        }
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
    this.db.initDb();
    const mapping = this.db.getFaceNameMapping();
    if (!mapping[faceId]) {
      throw new NotFoundException(`Face ID '${faceId}' not found in registry.`);
    }
    this.db.deleteFace(faceId);
    return {
      status: 'success',
      message: `Face '${faceId}' deleted successfully.`,
    };
  }
}
