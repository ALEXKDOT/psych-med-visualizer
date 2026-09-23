import test from "node:test";
import assert from "node:assert/strict";
import {
  DOMAINS, SCHEMA_VERSION, aggregateRelativeBins, createBlankDataset, createDemoDataset,
  domainLabel, filterObservations, formatRelativeHours, getDomains, hoursRelativeToEvent,
  localDateString, localDateTime, median, migrateDataset, recordDates, validateDataset
} from "../src/model.mjs";

function event(overrides = {}) {
  return { id: "event", date: "2026-09-01", time: "08:00", medication: "Example medication", formulation: "Tablet", doseText: "recorded dose", status: "taken", note: "", ...overrides };
}
function observation(overrides = {}) {
  return { id: "observation", date: "2026-09-01", time: "09:00", domain: "attention_focus", score: 4, reporter: "Patient", context: "Home", medicationEventId: "event", note: "", ...overrides };
}
function journal() {
  const dataset = createBlankDataset();
  dataset.medicationEvents.push(event());
  dataset.observations.push(observation());
  return dataset;
}

function errorsAfter(mutator) {
  const dataset = journal();
  mutator(dataset);
  return validateDataset(dataset).join(" ");
}

test("blank and synthetic journals validate with a current schema and seven recorded days", () => {
  assert.equal(SCHEMA_VERSION, "1.0.0");
  assert.deepEqual(validateDataset(createBlankDataset()), []);
  const now = new Date(2026, 8, 23, 17, 25);
  const demo = createDemoDataset(now);
  assert.deepEqual(validateDataset(demo), []);
  assert.equal(recordDates(demo).length, 7);
  assert.equal(recordDates(demo).at(-1), "2026-09-23");
  assert.equal(new Set(demo.observations.map((item) => item.domain)).size, 5);
  assert.equal(new Set(demo.observations.map((item) => item.id)).size, demo.observations.length);
  assert.ok(demo.observations.every((item) => item.date !== localDateString(now) || item.time <= "17:25"));
  assert.ok(demo.medicationEvents.every((item) => item.medication === "Example medication"));
});

test("catalog has broad grouped coverage and explicit endpoints for every metric", () => {
  assert.ok(DOMAINS.length >= 35);
  assert.equal(new Set(DOMAINS.map((item) => item.id)).size, DOMAINS.length);
  assert.deepEqual(new Set(DOMAINS.map((item) => item.group)), new Set(["Attention & thinking", "Mood & emotions", "Energy & sleep", "Physical & appetite"]));
  assert.ok(DOMAINS.every((item) => item.lowLabel && item.highLabel && /^#[0-9A-F]{6}$/i.test(item.color)));
  assert.equal(DOMAINS.find((item) => item.id === "attention_focus").highLabel, "Very focused");
  assert.equal(DOMAINS.find((item) => item.id === "sedation_fatigue").highLabel, "Severe fatigue");
});

test("calculates relative time across midnight and supports pre-dose observations", () => {
  assert.equal(hoursRelativeToEvent({ date: "2026-09-02", time: "08:00" }, { date: "2026-09-01", time: "20:00" }), 12);
  assert.equal(hoursRelativeToEvent(observation({ time: "07:30" }), event()), -0.5);
  assert.equal(hoursRelativeToEvent(null, event()), null);
  assert.equal(hoursRelativeToEvent(observation({ date: "2026-02-30" }), event()), null);
});

test("relative timestamps reject normalized dates and invalid wall times", () => {
  for (const date of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-09-00", "2026-9-01", "text"]) assert.equal(localDateTime(date, "08:00"), null);
  for (const time of ["24:00", "12:60", "-1:00", "8:00", "08:00:00", null]) assert.equal(localDateTime("2026-09-01", time), null);
  assert.ok(localDateTime("2024-02-29", "08:00") instanceof Date);
  assert.equal(localDateString(new Date(2026, 0, 2, 23, 30)), "2026-01-02");
  assert.throws(() => localDateString(new Date("invalid")), /valid date/);
});

test("formats observations before and after an event", () => {
  assert.equal(formatRelativeHours(-0.5), "0.5 h before");
  assert.equal(formatRelativeHours(2.25), "2.3 h after");
  assert.equal(formatRelativeHours(0), "At event time");
  assert.equal(formatRelativeHours(null), "Not linked");
  assert.equal(formatRelativeHours(Infinity), "Not linked");
});

test("median handles odd and even values without mutating its input", () => {
  const input = [7, 2, 4];
  assert.equal(median(input), 4);
  assert.deepEqual(input, [7, 2, 4]);
  assert.equal(median([1, 3, 6, 8]), 4.5);
  assert.equal(median([]), null);
});

test("relative bins exclude missed, unlinked, and out-of-window observations", () => {
  const dataset = createBlankDataset();
  dataset.medicationEvents = [event({ id: "taken" }), event({ id: "missed", date: "2026-09-02", status: "missed" })];
  const observations = [
    observation({ id: "a", time: "09:00", score: 6, medicationEventId: "taken" }),
    observation({ id: "b", time: "09:30", score: 2, medicationEventId: "taken" }),
    observation({ id: "c", date: "2026-09-02", score: 9, medicationEventId: "missed" }),
    observation({ id: "d", score: 10, medicationEventId: "" }),
    observation({ id: "e", date: "2026-09-04", score: 10, medicationEventId: "taken" })
  ];
  const bins = aggregateRelativeBins(dataset, observations, 2);
  assert.equal(bins.length, 1);
  assert.deepEqual({ n: bins[0].n, median: bins[0].median, min: bins[0].min, max: bins[0].max }, { n: 2, median: 4, min: 2, max: 6 });
  assert.throws(() => aggregateRelativeBins(dataset, observations, 0), /positive/);
});

test("day filtering uses recorded dates rather than the system clock", () => {
  const dataset = createBlankDataset();
  dataset.observations = Array.from({ length: 10 }, (_, index) => observation({ id: String(index), date: `2026-09-${String(index + 1).padStart(2, "0")}`, medicationEventId: "" }));
  assert.equal(filterObservations(dataset, "attention_focus", "7").length, 7);
  assert.equal(filterObservations(dataset, "attention_focus", "all").length, 10);
  assert.equal(filterObservations(dataset, "attention_focus", "bad").length, 0);
  assert.equal(filterObservations(dataset, "attention_focus", "0").length, 0);
});

test("recorded-day windows include medication-only days", () => {
  const dataset = createBlankDataset();
  dataset.observations = [observation({ medicationEventId: "" })];
  dataset.medicationEvents = Array.from({ length: 7 }, (_, index) => event({ id: `event-${index}`, date: `2026-09-${String(index + 2).padStart(2, "0")}` }));
  assert.equal(recordDates(dataset).length, 8);
  assert.equal(filterObservations(dataset, "attention_focus", "7").length, 0);
});

test("validates strict numeric integer scores on a 1–10 scale", () => {
  assert.deepEqual(validateDataset(journal()), []);
  for (const score of [0, 11, -1, 3.5, "4", true, null, [], {}]) assert.match(errorsAfter((data) => { data.observations[0].score = score; }), /outside 1–10/);
  for (const score of [1, 10]) assert.equal(errorsAfter((data) => { data.observations[0].score = score; }), "");
});

test("validates exact dates, times and timestamp metadata", () => {
  assert.match(errorsAfter((data) => { data.medicationEvents[0].date = "2026-02-30"; }), /invalid date/);
  assert.match(errorsAfter((data) => { data.observations[0].time = "24:00"; }), /invalid time/);
  assert.match(errorsAfter((data) => { data.createdAt = "yesterday"; }), /UTC ISO timestamp/);
  assert.match(errorsAfter((data) => { data.updatedAt = "2026-02-30T10:00:00.000Z"; }), /UTC ISO timestamp/);
});

test("requires medication, formulation, and dose on every event", () => {
  for (const key of ["medication", "formulation", "doseText"]) {
    assert.match(errorsAfter((data) => { data.medicationEvents[0][key] = " "; }), new RegExp(key));
    assert.match(errorsAfter((data) => { delete data.medicationEvents[0][key]; }), new RegExp(key));
  }
});

test("validates unique identifiers, links, domain references, and medication status", () => {
  assert.match(errorsAfter((data) => { data.medicationEvents.push({ ...data.medicationEvents[0] }); }), /duplicates/);
  assert.match(errorsAfter((data) => { data.observations.push({ ...data.observations[0] }); }), /duplicates/);
  assert.match(errorsAfter((data) => { data.observations[0].medicationEventId = "missing"; }), /missing medication event/);
  assert.match(errorsAfter((data) => { data.observations[0].medicationEventId = {}; }), /medication link/);
  assert.match(errorsAfter((data) => { data.observations[0].domain = "invented"; }), /unsupported domain/);
  assert.match(errorsAfter((data) => { data.medicationEvents[0].status = "invented"; }), /unsupported status/);
  assert.match(errorsAfter((data) => { data.observations[0].id = '<img src="x">'; }), /invalid identifier/);
});

test("custom symptoms are discoverable and validated without accepting unsafe chart colors", () => {
  const dataset = journal();
  const custom = { id: "custom_reading", label: "Reading ease", group: "Custom", kind: "custom", lowLabel: "Very hard", highLabel: "Very easy", color: "#123ABC" };
  dataset.customDomains = [custom];
  dataset.observations[0].domain = custom.id;
  assert.deepEqual(validateDataset(dataset), []);
  assert.equal(getDomains(dataset).length, DOMAINS.length + 1);
  assert.equal(domainLabel(custom.id, dataset), "Reading ease");
  custom.color = "url(javascript:bad)";
  assert.match(validateDataset(dataset).join(" "), /hex color/);
  custom.color = "#123ABC";
  custom.id = "attention_focus";
  assert.match(validateDataset(dataset).join(" "), /duplicates/);
});

test("hostile or malformed JSON is rejected without throwing", () => {
  for (const candidate of [null, [], "text", 123, {}, { patient: null }, { schemaVersion: "99.0.0" }]) {
    assert.doesNotThrow(() => validateDataset(candidate));
    assert.ok(validateDataset(candidate).length > 0);
  }
  for (const key of ["__proto__", "constructor", "prototype"]) {
    const candidate = JSON.parse(JSON.stringify(journal()));
    candidate.extra = JSON.parse(`{"${key}": {"polluted": true}}`);
    assert.match(validateDataset(candidate).join(" "), /unsafe object key/);
  }
  for (const name of ["observations", "medicationEvents", "customDomains"]) assert.match(errorsAfter((data) => { data[name] = [null]; }), /not a record object/);
  const cyclic = journal(); cyclic.extra = cyclic;
  assert.match(validateDataset(cyclic).join(" "), /circular/);
  const withGetter = journal();
  Object.defineProperty(withGetter, "extra", { enumerable: true, get() { throw new Error("must not execute"); } });
  assert.match(validateDataset(withGetter).join(" "), /plain JSON/);
  assert.equal({}.polluted, undefined);
});

test("migration preserves episode metadata per event and records legacy score adjustments", () => {
  const legacy = journal();
  legacy.schemaVersion = "0.1.0";
  delete legacy.customDomains;
  legacy.episode = { ...legacy.episode, medication: "Historical medication", formulation: "Historical formulation", doseText: "Historical recorded dose" };
  legacy.medicationEvents = [{ id: "event", date: "2026-09-01", time: "08:00", status: "taken" }, { id: "second", date: "2026-09-02", time: "08:00", status: "taken" }];
  legacy.observations[0].score = 0;
  legacy.observations[0].note = "Original note.";
  const original = JSON.stringify(legacy);
  const migrated = migrateDataset(legacy);
  assert.equal(JSON.stringify(legacy), original, "migration must not mutate the source");
  assert.equal(migrated.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(validateDataset(migrated), []);
  assert.ok(migrated.medicationEvents.every((item) => item.medication === "Historical medication" && item.formulation === "Historical formulation" && item.doseText === "Historical recorded dose"));
  assert.equal(migrated.observations[0].score, 1);
  assert.match(migrated.observations[0].note, /Original note\./);
  assert.match(migrated.observations[0].note, /original score 0/);
  assert.equal(migrated.observations[0].domain, "legacy_focus_difficulty");
  assert.equal(domainLabel(migrated.observations[0].domain, migrated), "Focus difficulty (legacy)");
  assert.ok(migrated.migrationNotes.some((note) => note.includes("higher was worse")));
});

test("migration preserves ordinary legacy scores and explicitly fills missing historical metadata", () => {
  const legacy = journal();
  legacy.schemaVersion = "0.1.0";
  legacy.episode.formulation = "";
  legacy.episode.doseText = "";
  legacy.observations[0].score = "7";
  const migrated = migrateDataset(legacy);
  assert.equal(migrated.observations[0].score, 7);
  assert.equal(migrated.medicationEvents[0].formulation, "Not recorded (legacy)");
  assert.equal(migrated.medicationEvents[0].doseText, "Not recorded (legacy)");
});

test("migration validates current backups, clones accepted data, and rejects unsupported or broken records", () => {
  const dataset = journal();
  const migrated = migrateDataset(dataset);
  assert.deepEqual(migrated, dataset);
  assert.notEqual(migrated, dataset);
  assert.notEqual(migrated.observations[0], dataset.observations[0]);
  assert.throws(() => migrateDataset({ ...dataset, schemaVersion: "99.0.0" }), /Unsupported schema/);
  assert.throws(() => migrateDataset({ ...dataset, observations: [observation({ medicationEventId: "missing" })] }), /missing medication event/);
  assert.throws(() => migrateDataset(null), /not a record object/);
});
