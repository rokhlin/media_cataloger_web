import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  exportTreeToCSV,
  parseTreeFromCSV,
  getSampleTreeCSV,
} from '../csvTreeService.js';
import type { TreeGraphData } from '../../types/tree.types.js';

describe('Family Tree csvTreeService', () => {
  const mockGraphData: TreeGraphData = {
    tree: {
      id: 'tree_1',
      name: 'Smith Family Tree',
      living_privacy_mode: 'SHOW_ALL',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    root_person_id: 'p1',
    persons: [
      {
        id: 'p1',
        tree_id: 'tree_1',
        first_name: 'John',
        last_name: 'Smith',
        full_name: 'John Smith',
        gender: 'MALE',
        birth_date: '1960-05-15',
        birth_place: 'Chicago, IL',
        is_living: 1,
        bio: 'Father of two',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 'p2',
        tree_id: 'tree_1',
        first_name: 'Mary',
        last_name: 'Smith',
        maiden_name: 'Doe',
        full_name: 'Mary Smith',
        gender: 'FEMALE',
        birth_date: '1962-08-20',
        birth_place: 'Boston, MA',
        is_living: 1,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 'p3',
        tree_id: 'tree_1',
        first_name: 'Alice',
        last_name: 'Smith',
        full_name: 'Alice Smith',
        gender: 'FEMALE',
        birth_date: '1990-03-10',
        is_living: 1,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ],
    unions: [
      {
        id: 'u1',
        tree_id: 'tree_1',
        union_type: 'MARRIAGE',
        partner_ids: ['p1', 'p2'],
        children: [{ person_id: 'p3', filiation: 'BIOLOGICAL', birth_order: 1 }],
        start_date: '1988-06-25',
        start_place: 'New York, NY',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ],
    facts: [
      {
        id: 'evt_1',
        person_id: 'p1',
        event_type: 'GRADUATION',
        title: 'Master of Science',
        description: 'Computer Science degree',
        event_date: '1982-06-10',
        date_is_approximate: 0,
        is_system_generated: 0,
        location_name: 'Chicago, IL',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 'evt_2',
        person_id: 'p3',
        event_type: 'CAREER',
        title: 'Senior Software Engineer',
        description: 'Joined Tech Solutions',
        event_date: '2014-09-01',
        date_is_approximate: 0,
        is_system_generated: 0,
        location_name: 'San Francisco, CA',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ],
  };

  it('exports graph data to CSV text containing persons and unions headers and data', () => {
    const csv = exportTreeToCSV(mockGraphData);
    assert.ok(csv.includes('# PERSONS'));
    assert.ok(csv.includes('# UNIONS'));
    assert.ok(csv.includes('# FACTS'));
    assert.ok(csv.includes('John,,Smith,,MALE,1960-05-15'));
    assert.ok(csv.includes('Mary,,Smith,Doe,FEMALE,1962-08-20'));
    assert.ok(csv.includes('MARRIAGE,p1;p2,1988-06-25'));
    assert.ok(csv.includes('evt_1,p1,GRADUATION,Master of Science'));
    assert.ok(csv.includes('evt_2,p3,CAREER,Senior Software Engineer'));
  });

  it('parses exported CSV back into persons and unions', () => {
    const csv = exportTreeToCSV(mockGraphData);
    const parsed = parseTreeFromCSV(csv);

    assert.strictEqual(parsed.persons.length, 3);
    assert.strictEqual(parsed.unions.length, 1);
    assert.ok(parsed.facts);
    assert.strictEqual(parsed.facts?.length, 2);

    const fact1 = parsed.facts?.find((f) => f.id === 'evt_1');
    assert.ok(fact1);
    assert.strictEqual(fact1?.person_id, 'p1');
    assert.strictEqual(fact1?.event_type, 'GRADUATION');
    assert.strictEqual(fact1?.title, 'Master of Science');

    const john = parsed.persons.find((p) => p.first_name === 'John');
    assert.ok(john);
    assert.strictEqual(john?.last_name, 'Smith');
    assert.strictEqual(john?.gender, 'MALE');
    assert.strictEqual(john?.birth_date, '1960-05-15');

    const union = parsed.unions[0];
    assert.strictEqual(union.partner1_id, 'p1');
    assert.strictEqual(union.partner2_id, 'p2');
    assert.ok(union.children_ids);
    assert.strictEqual(union.children_ids.length, 1);
    assert.strictEqual(union.children_ids[0], 'p3');
    assert.strictEqual(union.union_type, 'MARRIAGE');
  });

  it('parses sample CSV template without errors', () => {
    const sample = getSampleTreeCSV();
    const parsed = parseTreeFromCSV(sample);
    assert.ok(parsed.persons.length >= 4);
    assert.ok(parsed.unions.length >= 1);
    assert.ok(parsed.facts && parsed.facts.length >= 2);
  });
});
