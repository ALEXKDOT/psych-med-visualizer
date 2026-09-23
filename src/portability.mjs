import { getDomains } from "./model.mjs";

const CSV_COLUMNS = [
  "type", "date", "time", "variable", "score", "medication", "formulation",
  "dose", "status", "reporter", "context", "linked_event_id", "notes"
];

function csvCell(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  let text = value == null ? "" : String(value);
  const leading = text.match(/^[\s\p{Cc}\p{Cf}]*/u)[0];
  // Quoting alone does not prevent spreadsheet programs from executing formulas.
  if (/^[=+\-@]/u.test(text.slice(leading.length)) || /[\t\r\n]/u.test(leading)) {
    text = `'${text}`;
  }
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function medicationDetails(event) {
  if (!event) return ["", "", "", ""];
  return [
    event.medication ?? "",
    event.formulation ?? "",
    event.doseText ?? "",
    event.status ?? ""
  ];
}

/** Export recorded facts; medication metadata appears only for explicit links. */
export function datasetToCSV(dataset, { startDate, endDate } = {}) {
  const domainLabels = new Map(getDomains(dataset).map(({ id, label }) => [id, label]));
  const events = new Map(dataset.medicationEvents.map((event) => [event.id, event]));
  const records = [
    ...dataset.medicationEvents.map((event) => ({
      date: event.date,
      time: event.time,
      cells: [
        "medication", event.date, event.time, "", "",
        ...medicationDetails(event),
        event.reporter ?? "", event.context ?? "", event.id, event.note ?? ""
      ]
    })),
    ...dataset.observations.map((observation) => ({
      date: observation.date,
      time: observation.time,
      cells: [
        "observation", observation.date, observation.time,
        domainLabels.get(observation.domain) ?? observation.domain, observation.score,
        ...medicationDetails(events.get(observation.medicationEventId)),
        observation.reporter, observation.context,
        observation.medicationEventId ?? "", observation.note ?? ""
      ]
    }))
  ];

  const rows = records
    .map((record, index) => ({ ...record, index }))
    .filter(({ date }) => (!startDate || date >= startDate) && (!endDate || date <= endDate))
    .sort((left, right) => {
      const leftTime = `${left.date}T${left.time}`;
      const rightTime = `${right.date}T${right.time}`;
      return (leftTime < rightTime ? -1 : leftTime > rightTime ? 1 : 0) || left.index - right.index;
    })
    .map(({ cells }) => cells.map(csvCell).join(","));

  return `${[CSV_COLUMNS.join(","), ...rows].join("\r\n")}\r\n`;
}

/** Download locally without sending journal data to a server. */
export function downloadFile(filename, content, type = "application/octet-stream") {
  if (!globalThis.document?.body || !globalThis.Blob || !globalThis.URL?.createObjectURL) {
    throw new Error("File downloads require a browser window.");
  }
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  let anchor;
  let clicked = false;
  try {
    anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    clicked = true;
  } finally {
    anchor?.remove();
    // Allow the browser to start reading the Blob before releasing it.
    if (clicked) setTimeout(() => URL.revokeObjectURL(url), 1_000);
    else URL.revokeObjectURL(url);
  }
}
