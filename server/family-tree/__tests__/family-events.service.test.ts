import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { FamilyTreeDatabaseService } from '../family-tree-db.service.js';
import { FamilyTreeService } from '../family-tree.service.js';
import { GraphIntegrityService } from '../graph-integrity.service.js';
import { FamilyEventsService } from '../family-events.service.js';

describe('FamilyEventsService', () => {
  let dbService: FamilyTreeDatabaseService;
  let eventsService: FamilyEventsService;
  let treeService: FamilyTreeService;
  let dbPath: string;
  let treeId: string;

  before(() => {
    const tmpDir = path.join(process.cwd(), 'media_output');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    dbPath = path.join(tmpDir, `test_events_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.db`);

    dbService = new FamilyTreeDatabaseService({ familyTreeDbPath: dbPath } as any);
    const integrityService = new GraphIntegrityService(dbService);
    eventsService = new FamilyEventsService(dbService);
    treeService = new FamilyTreeService(dbService, integrityService, eventsService);

    const createdTree = treeService.createTree({ name: 'Events Test Tree' });
    treeId = createdTree.id;
  });

  after(() => {
    try {
      dbService.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      const wal = `${dbPath}-wal`;
      const shm = `${dbPath}-shm`;
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch {
      // ignore
    }
  });

  it('should auto-propagate BIRTH and DEATH system events upon person creation and update', () => {
    const person = treeService.createPerson({
      tree_id: treeId,
      first_name: 'William',
      last_name: 'Shakespeare',
      gender: 'MALE',
      birth_date: '1564-04-26',
      birth_place: 'Stratford-upon-Avon',
      is_living: false,
      death_date: '1616-04-23',
      death_place: 'Stratford-upon-Avon',
    });

    const timeline = eventsService.getPersonTimeline(person.id);
    const birthEvent = timeline.find((e) => e.event_type === 'BIRTH');
    const deathEvent = timeline.find((e) => e.event_type === 'DEATH');

    assert.ok(birthEvent, 'Birth event should be auto-created');
    assert.strictEqual(birthEvent?.event_date, '1564-04-26');
    assert.strictEqual(birthEvent?.location_name, 'Stratford-upon-Avon');
    assert.strictEqual(birthEvent?.is_system_generated, 1);

    assert.ok(deathEvent, 'Death event should be auto-created');
    assert.strictEqual(deathEvent?.event_date, '1616-04-23');
    assert.strictEqual(deathEvent?.is_system_generated, 1);
  });

  it('should auto-propagate MARRIAGE and DIVORCE events to all union partners', () => {
    const husband = treeService.createPerson({ tree_id: treeId, first_name: 'Henry', gender: 'MALE', is_living: true });
    const wife = treeService.createPerson({ tree_id: treeId, first_name: 'Catherine', gender: 'FEMALE', is_living: true });

    const union = treeService.createUnion({
      tree_id: treeId,
      partner_ids: [husband.id, wife.id],
      union_type: 'MARRIAGE',
      start_date: '1509-06-11',
      start_place: 'Greenwich',
    });

    // Check Marriage propagated to husband
    const husbandTimeline = eventsService.getPersonTimeline(husband.id);
    const hMarriage = husbandTimeline.find((e) => e.event_type === 'MARRIAGE');
    assert.ok(hMarriage, 'Husband receives marriage event');
    assert.strictEqual(hMarriage?.event_date, '1509-06-11');
    assert.strictEqual(hMarriage?.location_name, 'Greenwich');

    // Check Marriage propagated to wife
    const wifeTimeline = eventsService.getPersonTimeline(wife.id);
    const wMarriage = wifeTimeline.find((e) => e.event_type === 'MARRIAGE');
    assert.ok(wMarriage, 'Wife receives marriage event');

    // Now update union to DIVORCED
    treeService.updateUnion(union.id, {
      union_type: 'DIVORCED',
      end_date: '1533-05-23',
    });

    const updatedHusbandTimeline = eventsService.getPersonTimeline(husband.id);
    const divorceEvt = updatedHusbandTimeline.find((e) => e.event_type === 'DIVORCE');
    assert.ok(divorceEvt, 'Husband receives divorce event');
    assert.strictEqual(divorceEvt?.event_date, '1533-05-23');
  });

  it('should auto-propagate CHILD_BORN milestone to both parents when a child is added to union', () => {
    const dad = treeService.createPerson({ tree_id: treeId, first_name: 'Dad', gender: 'MALE', is_living: true });
    const mom = treeService.createPerson({ tree_id: treeId, first_name: 'Mom', gender: 'FEMALE', is_living: true });
    const union = treeService.createUnion({ tree_id: treeId, partner_ids: [dad.id, mom.id], union_type: 'MARRIAGE' });

    const baby = treeService.createPerson({
      tree_id: treeId,
      first_name: 'Baby',
      last_name: 'Johnson',
      gender: 'FEMALE',
      birth_date: '2020-01-15',
      birth_place: 'New York',
      is_living: true,
    });

    treeService.addChildToUnion(union.id, { person_id: baby.id, filiation: 'BIOLOGICAL' });

    // Check dad received child born event
    const dadTimeline = eventsService.getPersonTimeline(dad.id);
    const dadChildBorn = dadTimeline.find((e) => e.event_type === 'CHILD_BORN');
    assert.ok(dadChildBorn, 'Dad receives CHILD_BORN milestone');
    assert.strictEqual(dadChildBorn?.event_date, '2020-01-15');
    assert.ok(dadChildBorn?.title.includes('Baby'), 'Event title names the child');

    // Check mom received child born event
    const momTimeline = eventsService.getPersonTimeline(mom.id);
    const momChildBorn = momTimeline.find((e) => e.event_type === 'CHILD_BORN');
    assert.ok(momChildBorn, 'Mom receives CHILD_BORN milestone');
  });

  it('should support manual Life Facts CRUD and Gallery Photo Pinning', () => {
    const person = treeService.createPerson({ tree_id: treeId, first_name: 'Scholar', gender: 'FEMALE', is_living: true });

    // Create Fact
    const fact = eventsService.createEvent(person.id, {
      event_type: 'GRADUATION',
      title: 'Ph.D. in Computer Science',
      description: 'Graduated summa cum laude with thesis on distributed graphs',
      event_date: '2015-06-12',
      date_is_approximate: false,
      location_name: 'Stanford University',
      latitude: 37.4275,
      longitude: -122.1697,
    });

    assert.ok(fact.id, 'Fact should have an ID');
    assert.strictEqual(fact.is_system_generated, 0);

    // Pin 2 gallery photos to fact
    const pin1 = eventsService.pinMediaToEvent(fact.id, {
      media_file_path: '/photos/stanford_graduation_1.jpg',
      caption: 'Holding diploma on stage',
      display_order: 1,
    });

    const pin2 = eventsService.pinMediaToEvent(fact.id, {
      media_file_path: '/photos/stanford_graduation_2.jpg',
      caption: 'Celebration with family',
      display_order: 2,
    });

    assert.ok(pin1.id && pin2.id, 'Pins created successfully');

    // Retrieve timeline with pinned photos
    const timeline = eventsService.getPersonTimeline(person.id);
    const retrievedFact = timeline.find((e) => e.id === fact.id);
    assert.ok(retrievedFact, 'Found created fact in timeline');
    assert.strictEqual(retrievedFact?.pinned_media?.length, 2, 'Fact should have 2 pinned photos');

    // Unpin one photo
    eventsService.unpinMedia(pin1.id);
    const updatedTimeline = eventsService.getPersonTimeline(person.id);
    const updatedFact = updatedTimeline.find((e) => e.id === fact.id);
    assert.strictEqual(updatedFact?.pinned_media?.length, 1, 'Fact should have 1 pinned photo remaining');

    // Delete fact
    eventsService.deleteEvent(fact.id);
    const finalTimeline = eventsService.getPersonTimeline(person.id);
    assert.ok(!finalTimeline.some((e) => e.id === fact.id), 'Fact should be deleted');
  });
});
