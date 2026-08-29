import { Injectable, Inject } from '@nestjs/common';
import { FamilyTreeDatabaseService } from './family-tree-db.service.js';
import { KinshipEngineService } from './kinship-engine.service.js';
import { FamilyTreeService } from './family-tree.service.js';
import type {
  PersonRecord,
  PersonContextResponse,
  ImmediateRelative,
  PhotoKinshipResponse,
  AutocompletePersonItem,
} from './types/family-tree.types.js';
import type { PhotoKinshipDto } from './dto/family-tree.dto.js';

@Injectable()
export class FamilyTreePublicService {
  constructor(
    @Inject(FamilyTreeDatabaseService) private readonly dbService: FamilyTreeDatabaseService,
    @Inject(KinshipEngineService) private readonly kinshipService: KinshipEngineService,
    @Inject(FamilyTreeService) private readonly treeService: FamilyTreeService,
  ) {}

  /**
   * Retrieves structured genealogical context, kinship to root ("ME"), immediate family,
   * and recent life milestones for a person recognized by name, media ID, or face ID.
   */
  public getPersonContext(params: {
    name?: string;
    mediaPersonId?: string;
    faceId?: string;
    personId?: string;
    treeId?: string;
  }): PersonContextResponse {
    const person = this.resolvePerson(params);
    if (!person) {
      return { found: false };
    }

    const db = this.dbService.getDb();
    const tree = this.treeService.getTreeById(person.tree_id);
    const rootPersonId = tree.root_person_id || person.id;

    // Kinship relative to Root ("ME")
    const kinshipToRoot = this.kinshipService.calculateKinship(rootPersonId, person.id);

    // Immediate Family (Parents, Spouses, Children, Siblings)
    const immediateFamily = this.getImmediateFamily(person);

    // Recent / Notable Milestones
    const milestonesRows = db
      .prepare(`
        SELECT pe.*, COUNT(emp.id) as pinned_count
        FROM ft_person_events pe
        LEFT JOIN ft_event_media_pins emp ON pe.id = emp.event_id
        WHERE pe.person_id = ?
        GROUP BY pe.id
        ORDER BY 
          CASE WHEN pe.event_date IS NULL OR pe.event_date = '' THEN 1 ELSE 0 END,
          pe.event_date DESC,
          pe.created_at DESC
        LIMIT 10
      `)
      .all(person.id) as Array<any>;

    const recentMilestones = milestonesRows.map((m) => ({
      type: m.event_type,
      title: m.title,
      description: m.description,
      date: m.event_date,
      location: m.location_name,
      pinnedMediaCount: Number(m.pinned_count || 0),
    }));

    const fullName = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ');
    const birthYear = person.birth_date ? person.birth_date.split('-')[0] : null;

    return {
      found: true,
      treePersonId: person.id,
      fullName: fullName || person.first_name,
      firstName: person.first_name,
      middleName: person.middle_name || null,
      lastName: person.last_name || null,
      maidenName: person.maiden_name || null,
      gender: person.gender,
      birthYear,
      birthDate: person.birth_date || null,
      birthPlace: person.birth_place || null,
      isLiving: person.is_living === 1,
      deathDate: person.death_date || null,
      deathPlace: person.death_place || null,
      bio: person.bio || null,
      avatarUrl: person.avatar_url || (person.avatar_face_id ? `/api/faces/image/${person.avatar_face_id}` : null),
      avatarFaceId: person.avatar_face_id || null,
      kinshipToRoot,
      immediateFamily,
      recentMilestones,
    };
  }

  /**
   * Resolves a person record from flexible query parameters (personId, mediaPersonId, faceId, name).
   */
  public resolvePerson(params: {
    name?: string;
    mediaPersonId?: string;
    faceId?: string;
    personId?: string;
    treeId?: string;
  }): PersonRecord | null {
    const db = this.dbService.getDb();
    const treeFilter = params.treeId ? 'AND tree_id = ?' : '';
    const treeParams = params.treeId ? [params.treeId] : [];

    if (params.personId) {
      const p = db.prepare(`SELECT * FROM ft_persons WHERE id = ? ${treeFilter}`).get(params.personId, ...treeParams) as
        | PersonRecord
        | undefined;
      if (p) return p;
    }

    if (params.faceId) {
      // Check avatar_face_id directly
      let p = db.prepare(`SELECT * FROM ft_persons WHERE avatar_face_id = ? ${treeFilter}`).get(params.faceId, ...treeParams) as
        | PersonRecord
        | undefined;
      if (p) return p;

      // Check ft_person_face_links
      const link = db
        .prepare('SELECT tree_person_id FROM ft_person_face_links WHERE media_face_id = ?')
        .get(params.faceId) as { tree_person_id: string } | undefined;
      if (link) {
        p = db.prepare(`SELECT * FROM ft_persons WHERE id = ? ${treeFilter}`).get(link.tree_person_id, ...treeParams) as
          | PersonRecord
          | undefined;
        if (p) return p;
      }
    }

    if (params.mediaPersonId) {
      let p = db
        .prepare(`SELECT * FROM ft_persons WHERE (media_person_id = ? OR id = ?) ${treeFilter}`)
        .get(params.mediaPersonId, params.mediaPersonId, ...treeParams) as PersonRecord | undefined;
      if (p) return p;

      const link = db
        .prepare('SELECT tree_person_id FROM ft_person_face_links WHERE media_person_name = ?')
        .get(params.mediaPersonId) as { tree_person_id: string } | undefined;
      if (link) {
        p = db.prepare(`SELECT * FROM ft_persons WHERE id = ? ${treeFilter}`).get(link.tree_person_id, ...treeParams) as
          | PersonRecord
          | undefined;
        if (p) return p;
      }
    }

    if (params.name && params.name.trim()) {
      const name = params.name.trim();

      // 1. Exact full name match
      let p = db
        .prepare(`
          SELECT * FROM ft_persons 
          WHERE (
            LOWER(TRIM(first_name || ' ' || COALESCE(last_name, ''))) = LOWER(?)
            OR LOWER(TRIM(first_name || ' ' || COALESCE(middle_name, '') || ' ' || COALESCE(last_name, ''))) = LOWER(?)
            OR LOWER(first_name) = LOWER(?)
            OR LOWER(media_person_id) = LOWER(?)
          ) ${treeFilter}
        `)
        .get(name, name, name, name, ...treeParams) as PersonRecord | undefined;
      if (p) return p;

      // 2. Check face link name
      const link = db
        .prepare('SELECT tree_person_id FROM ft_person_face_links WHERE LOWER(media_person_name) = LOWER(?)')
        .get(name) as { tree_person_id: string } | undefined;
      if (link) {
        p = db.prepare(`SELECT * FROM ft_persons WHERE id = ? ${treeFilter}`).get(link.tree_person_id, ...treeParams) as
          | PersonRecord
          | undefined;
        if (p) return p;
      }

      // 3. Substring fuzzy match
      p = db
        .prepare(`
          SELECT * FROM ft_persons 
          WHERE (first_name LIKE ? OR last_name LIKE ?) ${treeFilter}
          ORDER BY (CASE WHEN LOWER(first_name) = LOWER(?) THEN 1 ELSE 2 END)
          LIMIT 1
        `)
        .get(`%${name}%`, `%${name}%`, ...treeParams, name) as PersonRecord | undefined;
      if (p) return p;
    }

    return null;
  }

  /**
   * Discovers immediate family members (Parents, Spouses, Children, Siblings).
   */
  private getImmediateFamily(person: PersonRecord): {
    parents: ImmediateRelative[];
    spouses: ImmediateRelative[];
    children: ImmediateRelative[];
    siblings: ImmediateRelative[];
  } {
    const db = this.dbService.getDb();

    // 1. Parents
    const parentRows = db
      .prepare(`
        SELECT p.*
        FROM ft_child_relations cr
        JOIN ft_unions u ON cr.union_id = u.id
        JOIN ft_union_partners up ON u.id = up.union_id
        JOIN ft_persons p ON up.person_id = p.id
        WHERE cr.person_id = ?
      `)
      .all(person.id) as PersonRecord[];

    const parents: ImmediateRelative[] = parentRows.map((p) => {
      const term = p.gender === 'MALE' ? 'Father' : p.gender === 'FEMALE' ? 'Mother' : 'Parent';
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
      return {
        id: p.id,
        name,
        relation: term,
        avatarUrl: p.avatar_url || (p.avatar_face_id ? `/api/faces/image/${p.avatar_face_id}` : null),
      };
    });

    // 2. Spouses / Partners
    const spouseRows = db
      .prepare(`
        SELECT p.*, u.union_type
        FROM ft_union_partners up1
        JOIN ft_unions u ON up1.union_id = u.id
        JOIN ft_union_partners up2 ON u.id = up2.union_id
        JOIN ft_persons p ON up2.person_id = p.id
        WHERE up1.person_id = ? AND up2.person_id != ?
      `)
      .all(person.id, person.id) as Array<PersonRecord & { union_type: string }>;

    const spouses: ImmediateRelative[] = spouseRows.map((p) => {
      let term = p.gender === 'MALE' ? 'Husband' : p.gender === 'FEMALE' ? 'Wife' : 'Partner';
      if (p.union_type === 'DIVORCED') {
        term = `Ex-${term}`;
      }
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
      return {
        id: p.id,
        name,
        relation: term,
        avatarUrl: p.avatar_url || (p.avatar_face_id ? `/api/faces/image/${p.avatar_face_id}` : null),
      };
    });

    // 3. Children
    const childRows = db
      .prepare(`
        SELECT p.*, cr.filiation
        FROM ft_union_partners up
        JOIN ft_unions u ON up.union_id = u.id
        JOIN ft_child_relations cr ON u.id = cr.union_id
        JOIN ft_persons p ON cr.person_id = p.id
        WHERE up.person_id = ?
      `)
      .all(person.id) as Array<PersonRecord & { filiation: string }>;

    const children: ImmediateRelative[] = childRows.map((p) => {
      const isAdopted = p.filiation === 'ADOPTED';
      let term = p.gender === 'MALE' ? 'Son' : p.gender === 'FEMALE' ? 'Daughter' : 'Child';
      if (isAdopted) term = `Adopted ${term}`;
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
      return {
        id: p.id,
        name,
        relation: term,
        avatarUrl: p.avatar_url || (p.avatar_face_id ? `/api/faces/image/${p.avatar_face_id}` : null),
      };
    });

    // 4. Siblings
    const siblingRows = db
      .prepare(`
        SELECT DISTINCT p.*
        FROM ft_child_relations cr1
        JOIN ft_child_relations cr2 ON cr1.union_id = cr2.union_id
        JOIN ft_persons p ON cr2.person_id = p.id
        WHERE cr1.person_id = ? AND cr2.person_id != ?
      `)
      .all(person.id, person.id) as PersonRecord[];

    const siblings: ImmediateRelative[] = siblingRows.map((p) => {
      const term = p.gender === 'MALE' ? 'Brother' : p.gender === 'FEMALE' ? 'Sister' : 'Sibling';
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
      return {
        id: p.id,
        name,
        relation: term,
        avatarUrl: p.avatar_url || (p.avatar_face_id ? `/api/faces/image/${p.avatar_face_id}` : null),
      };
    });

    return { parents, spouses, children, siblings };
  }

  /**
   * Analyzes a group of detected faces/persons in a single photo, computes mutual kinship,
   * and generates rich contextual captions for AI engines and galleries.
   */
  public analyzePhotoKinship(dto: PhotoKinshipDto): PhotoKinshipResponse {
    const rawIdentifiers: Array<{ type: 'face' | 'name'; value: string }> = [];

    if (dto.face_ids && dto.face_ids.length > 0) {
      dto.face_ids.forEach((f) => rawIdentifiers.push({ type: 'face', value: f }));
    }
    if (dto.person_names && dto.person_names.length > 0) {
      dto.person_names.forEach((n) => rawIdentifiers.push({ type: 'name', value: n }));
    }

    const identifiedMap = new Map<string, { name: string; person: PersonRecord }>();

    for (const ident of rawIdentifiers) {
      const resolved =
        ident.type === 'face'
          ? this.resolvePerson({ faceId: ident.value })
          : this.resolvePerson({ name: ident.value });

      if (resolved) {
        const pName = [resolved.first_name, resolved.last_name].filter(Boolean).join(' ');
        if (!identifiedMap.has(resolved.id)) {
          identifiedMap.set(resolved.id, { name: pName || ident.value, person: resolved });
        }
      }
    }

    const identifiedPersonsList = Array.from(identifiedMap.values());
    const defaultTree = this.treeService.getOrCreateDefaultTree();
    const rootPersonId = defaultTree.root_person_id || (identifiedPersonsList[0]?.person?.id ?? '');

    const identifiedPersons = identifiedPersonsList.map(({ name, person }) => ({
      name,
      treePersonId: person.id,
      avatarUrl: person.avatar_url || (person.avatar_face_id ? `/api/faces/image/${person.avatar_face_id}` : null),
      kinshipToRoot: rootPersonId ? this.kinshipService.calculateKinship(rootPersonId, person.id) : null,
    }));

    // Pairwise relationships
    const relationships: PhotoKinshipResponse['relationships'] = [];
    for (let i = 0; i < identifiedPersonsList.length; i++) {
      for (let j = i + 1; j < identifiedPersonsList.length; j++) {
        const pA = identifiedPersonsList[i];
        const pB = identifiedPersonsList[j];
        const kAtoB = this.kinshipService.calculateKinship(pA.person.id, pB.person.id);
        const kBtoA = this.kinshipService.calculateKinship(pB.person.id, pA.person.id);

        relationships.push({
          personA: pA.name,
          personB: pB.name,
          kinshipAtoB: kAtoB.primaryTerm,
          kinshipBtoA: kBtoA.primaryTerm,
          category: kAtoB.category,
        });
      }
    }

    // Generate contextual captions
    let suggestedCaption = '';
    let summaryDescription = '';

    if (identifiedPersonsList.length === 0) {
      suggestedCaption = 'Photo without recognized family members.';
      summaryDescription = 'No known family members detected.';
    } else if (identifiedPersonsList.length === 1) {
      const p = identifiedPersons[0];
      const term = p.kinshipToRoot?.primaryTerm;
      const relationContext = term && term !== 'Self' && term !== 'Unrelated / Unknown' ? ` (${term})` : '';
      suggestedCaption = `Portrait of ${p.name}${relationContext}.`;
      summaryDescription = `Single person photograph of ${p.name}.`;
    } else if (identifiedPersonsList.length === 2) {
      const p1 = identifiedPersonsList[0];
      const p2 = identifiedPersonsList[1];
      const rel = relationships[0];

      if (rel.category === 'SPOUSE_PARTNER') {
        suggestedCaption = `Photo of ${p1.name} and spouse ${p2.name}.`;
        summaryDescription = `Spouses ${p1.name} and ${p2.name}.`;
      } else if (rel.category === 'COLLATERAL' && (rel.kinshipAtoB.includes('Brother') || rel.kinshipAtoB.includes('Sister') || rel.kinshipAtoB.includes('Sibling'))) {
        suggestedCaption = `Siblings ${p1.name} and ${p2.name} together.`;
        summaryDescription = `Brother/sister photo of ${p1.name} and ${p2.name}.`;
      } else if (rel.category === 'DIRECT_ANCESTOR' || rel.category === 'DIRECT_DESCENDANT') {
        suggestedCaption = `${p1.name} with ${rel.kinshipAtoB.toLowerCase()} ${p2.name}.`;
        summaryDescription = `Generational portrait of ${p1.name} and ${p2.name} (${rel.kinshipAtoB}).`;
      } else {
        suggestedCaption = `Photo of ${p1.name} and ${p2.name} (${rel.kinshipAtoB}).`;
        summaryDescription = `Family gathering featuring ${p1.name} and ${p2.name}.`;
      }
    } else {
      // 3 or more people
      const names = identifiedPersons.map((p) => p.name);
      const rootIdent = identifiedPersons.find((p) => p.treePersonId === rootPersonId);

      if (rootIdent) {
        const otherRelatives = identifiedPersons
          .filter((p) => p.treePersonId !== rootPersonId)
          .map((p) => {
            const term = p.kinshipToRoot?.primaryTerm;
            return term && term !== 'Unrelated / Unknown' ? `${term.toLowerCase()} ${p.name}` : p.name;
          });
        suggestedCaption = `Family gathering featuring ${rootIdent.name} with ${otherRelatives.join(', ')}.`;
      } else {
        suggestedCaption = `Family group portrait with ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}.`;
      }
      summaryDescription = `Multi-person family portrait with ${identifiedPersons.length} identified members.`;
    }

    // Contextual Milestones
    const contextualMilestones: PhotoKinshipResponse['contextualMilestones'] = [];
    const db = this.dbService.getDb();
    for (const { name, person } of identifiedPersonsList) {
      const evts = db
        .prepare(`
          SELECT event_type, title, event_date, location_name
          FROM ft_person_events
          WHERE person_id = ?
          ORDER BY event_date DESC
          LIMIT 2
        `)
        .all(person.id) as Array<any>;

      for (const e of evts) {
        contextualMilestones.push({
          personName: name,
          eventType: e.event_type,
          title: e.title,
          date: e.event_date,
          location: e.location_name,
        });
      }
    }

    return {
      identifiedPersons,
      relationships,
      suggestedCaption,
      summaryDescription,
      contextualMilestones,
    };
  }

  /**
   * Fast autocomplete search index across family members with kinship badges.
   */
  public getAutocomplete(query?: string, treeId?: string): AutocompletePersonItem[] {
    const db = this.dbService.getDb();
    const tree = treeId ? this.treeService.getTreeById(treeId) : this.treeService.getOrCreateDefaultTree();
    const rootPersonId = tree.root_person_id;

    let persons: PersonRecord[] = [];
    if (query && query.trim()) {
      const q = `%${query.trim()}%`;
      persons = db
        .prepare(`
          SELECT * FROM ft_persons
          WHERE tree_id = ? AND (
            first_name LIKE ? OR last_name LIKE ? OR maiden_name LIKE ? OR media_person_id LIKE ?
          )
          ORDER BY last_name ASC, first_name ASC
          LIMIT 20
        `)
        .all(tree.id, q, q, q, q) as PersonRecord[];
    } else {
      persons = db
        .prepare('SELECT * FROM ft_persons WHERE tree_id = ? ORDER BY last_name ASC, first_name ASC LIMIT 20')
        .all(tree.id) as PersonRecord[];
    }

    return persons.map((p) => {
      const fullName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ');
      const kinship = rootPersonId ? this.kinshipService.calculateKinship(rootPersonId, p.id) : null;
      const birthYear = p.birth_date ? p.birth_date.split('-')[0] : null;

      return {
        id: p.id,
        fullName: fullName || p.first_name,
        firstName: p.first_name,
        lastName: p.last_name || null,
        maidenName: p.maiden_name || null,
        avatarUrl: p.avatar_url || (p.avatar_face_id ? `/api/faces/image/${p.avatar_face_id}` : null),
        kinshipTerm: kinship?.primaryTerm || null,
        birthYear,
        isLiving: p.is_living === 1,
        mediaPersonId: p.media_person_id || null,
      };
    });
  }
}
