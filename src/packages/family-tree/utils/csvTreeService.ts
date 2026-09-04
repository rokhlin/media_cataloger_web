import type { TreeGraphData, Gender, UnionType, FiliationType } from '../types/tree.types.js';

function escapeCsvField(field?: string | number | null): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Export full family tree graph into a standardized CSV string.
 */
export function exportTreeToCSV(graphData: TreeGraphData): string {
  const lines: string[] = [];

  // Section 1: Persons
  lines.push('# PERSONS');
  lines.push('id,first_name,middle_name,last_name,maiden_name,gender,birth_date,birth_place,is_living,death_date,death_place,bio');

  for (const p of graphData.persons) {
    lines.push([
      escapeCsvField(p.id),
      escapeCsvField(p.first_name),
      escapeCsvField(p.middle_name),
      escapeCsvField(p.last_name),
      escapeCsvField(p.maiden_name),
      escapeCsvField(p.gender),
      escapeCsvField(p.birth_date),
      escapeCsvField(p.birth_place),
      escapeCsvField(p.is_living),
      escapeCsvField(p.death_date),
      escapeCsvField(p.death_place),
      escapeCsvField(p.bio),
    ].join(','));
  }

  lines.push('');

  // Section 2: Unions & Children
  lines.push('# UNIONS');
  lines.push('id,union_type,partner_ids,start_date,start_place,end_date,notes,children');

  for (const u of graphData.unions) {
    const partnerIdsStr = u.partner_ids.join(';');
    const childrenStr = (u.children || [])
      .map((c) => `${c.person_id}:${c.filiation || 'BIOLOGICAL'}:${c.birth_order || 0}`)
      .join(';');

    lines.push([
      escapeCsvField(u.id),
      escapeCsvField(u.union_type),
      escapeCsvField(partnerIdsStr),
      escapeCsvField(u.start_date),
      escapeCsvField(u.start_place),
      escapeCsvField(u.end_date),
      escapeCsvField(u.notes),
      escapeCsvField(childrenStr),
    ].join(','));
  }

  lines.push('');

  // Section 3: Facts
  lines.push('# FACTS');
  lines.push('id,person_id,event_type,title,description,event_date,end_date,date_is_approximate,location_name,relationship_target_name,relationship_status');

  if (graphData.facts && graphData.facts.length > 0) {
    for (const f of graphData.facts) {
      lines.push([
        escapeCsvField(f.id),
        escapeCsvField(f.person_id),
        escapeCsvField(f.event_type),
        escapeCsvField(f.title),
        escapeCsvField(f.description),
        escapeCsvField(f.event_date),
        escapeCsvField(f.end_date),
        escapeCsvField(f.date_is_approximate),
        escapeCsvField(f.location_name),
        escapeCsvField(f.relationship_target_name),
        escapeCsvField(f.relationship_status),
      ].join(','));
    }
  }

  return lines.join('\n');
}

/**
 * Trigger download of CSV in browser.
 */
export function downloadTreeCSV(graphData: TreeGraphData, filename?: string): void {
  const csv = exportTreeToCSV(graphData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename || `family_tree_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ParsedCsvTree {
  persons: Array<{
    id: string;
    first_name: string;
    middle_name?: string;
    last_name?: string;
    maiden_name?: string;
    gender: Gender;
    birth_date?: string;
    birth_place?: string;
    is_living: boolean;
    death_date?: string;
    death_place?: string;
    bio?: string;
  }>;
  unions: Array<{
    id?: string;
    union_type: UnionType;
    partner_ids: string[];
    partner1_id?: string;
    partner2_id?: string;
    children_ids?: string[];
    start_date?: string;
    start_place?: string;
    end_date?: string;
    notes?: string;
    children: Array<{
      person_id: string;
      filiation: FiliationType;
      birth_order: number;
    }>;
  }>;
  facts?: Array<{
    id?: string;
    person_id: string;
    event_type: string;
    title: string;
    description?: string;
    event_date?: string;
    end_date?: string;
    date_is_approximate?: boolean;
    location_name?: string;
    relationship_target_name?: string;
    relationship_status?: string;
  }>;
}

/**
 * Parse CSV text containing persons and unions.
 */
export function parseTreeFromCSV(csvText: string): ParsedCsvTree {
  const lines = csvText.split(/\r?\n/);
  const result: ParsedCsvTree = { persons: [], unions: [] };

  let currentSection: 'PERSONS' | 'UNIONS' | 'FACTS' | 'UNKNOWN' = 'UNKNOWN';
  let personHeaderIndexMap: Record<string, number> = {};
  let unionHeaderIndexMap: Record<string, number> = {};
  let factHeaderIndexMap: Record<string, number> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('# PERSONS')) {
      currentSection = 'PERSONS';
      personHeaderIndexMap = {};
      continue;
    }

    if (line.startsWith('# UNIONS')) {
      currentSection = 'UNIONS';
      unionHeaderIndexMap = {};
      continue;
    }

    if (line.startsWith('# FACTS')) {
      currentSection = 'FACTS';
      factHeaderIndexMap = {};
      continue;
    }

    if (line.startsWith('#')) continue; // comments

    const cols = parseCsvLine(line);

    if (currentSection === 'PERSONS') {
      if (Object.keys(personHeaderIndexMap).length === 0 && cols.includes('first_name')) {
        cols.forEach((col, idx) => {
          personHeaderIndexMap[col.toLowerCase()] = idx;
        });
        continue;
      }

      const getVal = (key: string): string => {
        const idx = personHeaderIndexMap[key];
        return idx !== undefined && cols[idx] ? cols[idx] : '';
      };

      const firstName = getVal('first_name') || cols[1] || 'Unknown';
      const id = getVal('id') || cols[0] || `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const gender = (getVal('gender') || 'UNKNOWN').toUpperCase() as Gender;
      const isLivingStr = getVal('is_living');
      const isLiving = isLivingStr === '' || isLivingStr === '1' || isLivingStr.toLowerCase() === 'true';

      result.persons.push({
        id,
        first_name: firstName,
        middle_name: getVal('middle_name') || undefined,
        last_name: getVal('last_name') || undefined,
        maiden_name: getVal('maiden_name') || undefined,
        gender: ['MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'UNKNOWN'].includes(gender) ? gender : 'UNKNOWN',
        birth_date: getVal('birth_date') || undefined,
        birth_place: getVal('birth_place') || undefined,
        is_living: isLiving,
        death_date: !isLiving ? getVal('death_date') || undefined : undefined,
        death_place: !isLiving ? getVal('death_place') || undefined : undefined,
        bio: getVal('bio') || undefined,
      });
    } else if (currentSection === 'UNIONS') {
      if (Object.keys(unionHeaderIndexMap).length === 0 && cols.includes('union_type')) {
        cols.forEach((col, idx) => {
          unionHeaderIndexMap[col.toLowerCase()] = idx;
        });
        continue;
      }

      const getVal = (key: string): string => {
        const idx = unionHeaderIndexMap[key];
        return idx !== undefined && cols[idx] ? cols[idx] : '';
      };

      const uId = getVal('id') || cols[0] || undefined;
      const uTypeStr = (getVal('union_type') || cols[1] || 'MARRIAGE').toUpperCase();
      const unionType = ['MARRIAGE', 'CIVIL_UNION', 'PARTNERSHIP', 'DIVORCED', 'SEPARATED'].includes(uTypeStr)
        ? (uTypeStr as UnionType)
        : 'MARRIAGE';

      const partnerIdsStr = getVal('partner_ids') || cols[2] || '';
      const partnerIds = partnerIdsStr.split(';').map((p) => p.trim()).filter(Boolean);

      const childrenStr = getVal('children') || cols[7] || '';
      const children = childrenStr
        .split(';')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((item) => {
          const parts = item.split(':');
          return {
            person_id: parts[0],
            filiation: (parts[1] || 'BIOLOGICAL').toUpperCase() as FiliationType,
            birth_order: parseInt(parts[2], 10) || 0,
          };
        });

      result.unions.push({
        id: uId,
        union_type: unionType,
        partner_ids: partnerIds,
        partner1_id: partnerIds[0],
        partner2_id: partnerIds[1],
        children_ids: children.map((c) => c.person_id),
        start_date: getVal('start_date') || undefined,
        start_place: getVal('start_place') || undefined,
        end_date: getVal('end_date') || undefined,
        notes: getVal('notes') || undefined,
        children,
      });
    } else if (currentSection === 'FACTS') {
      if (Object.keys(factHeaderIndexMap).length === 0 && (cols.includes('event_type') || cols.includes('title'))) {
        cols.forEach((col, idx) => {
          factHeaderIndexMap[col.toLowerCase()] = idx;
        });
        continue;
      }

      const getVal = (key: string): string => {
        const idx = factHeaderIndexMap[key];
        return idx !== undefined && cols[idx] ? cols[idx] : '';
      };

      const pId = getVal('person_id') || cols[1];
      if (!pId) continue;

      if (!result.facts) result.facts = [];
      result.facts.push({
        id: getVal('id') || cols[0] || undefined,
        person_id: pId,
        event_type: getVal('event_type') || cols[2] || 'CUSTOM',
        title: getVal('title') || cols[3] || 'Event',
        description: getVal('description') || cols[4] || undefined,
        event_date: getVal('event_date') || cols[5] || undefined,
        end_date: getVal('end_date') || cols[6] || undefined,
        date_is_approximate: getVal('date_is_approximate') === '1' || getVal('date_is_approximate').toLowerCase() === 'true',
        location_name: getVal('location_name') || cols[8] || undefined,
        relationship_target_name: getVal('relationship_target_name') || cols[9] || undefined,
        relationship_status: getVal('relationship_status') || cols[10] || undefined,
      });
    }
  }

  return result;
}

/**
 * Generate a template CSV string for users to easily fill in.
 */
export function getSampleTreeCSV(): string {
  return `# PERSONS
id,first_name,middle_name,last_name,maiden_name,gender,birth_date,birth_place,is_living,death_date,death_place,bio
p_1,Alexander,James,Smith,,MALE,1955-03-20,Chicago IL,1,,,Founder and architect
p_2,Mary,Elizabeth,Smith,Davis,FEMALE,1958-07-14,Springfield IL,1,,,Artist and teacher
p_3,David,Alexander,Smith,,MALE,1984-11-02,Chicago IL,1,,,Engineer and photographer
p_4,Sarah,Jane,Johnson,Smith,FEMALE,1987-05-18,Chicago IL,1,,,Writer and traveler
p_5,Jessica,Anne,Taylor,,FEMALE,1960-09-08,Boston MA,1,,,Former spouse

# UNIONS
id,union_type,partner_ids,start_date,start_place,end_date,notes,children
u_1,MARRIAGE,p_1;p_2,1980-06-21,Chicago IL,,,p_3:BIOLOGICAL:1;p_4:BIOLOGICAL:2
u_2,DIVORCED,p_1;p_5,1976-05-10,Boston MA,1979-11-04,Amicable separation,

# FACTS
id,person_id,event_type,title,description,event_date,end_date,date_is_approximate,location_name,relationship_target_name,relationship_status
evt_1,p_1,GRADUATION,Architecture Degree,Graduated with honors,1978-06-15,,,MIT,Boston MA,
evt_2,p_3,CAREER,Senior Engineer,Promoted to Lead Architect,2015-04-01,,,Tech Corp,Chicago IL,
`;
}
