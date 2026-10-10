import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankDataset, createDemoDataset, saveCheckIn, getCheckIns, deleteCheckIn, removeMedicationEvent, resolveCheckInTime, reviewCoverage, validateDataset, localDateString } from '../src/model.mjs';
import { darkenColor } from '../src/charts.mjs';
import { DOMAINS } from '../src/model.mjs';
const details = { date: '2026-10-10', time: '09:15', reporter: 'Patient', context: 'Work', note: '', sleepHours: null };
const ratings = () => new Map([['attention_focus', 6], ['task_initiation', 4]]);

test('separate submissions at the same time stay distinct; editing a group retains rating IDs', () => {
  const data = createBlankDataset();
  const first = saveCheckIn(data, ratings(), details);
  const second = saveCheckIn(data, ratings(), details);
  assert.notEqual(first, second);
  assert.equal(getCheckIns(data).length, 2);
  const ids = data.observations.filter(o => o.checkInId === first).map(o => o.id);
  saveCheckIn(data, new Map([['attention_focus', 8], ['task_initiation', 2]]), { ...details, note: 'Shared note', time: '10:00', sleepHours: 7.5, sleepQuality: 'Fair', circumstances: 'Quiet room' }, first);
  assert.deepEqual(data.observations.filter(o => o.checkInId === first).map(o => o.id), ids);
  assert.ok(data.observations.filter(o => o.checkInId === first).every(o => o.note === 'Shared note' && o.time === '10:00'));
  assert.equal(getCheckIns(data).find(c => c.id === second).time, '09:15');
  assert.deepEqual(validateDataset(data), []);
});

test('a note-only check-in contributes to coverage without adding fabricated ratings', () => {
  const data = createBlankDataset();
  const id = saveCheckIn(data, new Map(), { ...details, note: 'Started after moving to a quiet room.' });
  assert.equal(data.observations.length, 0);
  assert.equal(getCheckIns(data)[0].ratings.length, 0);
  assert.deepEqual(reviewCoverage(data, '2026-10-09', '2026-10-11'), { days: 3, recorded: 1, missing: 2, checkIns: 1, ratings: 0 });
  assert.deepEqual(validateDataset(data), []);
  saveCheckIn(data, ratings(), { ...details, pinned: true }, id);
  assert.equal(getCheckIns(data)[0].ratings.length, 2);
  saveCheckIn(data, new Map(), { ...details, note: 'Still a note' }, id);
  assert.equal(data.observations.length, 0);
  assert.equal(getCheckIns(data)[0].pinned, true);
  deleteCheckIn(data, id);
  assert.equal(getCheckIns(data).length, 0);
});

test('deleting medication removes group and rating links without deleting the check-in', () => {
  const data = createBlankDataset();
  data.medicationEvents.push({ id: 'med', date: details.date, time: '08:00', medication: 'Example', formulation: 'Tablet', doseText: 'Example dose', status: 'taken', note: '' });
  saveCheckIn(data, ratings(), { ...details, link: 'med' });
  removeMedicationEvent(data, 'med');
  assert.equal(data.checkIns[0].medicationEventId, '');
  assert.ok(data.observations.every(o => o.medicationEventId === ''));
  assert.equal(data.observations.length, 2);
  assert.deepEqual(validateDataset(data), []);
});

test('Now resolves at recording time, including midnight; explicit earlier times are preserved', () => {
  const draft = { date: '2026-10-09', time: '08:00', timeMode: 'now' };
  const now = new Date(2026, 9, 10, 0, 12);
  assert.deepEqual(resolveCheckInTime(draft, now), { date: '2026-10-10', time: '00:12' });
  assert.deepEqual(resolveCheckInTime({ ...draft, timeMode: 'earlier' }, now), { date: '2026-10-09', time: '08:00' });
});

test('unidentified legacy records remain separate even with identical time and context', () => {
  const data = createBlankDataset();
  saveCheckIn(data, ratings(), details);
  data.observations.forEach(o => delete o.checkInId); data.checkIns = [];
  assert.equal(getCheckIns(data).length, 2);
  const first = getCheckIns(data)[0];
  saveCheckIn(data, new Map([[first.domain, 5]]), { ...first, note: 'Updated' }, first.id);
  assert.equal(getCheckIns(data).length, 2);
  assert.deepEqual(validateDataset(data), []);
});

test('group validation rejects broken membership, repeated domains, inconsistent metadata and empty entries', () => {
  const data = createBlankDataset(); saveCheckIn(data, ratings(), details);
  for (const mutate of [
    d => { d.observations[0].checkInId = 'absent'; },
    d => { d.observations[0].time = '11:00'; },
    d => { d.observations[1].domain = d.observations[0].domain; },
    d => { d.observations = []; },
    d => { d.checkIns[0].sleepHours = -1; },
    d => { d.checkIns[0].sleepQuality = 'Invented'; },
    d => { d.checkIns.push({ ...d.checkIns[0] }); }
  ]) { const copy = structuredClone(data); mutate(copy); assert.ok(validateDataset(copy).length); }
});

test('sample history demonstrates irregular sparse entries, a missed day and optional ratings', () => {
  const now = new Date(2026, 9, 10, 6, 15), data = createDemoDataset(now);
  assert.deepEqual(validateDataset(data), []);
  const history = data.checkIns.filter(c => c.date < '2026-10-10');
  assert.ok(history.length > 0 && history.length < 20);
  assert.ok(getCheckIns(data).some(c => c.date < '2026-10-10' && c.ratings.length === 2));
  assert.ok(data.checkIns.some(c => c.pinned && c.note));
  assert.ok(reviewCoverage(data, '2026-10-04', '2026-10-10').missing >= 1);
});

test('every built-in chart stroke exceeds 3:1 contrast on the plot background', () => {
  const luminance = hex => hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
  const paper = luminance('#fbf8ef');
  for (const domain of DOMAINS) assert.ok((paper + .05) / (luminance(darkenColor(domain.color)) + .05) >= 3, domain.label);
});


test('opening the demo at any hour provides a complete current day; blank sessions remain empty', () => {
  for (let hour = 0; hour < 24; hour++) {
    const now = new Date(2026, 9, 10, hour, 0);
    const data = createDemoDataset(now);
    const today = localDateString(now);
    const checkIns = getCheckIns(data).filter(c => c.date === today);
    assert.equal(checkIns.length, 8, `Full sample day at ${hour}:00`);
    assert.equal(checkIns[0].time, '07:30');
    assert.equal(checkIns.at(-1).time, '22:00');
    assert.ok(checkIns.every(c => c.ratings.length === 5));
    assert.ok(checkIns.some(c => c.note && c.pinned));
    assert.ok(data.medicationEvents.some(e => e.date === today));
    assert.deepEqual(validateDataset(data), []);
  }
  const blank = createBlankDataset();
  assert.deepEqual(blank.checkIns, []);
  assert.deepEqual(blank.observations, []);
  assert.deepEqual(blank.medicationEvents, []);
});
