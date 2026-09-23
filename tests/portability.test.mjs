import test from "node:test";
import assert from "node:assert/strict";
import { createBlankDataset, getDomains } from "../src/model.mjs";
import { datasetToCSV, downloadFile } from "../src/portability.mjs";

const columns = [
  "type", "date", "time", "variable", "score", "medication", "formulation",
  "dose", "status", "reporter", "context", "linked_event_id", "notes"
];

// Read fields independently, including commas, doubled quotes, and embedded CRLF.
function parseCSV(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (!quoted && character === ",") {
      row.push(field);
      field = "";
    } else if (!quoted && character === "\r" && csv[index + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index += 1;
    } else field += character;
  }
  assert.equal(quoted, false, "CSV contains a complete quoted field");
  assert.deepEqual(row, [], "CSV ends at a complete row");
  assert.equal(field, "");
  return rows;
}

function csvRecords(dataset, options) {
  const [header, ...rows] = parseCSV(datasetToCSV(dataset, options));
  assert.deepEqual(header, columns);
  return rows.map((row) => {
    assert.equal(row.length, columns.length);
    return Object.fromEntries(columns.map((name, index) => [name, row[index]]));
  });
}

function observation(overrides = {}) {
  return {
    id: "observation", date: "2026-09-23", time: "09:00", domain: "attention_focus",
    score: 6, reporter: "Patient", context: "Home", medicationEventId: "", note: "",
    ...overrides
  };
}

function event(overrides = {}) {
  return {
    id: "event", date: "2026-09-23", time: "08:00", status: "taken",
    medication: "Recorded medication", formulation: "Extended release", doseText: "10 mg",
    note: "", ...overrides
  };
}

test("empty CSV has the complete header and a CRLF terminator", () => {
  assert.equal(datasetToCSV(createBlankDataset()), `${columns.join(",")}\r\n`);
});

test("all observations and medication events are chronological with stable ties", () => {
  const dataset = createBlankDataset();
  dataset.medicationEvents = [
    event({ id: "late", time: "18:00", status: "missed" }),
    event({ id: "same-1", time: "09:00", status: "partial" }),
    event({ id: "same-2", time: "09:00", status: "unknown" })
  ];
  dataset.observations = [
    observation({ id: "next-day", date: "2026-09-24", time: "00:00", note: "next-day" }),
    observation({ id: "tie-a", note: "tie-a" }),
    observation({ id: "earliest", time: "00:00", note: "earliest" }),
    observation({ id: "tie-b", note: "tie-b" })
  ];
  const original = JSON.stringify(dataset);
  const records = csvRecords(dataset);
  assert.deepEqual(records.map((record) => record.notes || record.linked_event_id), [
    "earliest", "same-1", "same-2", "tie-a", "tie-b", "late", "next-day"
  ]);
  assert.deepEqual(records.filter((record) => record.type === "medication").map((record) => record.status), [
    "partial", "unknown", "missed"
  ]);
  assert.equal(JSON.stringify(dataset), original, "export does not mutate the journal");
});

test("explicit links include medication facts; unlinked observations stay unassociated", () => {
  const dataset = createBlankDataset();
  dataset.episode = { medication: "Current default", formulation: "Current form", doseText: "Current dose" };
  dataset.medicationEvents = [
    event({ id: "explicit", reporter: "Caregiver", context: "Breakfast", note: "Recorded event" }),
    { id: "missing-details", date: "2026-09-23", time: "07:00", status: "taken" }
  ];
  dataset.observations = [
    observation({ id: "linked", medicationEventId: "explicit" }),
    observation({ id: "missing-linked", time: "09:01", medicationEventId: "missing-details" }),
    observation({ id: "unlinked", time: "09:02" })
  ];
  const rows = csvRecords(dataset);
  const recordedEvent = rows.find((row) => row.type === "medication" && row.linked_event_id === "explicit");
  assert.deepEqual(recordedEvent, {
    type: "medication", date: "2026-09-23", time: "08:00", variable: "", score: "",
    medication: "Recorded medication", formulation: "Extended release", dose: "10 mg", status: "taken",
    reporter: "Caregiver", context: "Breakfast", linked_event_id: "explicit", notes: "Recorded event"
  });
  const observations = rows.filter((row) => row.type === "observation");
  assert.equal(observations[0].variable, getDomains(dataset).find(({ id }) => id === "attention_focus").label);
  assert.equal(observations[0].medication, "Recorded medication");
  assert.equal(observations[0].dose, "10 mg");
  for (const field of ["medication", "formulation", "dose"]) {
    assert.equal(observations[1][field], "", `${field} is never inferred from current defaults`);
  }
  for (const field of ["medication", "formulation", "dose", "status", "linked_event_id"]) {
    assert.equal(observations[2][field], "", `${field} is empty without an explicit link`);
  }
});

test("date filters are inclusive, allow open ends, and retain facts for links outside the range", () => {
  const dataset = createBlankDataset();
  dataset.medicationEvents = [event({ date: "2026-09-22", time: "23:00" })];
  dataset.observations = [
    observation({ date: "2026-09-22", time: "23:59" }),
    observation({ date: "2026-09-23", time: "00:00", medicationEventId: "event" }),
    observation({ date: "2026-09-24", time: "23:59" }),
    observation({ date: "2026-09-25", time: "00:00" })
  ];
  const bounded = csvRecords(dataset, { startDate: "2026-09-23", endDate: "2026-09-24" });
  assert.deepEqual(bounded.map(({ date }) => date), ["2026-09-23", "2026-09-24"]);
  assert.equal(bounded[0].medication, "Recorded medication");
  assert.equal(csvRecords(dataset, { endDate: "2026-09-22" }).length, 2);
  assert.equal(csvRecords(dataset, { startDate: "2026-09-24" }).length, 2);
  assert.equal(csvRecords(dataset, { startDate: "2026-09-24", endDate: "2026-09-23" }).length, 0);
});

test("CSV preserves commas, quotes, Unicode, and multiline journal notes", () => {
  const dataset = createBlankDataset();
  const note = 'Morning, "focused"\r\nAfternoon: café\nEvening: calm';
  dataset.observations = [observation({ note, context: 'Home, "desk"', reporter: "José" })];
  const [row] = csvRecords(dataset);
  assert.equal(row.notes, note);
  assert.equal(row.context, 'Home, "desk"');
  assert.equal(row.reporter, "José");
  assert.match(datasetToCSV(dataset), /"Morning, ""focused""\r\n/);
});

test("custom symptom labels are exported and receive the same formula protection", () => {
  const dataset = createBlankDataset();
  dataset.customDomains = [
    { id: "custom_reading", label: "Reading, sustained focus", lowLabel: "Difficult", highLabel: "Easy", group: "Custom", kind: "custom", color: "#123456" },
    { id: "custom_payload", label: " =HYPERLINK(A1)", lowLabel: "Low", highLabel: "High", group: "Custom", kind: "custom", color: "#123456" }
  ];
  dataset.observations = [
    observation({ domain: "custom_reading" }),
    observation({ domain: "custom_payload" })
  ];
  assert.deepEqual(csvRecords(dataset).map(({ variable }) => variable), [
    "Reading, sustained focus", "' =HYPERLINK(A1)"
  ]);
});

test("spreadsheet formula payloads and leading tabs/control characters are neutralized", () => {
  const dataset = createBlankDataset();
  const payloads = [
    "=1+1", "+SUM(1,2)", "-1+2", "@SUM(A1:A2)", "  =1+1", "\t=1+1",
    "\r=1+1", "\n=1+1", "\u0000=1+1", "\u00a0+1", " \u007f@A1", "\u200b=1+1",
    "\tordinary text", "\rordinary text", "  \tordinary text"
  ];
  dataset.observations = payloads.map((note, index) => observation({ id: String(index), note }));
  assert.deepEqual(csvRecords(dataset).map(({ notes }) => notes), payloads.map((payload) => `'${payload}`));
});

test("formula escaping applies to metadata and IDs as well as notes; numeric values remain numeric", () => {
  const dataset = createBlankDataset();
  dataset.medicationEvents = [event({
    id: "=event", medication: "=medication", formulation: "+formulation", doseText: "-dose",
    status: "@status", reporter: "=reporter", context: "=context", note: "=note"
  })];
  dataset.observations = [observation({
    domain: "=unknown domain", score: 6, reporter: "=reporter", context: "=context",
    medicationEventId: "=event"
  })];
  const [medication, record] = csvRecords(dataset);
  for (const field of ["medication", "formulation", "dose", "status", "reporter", "context", "linked_event_id", "notes"]) {
    assert.ok(medication[field].startsWith("'"), `${field} is escaped`);
  }
  assert.equal(record.variable, "'=unknown domain");
  assert.equal(record.linked_event_id, "'=event");
  assert.equal(record.score, "6");
  assert.match(datasetToCSV(dataset), /,6,/);
  dataset.observations = [observation({ score: -3 }), observation({ score: "=1+1" }), observation({ note: "  safe text" })];
  const observations = csvRecords(dataset).filter(({ type }) => type === "observation");
  assert.equal(observations[0].score, "-3");
  assert.equal(observations[1].score, "'=1+1");
  assert.equal(observations[2].notes, "  safe text");
});

test("download helper imports in Node and fails clearly without a browser", () => {
  assert.throws(() => downloadFile("journal.json", "{}", "application/json"), /require a browser/);
});

test("download helper creates the file and releases its temporary anchor and Blob URL", async () => {
  const saved = Object.fromEntries(["document", "URL", "setTimeout"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const calls = [];
  const timers = [];
  let downloadedBlob;
  const anchor = { click() { calls.push("click"); }, remove() { calls.push("remove"); } };
  try {
    Object.defineProperty(globalThis, "document", { configurable: true, value: {
      body: { appendChild(value) { assert.equal(value, anchor); calls.push("append"); } },
      createElement(tag) { assert.equal(tag, "a"); return anchor; }
    } });
    Object.defineProperty(globalThis, "URL", { configurable: true, value: {
      createObjectURL(blob) { downloadedBlob = blob; return "blob:journal-download"; },
      revokeObjectURL(url) { assert.equal(url, "blob:journal-download"); calls.push("revoke"); }
    } });
    Object.defineProperty(globalThis, "setTimeout", { configurable: true, value: (callback) => timers.push(callback) });
    downloadFile("journal.json", '{"observations":[]}', "application/json");
    assert.equal(anchor.download, "journal.json");
    assert.equal(anchor.href, "blob:journal-download");
    assert.equal(anchor.hidden, true);
    assert.equal(downloadedBlob.type, "application/json");
    assert.equal(await downloadedBlob.text(), '{"observations":[]}');
    assert.deepEqual(calls, ["append", "click", "remove"]);
    timers[0]();
    assert.deepEqual(calls, ["append", "click", "remove", "revoke"]);
    anchor.click = () => { throw new Error("download failure"); };
    assert.throws(() => downloadFile("journal.json", "{}"), /download failure/);
    assert.deepEqual(calls.slice(-3), ["append", "remove", "revoke"]);
  } finally {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
