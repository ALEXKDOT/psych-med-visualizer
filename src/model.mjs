export const SCHEMA_VERSION = "1.0.0";

const GROUPS = {
  attention: "Attention & thinking", mood: "Mood & emotions",
  energy: "Energy & sleep", physical: "Physical & appetite"
};

function domain(id, label, group, lowLabel, highLabel, color, kind = "target") {
  return Object.freeze({ id, label, group: GROUPS[group], lowLabel, highLabel, color, kind });
}

export const DOMAINS = Object.freeze([
  domain("attention_focus", "Focus", "attention", "Unable to focus", "Very focused", "#6175D1"),
  domain("distractibility", "Distractibility", "attention", "Not distracted", "Very distracted", "#A67DB8"),
  domain("task_initiation", "Difficulty starting tasks", "attention", "Easy to start", "Unable to start", "#8D77BA"),
  domain("task_completion", "Task completion", "attention", "Unable to finish", "Finishing with ease", "#457EB2"),
  domain("working_memory", "Working memory", "attention", "Very forgetful", "Remembering clearly", "#56909D"),
  domain("organization", "Organization", "attention", "Very disorganized", "Very organized", "#5A8A72"),
  domain("time_awareness", "Awareness of time", "attention", "Losing track of time", "Very aware of time", "#7B8CBB"),
  domain("mental_clarity", "Mental clarity", "attention", "Very foggy", "Very clear", "#5E93A2"),
  domain("impulsivity_restlessness", "Impulsivity / restlessness", "attention", "None", "Severe", "#AE8277"),
  domain("hyperfocus", "Difficulty shifting attention", "attention", "Easy to shift", "Unable to shift", "#7C83AF"),
  domain("decision_difficulty", "Difficulty making decisions", "attention", "Easy to decide", "Unable to decide", "#8B80A0"),
  domain("listening", "Listening and following along", "attention", "Unable to follow", "Following easily", "#477F8E"),
  domain("emotional_regulation", "Difficulty regulating emotions", "mood", "None", "Severe", "#BF8092"),
  domain("anxiety_distress", "Anxiety", "mood", "No anxiety", "Severe anxiety", "#CB9460"),
  domain("low_mood", "Low mood", "mood", "None", "Severe low mood", "#9386BC"),
  domain("irritability", "Irritability", "mood", "Not irritable", "Very irritable", "#C27575"),
  domain("activation_agitation", "Agitation", "mood", "None", "Severe agitation", "#CE8B72", "adverse"),
  domain("motivation", "Motivation", "mood", "No motivation", "Very motivated", "#689D8C"),
  domain("confidence", "Confidence", "mood", "Not confident", "Very confident", "#6C8EAF"),
  domain("overwhelm", "Feeling overwhelmed", "mood", "Not overwhelmed", "Very overwhelmed", "#B187A6"),
  domain("social_ease", "Ease of social interaction", "mood", "Very difficult", "Very comfortable", "#7B9A7E"),
  domain("emotional_flatness", "Emotional flatness", "mood", "None", "Very flat", "#9A869F", "adverse"),
  domain("energy", "Energy", "energy", "No energy", "Very energetic", "#74A594"),
  domain("sedation_fatigue", "Fatigue", "energy", "No fatigue", "Severe fatigue", "#BF8B77", "adverse"),
  domain("sleepiness", "Sleepiness", "energy", "Wide awake", "Very sleepy", "#8C8BAF", "adverse"),
  domain("sleep_difficulty", "Difficulty sleeping", "energy", "None", "Severe difficulty", "#767EB3", "adverse"),
  domain("sleep_quality", "Sleep quality", "energy", "Very poor", "Very restful", "#687BA4"),
  domain("morning_alertness", "Morning alertness", "energy", "Not alert", "Very alert", "#729CAC"),
  domain("physical_restlessness", "Physical restlessness", "energy", "Still and comfortable", "Unable to sit still", "#AA8D6A"),
  domain("appetite_impact", "Reduced appetite", "physical", "Usual appetite", "No appetite", "#B2A36B", "adverse"),
  domain("thirst", "Thirst", "physical", "Not thirsty", "Very thirsty", "#64A0B6"),
  domain("dry_mouth", "Dry mouth", "physical", "None", "Severe dryness", "#AE9869", "adverse"),
  domain("headache", "Headache", "physical", "No headache", "Severe headache", "#B87878", "adverse"),
  domain("nausea", "Nausea", "physical", "None", "Severe nausea", "#989864", "adverse"),
  domain("stomach_discomfort", "Stomach discomfort", "physical", "None", "Severe discomfort", "#AA8B6E", "adverse"),
  domain("dizziness", "Dizziness", "physical", "None", "Severe dizziness", "#9A86B4", "adverse"),
  domain("palpitations", "Noticeable heartbeat", "physical", "Not noticeable", "Very noticeable", "#BF7E8B", "adverse"),
  domain("muscle_tension", "Muscle tension", "physical", "Relaxed", "Severe tension", "#B3917F", "adverse"),
  domain("sweating", "Sweating", "physical", "None", "Very heavy", "#7C9C9B", "adverse"),
  domain("tics", "Tics / repetitive movements", "physical", "None", "Very frequent", "#9F8DA7", "adverse"),
  domain("sensory_sensitivity", "Sensory sensitivity", "physical", "None", "Very sensitive", "#AF96B7"),
  domain("pain", "Pain", "physical", "No pain", "Severe pain", "#B77565", "adverse")
]);

export function getDomains(dataset) {
  return [...DOMAINS, ...(Array.isArray(dataset?.customDomains) ? dataset.customDomains : [])];
}

export function domainLabel(domainId, dataset) {
  return getDomains(dataset).find((item) => item.id === domainId)?.label || domainId;
}

export function makeId(prefix = "record") {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function localDateString(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError("A valid date is required.");
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1000 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function validTime(value) {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validTimestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.test(value)
    && validDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}

export function localDateTime(date, time) {
  if (!validDate(date) || !validTime(time)) return null;
  const parsed = new Date(`${date}T${time}:00`);
  // A spring-forward clock time that never occurred must not silently roll forward.
  if (Number.isNaN(parsed.getTime()) || localDateString(parsed) !== date
    || parsed.getHours() !== Number(time.slice(0, 2)) || parsed.getMinutes() !== Number(time.slice(3))) return null;
  return parsed;
}

export function hoursRelativeToEvent(observation, event) {
  if (!observation || !event) return null;
  const observedAt = localDateTime(observation.date, observation.time);
  const eventAt = localDateTime(event.date, event.time);
  return observedAt && eventAt ? (observedAt.getTime() - eventAt.getTime()) / 3_600_000 : null;
}

export function linkedEvent(dataset, observation) {
  if (!observation?.medicationEventId) return null;
  return dataset.medicationEvents.find((event) => event.id === observation.medicationEventId) || null;
}

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

export function aggregateRelativeBins(dataset, observations, binHours = 2) {
  if (!Number.isFinite(binHours) || binHours <= 0) throw new RangeError("Bin width must be a positive number of hours.");
  const bins = new Map();
  for (const observation of observations) {
    const event = linkedEvent(dataset, observation);
    if (!event || event.status !== "taken") continue;
    const hours = hoursRelativeToEvent(observation, event);
    if (hours === null || hours < -6 || hours > 36) continue;
    const binStart = Math.floor(hours / binHours) * binHours;
    if (!bins.has(binStart)) bins.set(binStart, []);
    bins.get(binStart).push({ observation, hours });
  }
  return [...bins.entries()].map(([start, entries]) => {
    const values = entries.map(({ observation }) => observation.score);
    return { start, center: start + binHours / 2, n: values.length, median: median(values), min: Math.min(...values), max: Math.max(...values), entries };
  }).sort((a, b) => a.start - b.start);
}

export function uniqueDates(observations) {
  return [...new Set(observations.map((observation) => observation.date))].sort();
}

export function recordDates(dataset) {
  return [...new Set([...dataset.observations.map((item) => item.date), ...dataset.medicationEvents.map((item) => item.date), ...(dataset.checkIns || []).map((item) => item.date)])].sort();
}

export function filterObservations(dataset, domainId, dayWindow = "7") {
  const observations = dataset.observations.filter((item) => item.domain === domainId);
  if (dayWindow === "all" || !observations.length) return observations;
  const count = Number(dayWindow);
  if (!Number.isInteger(count) || count < 1) return [];
  const visibleDates = new Set(recordDates(dataset).slice(-count));
  return observations.filter((item) => visibleDates.has(item.date));
}

export function formatRelativeHours(hours) {
  if (hours === null || !Number.isFinite(hours)) return "Not linked";
  if (Math.abs(hours) < 0.05) return "At event time";
  const value = Math.round(hours * 10) / 10;
  return value < 0 ? `${Math.abs(value)} h before` : `${value} h after`;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

// Imported files must remain inert JSON. This also bounds unexpectedly deep or huge inputs.
function safeJsonIssue(candidate) {
  const visited = new WeakSet();
  let nodes = 0;
  function visit(value, depth) {
    if (++nodes > 2_000_000) return "The imported file is too large.";
    if (depth > 12) return "The imported file is nested too deeply.";
    if (value === null || ["string", "boolean"].includes(typeof value)) return null;
    if (typeof value === "number") return Number.isFinite(value) ? null : "The imported file contains a non-finite number.";
    if (typeof value !== "object" || (!Array.isArray(value) && !isRecord(value))) return "The imported file contains a value that is not plain JSON.";
    if (visited.has(value)) return "The imported file contains repeated or circular objects.";
    visited.add(value);
    for (const key of Object.keys(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) return "The imported file contains an unsafe object key.";
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) return "The imported file contains a value that is not plain JSON.";
      const issue = visit(descriptor.value, depth + 1);
      if (issue) return issue;
    }
    return null;
  }
  return visit(candidate, 0);
}

export function validateDataset(candidate) {
  try { return validateDatasetInternal(candidate); }
  catch { return ["The imported file could not be read as plain journal data."]; }
}

function validateDatasetInternal(candidate) {
  if (!isRecord(candidate)) return ["The imported file is not a record object."];
  const unsafe = safeJsonIssue(candidate);
  if (unsafe) return [unsafe];
  const errors = [];
  const string = (value, label, max = 500, required = true) => {
    if (typeof value !== "string" || (required && !value.trim()) || (typeof value === "string" && value.length > max)) errors.push(`${label} must be ${required ? "a nonempty" : "a"} text value of at most ${max} characters.`);
  };
  const identifier = (value, label) => {
    if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)) errors.push(`${label} has an invalid identifier.`);
  };
  const dateTime = (item, label) => {
    if (!validDate(item.date)) errors.push(`${label} has an invalid date; use a real date in YYYY-MM-DD format.`);
    if (!validTime(item.time)) errors.push(`${label} has an invalid time; use HH:MM in 24-hour time.`);
  };
  if (candidate.schemaVersion !== SCHEMA_VERSION) errors.push("Unsupported schema version. Import a supported journal backup.");
  for (const key of ["createdAt", "updatedAt"]) if (!validTimestamp(candidate[key])) errors.push(`${key} must be a valid UTC ISO timestamp.`);
  if (!isRecord(candidate.patient)) errors.push("A patient profile is required.");
  else { string(candidate.patient.alias, "Patient alias", 200); string(candidate.patient.ageBand, "Patient age band", 100); }
  if (!isRecord(candidate.episode)) errors.push("A journal episode is required.");
  else {
    identifier(candidate.episode.id, "Episode");
    string(candidate.episode.label, "Episode label", 300);
    if (!validDate(candidate.episode.startDate)) errors.push("Episode start date is invalid.");
    for (const key of ["medication", "formulation", "doseText", "context"]) if (candidate.episode[key] !== undefined) string(candidate.episode[key], `Episode ${key}`, 1000, false);
  }
  if (!Array.isArray(candidate.customDomains)) errors.push("Custom symptoms must be an array.");
  if (!Array.isArray(candidate.medicationEvents)) errors.push("Medication events must be an array.");
  if (!Array.isArray(candidate.observations)) errors.push("Observations must be an array.");
  if (candidate.migrationNotes !== undefined && (!Array.isArray(candidate.migrationNotes) || candidate.migrationNotes.some((item) => typeof item !== "string" || item.length > 2000))) errors.push("Migration notes must be an array of text values.");
  if (errors.length) return errors;
  if (candidate.customDomains.length > 200 || candidate.medicationEvents.length > 100_000 || candidate.observations.length > 100_000) return ["The journal exceeds the supported number of records or custom symptoms."];
  const domainIds = new Set(DOMAINS.map((item) => item.id));
  for (const [index, item] of candidate.customDomains.entries()) {
    const label = `Custom symptom ${index + 1}`;
    if (!isRecord(item)) { errors.push(`${label} is not a record object.`); continue; }
    identifier(item.id, label);
    if (domainIds.has(item.id)) errors.push(`${label} duplicates an existing symptom identifier.`);
    domainIds.add(item.id);
    string(item.label, `${label} name`, 100);
    string(item.group, `${label} group`, 100);
    string(item.lowLabel, `${label} low endpoint`, 120);
    string(item.highLabel, `${label} high endpoint`, 120);
    if (!["target", "adverse", "custom"].includes(item.kind)) errors.push(`${label} has an unsupported kind.`);
    if (typeof item.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(item.color)) errors.push(`${label} must have a six-digit hex color.`);
  }
  const eventIds = new Set();
  for (const [index, item] of candidate.medicationEvents.entries()) {
    const label = `Medication event ${index + 1}`;
    if (!isRecord(item)) { errors.push(`${label} is not a record object.`); continue; }
    identifier(item.id, label);
    if (eventIds.has(item.id)) errors.push(`${label} duplicates an existing identifier.`);
    eventIds.add(item.id);
    dateTime(item, label);
    for (const key of ["medication", "formulation", "doseText"]) string(item[key], `${label} ${key}`, 200);
    if (!["taken", "missed", "partial", "unknown"].includes(item.status)) errors.push(`${label} has an unsupported status.`);
    string(item.note, `${label} note`, 10_000, false);
  }
  const checkIns = candidate.checkIns === undefined ? [] : candidate.checkIns;
  if (!Array.isArray(checkIns)) return [...errors, "Check-ins must be an array."];
  if (checkIns.length > 100_000) return [...errors, "The journal exceeds the supported number of check-ins."];
  const checkInIds = new Set();
  for (const item of checkIns) {
    if (!isRecord(item)) { errors.push("Check-in is not a record object."); continue; }
    identifier(item.id, "Check-in");
    if (checkInIds.has(item.id)) errors.push("Check-in duplicates an existing identifier.");
    checkInIds.add(item.id);
    dateTime(item, "Check-in");
    for (const key of ["reporter", "context"]) string(item[key], `Check-in ${key}`, key === "context" ? 300 : 200);
    string(item.note, "Check-in note", 10_000, false);
    if (typeof item.pinned !== "boolean") errors.push("Check-in pinned must be a boolean.");
    if (typeof item.medicationEventId !== "string" || (item.medicationEventId && !eventIds.has(item.medicationEventId))) errors.push("Check-in links to a missing medication event.");
    if (item.sleepHours !== null && (typeof item.sleepHours !== "number" || !Number.isFinite(item.sleepHours) || item.sleepHours < 0 || item.sleepHours > 24)) errors.push("Sleep duration must be between 0 and 24 hours or unanswered.");
    if (!["", "Poor", "Fair", "Restful"].includes(item.sleepQuality)) errors.push("Sleep quality is invalid.");
    string(item.circumstances, "Daily circumstances", 2000, false);
    if (!item.note?.trim() && !candidate.observations.some(o => o?.checkInId === item.id)) errors.push("A check-in needs a rating or a note.");
  }
  if (candidate.visitPlanning !== undefined) {
    if (!isRecord(candidate.visitPlanning)) errors.push("Visit planning must be a record object.");
    else for (const key of ["concerns", "goals", "questions"]) string(candidate.visitPlanning[key], `Visit ${key}`, 2000, false);
  }
  const observationIds = new Set();
  for (const [index, item] of candidate.observations.entries()) {
    const label = `Observation ${index + 1}`;
    if (!isRecord(item)) { errors.push(`${label} is not a record object.`); continue; }
    identifier(item.id, label);
    if (observationIds.has(item.id)) errors.push(`${label} duplicates an existing identifier.`);
    observationIds.add(item.id);
    if (item.checkInId !== undefined) {
      const checkIn = checkIns.find(c => c?.id === item.checkInId);
      if (!checkIn) errors.push(`${label} links to a missing check-in.`);
      else for (const key of ["date", "time", "reporter", "context", "note", "medicationEventId"]) {
        if (item[key] !== checkIn[key]) errors.push(`${label} disagrees with its check-in ${key}.`);
      }
      if (candidate.observations.some(o => o !== item && o?.checkInId === item.checkInId && o?.domain === item.domain)) errors.push(`${label} duplicates a variable in its check-in.`);
    }
    dateTime(item, label);
    if (typeof item.domain !== "string" || !domainIds.has(item.domain)) errors.push(`${label} has an unsupported domain.`);
    if (typeof item.score !== "number" || !Number.isInteger(item.score) || item.score < 1 || item.score > 10) errors.push(`${label} has a score outside 1–10; scores must be whole numbers.`);
    string(item.reporter, `${label} reporter`, 200);
    string(item.context, `${label} context`, 300);
    string(item.note, `${label} note`, 10_000, false);
    if (typeof item.medicationEventId !== "string") errors.push(`${label} medication link must be an identifier or an empty string.`);
    else if (item.medicationEventId && !eventIds.has(item.medicationEventId)) errors.push(`${label} links to a missing medication event.`);
  }
  return errors;
}

export function migrateDataset(candidate) {
  if (!isRecord(candidate)) throw new Error("The imported file is not a record object.");
  const unsafe = safeJsonIssue(candidate);
  if (unsafe) throw new Error(unsafe);
  if (![SCHEMA_VERSION, "0.1.0"].includes(candidate.schemaVersion)) throw new Error("Unsupported schema version.");
  const dataset = JSON.parse(JSON.stringify(candidate));
  if (dataset.schemaVersion === "0.1.0") {
    dataset.schemaVersion = SCHEMA_VERSION;
    dataset.customDomains = [];
    dataset.migrationNotes = ["Imported from schema 0.1.0. Medication details were copied from the original episode into each recorded medication event."];
    let zeroCount = 0;
    let legacyFocus = false;
    if (isRecord(dataset.patient) && dataset.patient.ageBand === undefined) dataset.patient.ageBand = "not_recorded";
    for (const item of Array.isArray(dataset.medicationEvents) ? dataset.medicationEvents : []) {
      if (!isRecord(item)) continue;
      for (const key of ["medication", "formulation", "doseText"]) item[key] = typeof dataset.episode?.[key] === "string" && dataset.episode[key].trim() ? dataset.episode[key] : "Not recorded (legacy)";
      if (item.note === undefined) item.note = "";
    }
    for (const item of Array.isArray(dataset.observations) ? dataset.observations : []) {
      if (!isRecord(item)) continue;
      if (typeof item.score === "string" && /^\d+(?:\.0+)?$/.test(item.score)) item.score = Number(item.score);
      if (item.note === undefined) item.note = "";
      if (item.medicationEventId === undefined || item.medicationEventId === null) item.medicationEventId = "";
      if (item.score === 0) {
        item.score = 1;
        zeroCount += 1;
        if (typeof item.note === "string") item.note = `${item.note}${item.note ? "\n" : ""}Migration: original score 0 on the legacy 0–10 scale; displayed as 1 on the 1–10 scale.`;
      }
      if (item.domain === "attention_focus") { item.domain = "legacy_focus_difficulty"; legacyFocus = true; }
    }
    if (legacyFocus) {
      dataset.customDomains.push({ id: "legacy_focus_difficulty", label: "Focus difficulty (legacy)", group: GROUPS.attention, kind: "custom", lowLabel: "Little difficulty", highLabel: "Severe difficulty", color: "#8275B9" });
      dataset.migrationNotes.push("Legacy attention/focus ratings measured difficulty (higher was worse). They remain a separate Focus difficulty (legacy) symptom to preserve their original direction.");
    }
    if (zeroCount) dataset.migrationNotes.push(`${zeroCount} legacy zero score${zeroCount === 1 ? " was" : "s were"} moved to 1. Each affected observation retains its original score in its note.`);
    dataset.updatedAt = new Date().toISOString();
  }
  const errors = validateDataset(dataset);
  if (errors.length) throw new Error(errors.slice(0, 5).join(" "));
  return dataset;
}

function recentDate(offset, now = new Date()) {
  const date = new Date(now);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return localDateString(date);
}

export function createBlankDataset() {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION, createdAt: now, updatedAt: now,
    patient: { alias: "My journal", ageBand: "not_recorded" },
    episode: { id: "episode_current", label: "My medication and symptom journal", medication: "", formulation: "", doseText: "", startDate: localDateString(), context: "" },
    customDomains: [], medicationEvents: [], observations: [], checkIns: [],
    visitPlanning: { concerns: "", goals: "", questions: "" }
  };
}

// Ratings keep their individual identities for calculations; the check-in owns shared details.
export function getCheckIns(dataset) {
  const groups = (dataset.checkIns || []).map(item => ({ ...item, ratings: dataset.observations.filter(o => o.checkInId === item.id) }));
  // Older observations cannot be grouped reliably by time alone.
  for (const item of dataset.observations.filter(o => !o.checkInId)) groups.push({ ...item, ratings: [{ ...item }], legacy: true, pinned: false, sleepHours: null, sleepQuality: "", circumstances: "" });
  return groups;
}

export function saveCheckIn(dataset, values, details, existingId = "") {
  const previous = getCheckIns(dataset).find(c => c.id === existingId);
  const id = existingId || makeId("checkin");
  const checkIn = {
    id, date: details.date, time: details.time, reporter: details.reporter || "Patient",
    context: details.context || "Home", note: details.note || "", medicationEventId: details.link || "",
    pinned: details.pinned ?? previous?.pinned ?? false,
    sleepHours: details.sleepHours ?? null, sleepQuality: details.sleepQuality || "", circumstances: details.circumstances || ""
  };
  dataset.checkIns ||= [];
  dataset.checkIns = dataset.checkIns.filter(c => c.id !== id);
  dataset.observations = dataset.observations.filter(o => o.checkInId !== id && !(previous?.legacy && o.id === id));
  dataset.checkIns.push(checkIn);
  for (const [domain, score] of values) {
    const old = previous?.ratings.find(o => o.domain === domain);
    const { pinned, sleepHours, sleepQuality, circumstances, ...shared } = checkIn;
    dataset.observations.push({ ...shared, id: old?.id || makeId("observation"), checkInId: id, domain, score });
  }
  return id;
}

export function deleteCheckIn(dataset, id) {
  dataset.checkIns = (dataset.checkIns || []).filter(c => c.id !== id);
  dataset.observations = dataset.observations.filter(o => o.checkInId !== id && o.id !== id);
}

export function removeMedicationEvent(dataset, id) {
  dataset.medicationEvents = dataset.medicationEvents.filter(e => e.id !== id);
  for (const item of [...dataset.observations, ...(dataset.checkIns || [])]) if (item.medicationEventId === id) item.medicationEventId = "";
}

export function resolveCheckInTime(draft, now = new Date()) {
  if (draft.timeMode === "earlier") return { date: draft.date, time: draft.time };
  return { date: localDateString(now), time: now.toTimeString().slice(0, 5) };
}

export function reviewCoverage(dataset, startDate, endDate) {
  const inRange = item => item.date >= startDate && item.date <= endDate;
  const days = Math.round((Date.parse(endDate + "T12:00:00Z") - Date.parse(startDate + "T12:00:00Z")) / 86400000) + 1;
  const checkIns = getCheckIns(dataset).filter(inRange);
  const recorded = new Set(checkIns.map(c => c.date)).size;
  return { days, recorded, missing: days - recorded, checkIns: checkIns.length, ratings: dataset.observations.filter(inRange).length };
}

export function createDemoDataset(now = new Date()) {
  const dataset = createBlankDataset();
  dataset.patient = { alias: "Sample journal", ageBand: "adult" };
  dataset.episode = { ...dataset.episode, id: "episode_demo", label: "A week of fictional observations", startDate: recentDate(-6, now) };
  dataset.visitPlanning = { concerns: "Getting started on tasks", goals: "Begin one planned task in the morning.", questions: "What context would be useful to track before our next visit?" };
  const schedule = [["08:20", "13:45", "19:10"], ["10:05", "16:30"], [], ["09:15", "11:00", "18:20"], ["14:40"], ["08:50", "12:10", "20:15"], ["09:10", "14:25", "19:30"]];
  schedule.forEach((times, day) => {
    if (!times.length) return;
    const date = recentDate(day - 6, now);
    if (day !== 6 || now.toTimeString().slice(0, 5) >= "08:00") dataset.medicationEvents.push({ id: `demo_event_${day}`, date, time: "08:00", medication: "Example medication", formulation: "Extended-release tablet", doseText: "recorded dose", status: day === 4 ? "unknown" : "taken", note: "Fictional sample event." });
    times.forEach((time, i) => {
      if (day === 6 && time > now.toTimeString().slice(0, 5)) return;
      const values = new Map([["attention_focus", 3 + (day + i * 2) % 6], ["task_initiation", 2 + (day * 3 + i) % 7]]);
      if (i === 1) values.set("energy", 4 + day % 4);
      saveCheckIn(dataset, values, { date, time, reporter: day === 3 && i === 2 ? "Caregiver" : "Patient", context: i === 0 ? "Home" : "Work", note: day === 5 && i === 1 ? "Started the task after moving to a quiet room." : "", pinned: day === 5 && i === 1, sleepHours: i === 0 ? 6.5 + day % 3 * .5 : null, sleepQuality: i === 0 ? "Fair" : "", circumstances: day === 4 ? "Changed routine today" : "" }, `demo_checkin_${day}_${i}`);
    });
  });
  return dataset;
}
