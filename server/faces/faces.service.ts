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
    const safeName = path.basename(filename);
    const candidates = [
      path.join(this.config.facesFolder, safeName),
      path.join(this.config.outputFolder, 'facess', safeName),
      path.join(this.config.outputFolder, 'faces', safeName),
      path.join(this.config.outputFolder, filename),
      path.join(this.config.outputFolder, safeName),
      path.join(this.config.projectRoot, 'media_output', 'facess', safeName),
      path.join(this.config.projectRoot, 'media_output', 'faces', safeName),
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        try {
          if (fs.statSync(c).isFile()) {
            return c;
          }
        } catch {
          // ignore
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
