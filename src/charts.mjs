import { getDomains } from "./model.mjs?v=five-symptoms-20261010";

const SVG_NS = "http://www.w3.org/2000/svg";
const DAY_MS = 86_400_000;
const FALLBACK_COLORS = ["#58694e", "#aa7547", "#a76770", "#71839a", "#917594", "#5b8290"];
let chartSequence = 0;

function svgElement(name, attributes = {}, text) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = String(text);
  return element;
}

function minutesAt(time) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function dateNumber(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const stamp = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== date) return null;
  return Math.floor(stamp / DAY_MS);
}

function dateLabel(day, detailed = false) {
  return new Date(day * DAY_MS).toLocaleDateString(undefined, {
    month: "short", day: "numeric", ...(detailed ? { year: "numeric" } : {}), timeZone: "UTC"
  });
}

function timeLabel(time) {
  const minute = minutesAt(time);
  if (minute === null) return String(time || "Time not recorded");
  const hour = Math.floor(minute / 60);
  return `${hour % 12 || 12}:${String(minute % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

function validScore(score) {
  return typeof score !== "boolean" && score !== "" && score !== null && Number.isFinite(Number(score)) && Number(score) >= 1 && Number(score) <= 10;
}

function selectedDomains(dataset, domainIds) {
  const domains = getDomains(dataset).map((domain, index) => ({ ...domain, shape: index % 3,
    color: darkenColor(domain.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length]) }));
  const visible = new Set(domainIds ?? domains.map((domain) => domain.id));
  return domains.filter((domain) => visible.has(domain.id));
}

function createChart(container, title, description, captionText = "") {
  container.replaceChildren();
  const width = Math.max(240, container.clientWidth || 600);
  const height = 286;
  const margin = { top: 38, right: 24, bottom: 34, left: 34 };
  const id = `journal-chart-${++chartSequence}`;
  const frame = document.createElement("div");
  frame.className = "journal-chart-frame";
  frame.style.position = "relative";
  const scroller = document.createElement("div");
  scroller.className = "journal-chart-scroll";
  scroller.style.overflowX = "auto";
  scroller.style.overflowY = "hidden";
  const svg = svgElement("svg", {
    viewBox: `0 0 ${width} ${height}`, role: "group",
    "aria-labelledby": `${id}-title ${id}-description`,
    width: "100%", height, class: "journal-chart-svg"
  });
  svg.style.display = "block";
  svg.style.minWidth = "0";
  svg.style.fontFamily = "inherit";
  svg.append(svgElement("title", { id: `${id}-title` }, title));
  svg.append(svgElement("desc", { id: `${id}-description` }, description));
  svg.append(svgElement("style", {}, ".journal-chart-target{outline:none}.journal-chart-target:focus-visible .journal-chart-dot,.journal-chart-target:hover .journal-chart-dot{stroke-width:3.5}.journal-chart-target:focus-visible .journal-chart-focus{opacity:1}.journal-chart-target{cursor:default}"));
  const tooltip = document.createElement("div");
  tooltip.className = "journal-chart-tooltip";
  tooltip.hidden = true;
  Object.assign(tooltip.style, {
    position: "absolute", zIndex: "2", left: "38px", bottom: "38px", maxWidth: "min(360px, calc(100% - 60px))",
    padding: "11px 14px", borderRadius: "4px", background: "#383b31", color: "#fbf8ef", fontSize: "14px",
    lineHeight: "1.55", boxShadow: "0 4px 16px #383b3120", pointerEvents: "none", whiteSpace: "pre-line"
  });
  scroller.append(svg);
  frame.append(scroller, tooltip);
  container.append(frame);
  if (captionText) {
    const caption = document.createElement("p");
    caption.className = "chart-caption";
    caption.textContent = captionText;
    Object.assign(caption.style, { fontSize: "14px", lineHeight: "1.6", color: "#6c6d60", margin: "10px 0 0" });
    container.append(caption);
  }
  const plot = {
    svg, width, height, margin, tooltip, targets: [], pinnedTarget: null,
    right: width - margin.right,
    bottom: height - margin.bottom,
    y: (value) => margin.top + ((10 - value) / 9) * (height - margin.top - margin.bottom)
  };
  drawHorizontalGrid(plot);
  return plot;
}

function drawHorizontalGrid({ svg, y, margin, right }) {
  for (const score of [1, 2, 4, 6, 8, 10]) {
    svg.append(svgElement("line", {
      x1: margin.left, x2: right, y1: y(score), y2: y(score),
      stroke: "#e2ddcf", "stroke-width": 1, "aria-hidden": "true"
    }));
    svg.append(svgElement("text", {
      x: margin.left - 13, y: y(score) + 3.5, fill: "#6c6d60", "font-size": 14,
      "text-anchor": "end", "aria-hidden": "true"
    }, score));
  }
  svg.append(svgElement("text", { x: margin.left - 13, y: 19, fill: "#6c6d60", "font-size": 11, "text-anchor": "end", "aria-hidden": "true" }, "/10"));
}

// All built-in strokes clear 3:1 against the ivory plot; shape and dash pattern
// provide an additional cue independent of color.
export function darkenColor(color) {
  return '#' + color.slice(1).match(/../g).map(hex => Math.round(parseInt(hex, 16) * .66).toString(16).padStart(2, '0')).join('');
}

function addTarget(plot, shape, label, tooltipText = label) {
  const target = svgElement("g", { tabindex: plot.targets.length ? "-1" : "0", role: "button", "aria-pressed": "false", "aria-label": label, class: "journal-chart-target" });
  target.append(svgElement("title", {}, label), shape);
  const show = () => { plot.tooltip.textContent = tooltipText; plot.tooltip.hidden = false; };
  const unpin = () => { if (plot.pinnedTarget) plot.pinnedTarget.setAttribute('aria-pressed', 'false'); plot.pinnedTarget = null; };
  const toggle = () => {
    if (plot.pinnedTarget === target) { unpin(); plot.tooltip.hidden = true; }
    else { unpin(); plot.pinnedTarget = target; target.setAttribute('aria-pressed', 'true'); show(); }
  };
  target.addEventListener("pointerenter", () => { if (!plot.pinnedTarget) show(); });
  target.addEventListener("pointerleave", () => { if (!plot.pinnedTarget) plot.tooltip.hidden = true; });
  target.addEventListener("focus", () => { unpin(); plot.targets.forEach(t => t.setAttribute('tabindex', t === target ? '0' : '-1')); show(); });
  target.addEventListener("blur", () => { if (!plot.pinnedTarget) plot.tooltip.hidden = true; });
  target.addEventListener('click', toggle);
  target.addEventListener("keydown", event => {
    const index = plot.targets.indexOf(target);
    let next = index;
    if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % plot.targets.length;
    else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index - 1 + plot.targets.length) % plot.targets.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = plot.targets.length - 1;
    else if (event.key === 'Escape') { unpin(); plot.tooltip.hidden = true; return; }
    else if (['Enter', ' '].includes(event.key)) { event.preventDefault(); toggle(); return; }
    else return;
    event.preventDefault(); plot.targets[next].focus();
  });
  plot.targets.push(target); plot.svg.append(target); return target;
}

function drawPoint(plot, x, score, domain, label, count = 1, tooltipText = label) {
  const group = svgElement("g");
  group.append(svgElement("circle", {
    cx: x, cy: plot.y(score), r: 10, fill: "none", stroke: domain.color,
    "stroke-width": 1.5, opacity: 0, class: "journal-chart-focus"
  }));
  group.append(svgElement("circle", { cx: x, cy: plot.y(score), r: 14, fill: 'transparent' }));
  const attrs = { fill: "#fbf8ef", stroke: domain.color, "stroke-width": 2.25, class: "journal-chart-dot" };
  if (domain.shape === 1) group.append(svgElement('rect', { ...attrs, x: x - 4, y: plot.y(score) - 4, width: 8, height: 8 }));
  else if (domain.shape === 2) group.append(svgElement('path', { ...attrs, d: `M ${x} ${plot.y(score) - 6} l 6 6 l -6 6 l -6 -6 Z` }));
  else group.append(svgElement('circle', { ...attrs, cx: x, cy: plot.y(score), r: count > 1 ? 5.5 : 4.25 }));
  if (count > 1) {
    group.append(svgElement("text", {
      x: x + 8, y: plot.y(score) - 7, fill: domain.color, "font-size": 11,
      "font-weight": 600, "aria-hidden": "true"
    }, `×${count}`));
  }
  addTarget(plot, group, label, tooltipText);
}

function drawSegment(plot, points, domain) {
  if (points.length < 2) return;
  plot.svg.append(svgElement("path", {
    d: points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${plot.y(point.score)}`).join(" "),
    fill: "none", stroke: domain.color, "stroke-width": 2.5, "stroke-dasharray": domain.shape === 1 ? "7 4" : domain.shape === 2 ? "2 4" : "none",
    "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true"
  }));
}

function emptyMessage(plot, title, subtitle) {
  const center = (plot.margin.left + plot.right) / 2;
  const centerY = (plot.margin.top + plot.bottom) / 2;
  const group = svgElement("g", { role: "note" });
  group.append(svgElement("rect", { x: plot.margin.left, y: centerY - 34, width: plot.right - plot.margin.left, height: 72, rx: 3, fill: "#fbf8ef", "fill-opacity": 0.97 }));
  group.append(svgElement("text", { x: center, y: centerY - 5, fill: "#383b31", "font-size": 14, "text-anchor": "middle" }, title));
  group.append(svgElement("text", { x: center, y: centerY + 19, fill: "#6c6d60", "font-size": 13, "text-anchor": "middle" }, subtitle));
  plot.svg.append(group);
}

function medicationText(event, dataset) {
  const medication = event.medication || dataset.episode?.medication || "Medication";
  const formulation = event.formulation || dataset.episode?.formulation;
  const dose = event.doseText || dataset.episode?.doseText;
  const status = String(event.status || "unknown").replaceAll("_", " ");
  const details = [medication, formulation, dose].filter(Boolean).join(" · ");
  return `${timeLabel(event.time)} · ${status}\n${details}${event.note ? `\n${event.note}` : ""}`;
}

function drawMedication(plot, event, dataset, x, index, coincidentCount) {
  const taken = event.status === "taken";
  const color = taken ? "#58694e" : "#a47455";
  const label = medicationText(event, dataset);
  const group = svgElement("g");
  group.append(svgElement("line", {
    x1: x, x2: x, y1: plot.margin.top - 4, y2: plot.bottom,
    stroke: color, "stroke-width": 1.2, "stroke-dasharray": taken ? "4 5" : "2 6", opacity: 0.6
  }));
  const top = 19 + (index % 2) * 3;
  group.append(svgElement("circle", { cx: x, cy: top, r: 14, fill: "transparent" }));
  group.append(svgElement("rect", { x: x - 9, y: top - 8, width: 18, height: 16, rx: 8, fill: "none", stroke: color, "stroke-width": 1.5, opacity: 0, class: "journal-chart-focus" }));
  group.append(svgElement("rect", { x: x - 6, y: top - 4, width: 12, height: 8, rx: 4, fill: taken ? color : "#fbf8ef", stroke: color, "stroke-width": 1.4, transform: `rotate(-40 ${x} ${top})`, class: "journal-chart-dot" }));
  if (taken) group.append(svgElement("path", { d: `M ${x - 2.6} ${top - 3.1} L ${x + 2.6} ${top + 3.1}`, stroke: "#fbf8ef", "stroke-width": 1 }));
  const duplicate = coincidentCount > 1 ? `\n${coincidentCount} medication events recorded at this time; use arrow keys to inspect each.` : "";
  addTarget(plot, group, `${event.date} ${label}${duplicate}`, label + duplicate);
}

/** Plot only recorded 1–10 observations, without imputing hourly values. */
export function renderDailyChart(container, dataset, options = {}) {
  container.replaceChildren();
  const selected = selectedDomains(dataset, options.domainIds);
  const timeBounds = { full: [0, 1440], morning: [360, 720], afternoon: [720, 1080], evening: [1080, 1440] }[options.timeRange || 'full'];
  const inTime = item => { const minute = minutesAt(item.time); return minute >= timeBounds[0] && minute < timeBounds[1]; };
  const filtered = { ...dataset, observations: dataset.observations.filter(o => inTime(o)), medicationEvents: dataset.medicationEvents.filter(e => inTime(e)) };
  if (options.showMedication !== false) {
    const events = filtered.medicationEvents.filter(e => e.date === options.date).sort((a,b) => a.time.localeCompare(b.time));
    if (events.length) {
      const lane = document.createElement('section'); lane.className = 'medication-lane'; lane.setAttribute('aria-label', 'Medication events');
      for (const event of events) { const label = document.createElement('p'); label.textContent = medicationText(event, dataset).replaceAll('\n', ' · '); lane.append(label); }
      container.append(lane);
    }
  }
  const groups = options.layout === 'overlay' ? [selected] : selected.map(d => [d]);
  if (!groups.length) groups.push([]);
  for (const group of groups) {
    const panel = document.createElement('section'); panel.className = 'chart-panel';
    const scale = document.createElement('p'); scale.className = 'chart-scale';
    scale.textContent = group.map(d => `${d.label}: 1 · ${d.lowLabel} / 10 · ${d.highLabel}`).join('  |  ');
    const count = filtered.observations.filter(o => o.date === options.date && group.some(d => d.id === o.domain)).length;
    const coverage = document.createElement('p'); coverage.className = 'chart-note'; coverage.textContent = `${count} recorded ${count === 1 ? 'rating' : 'ratings'} in this time range`;
    const chart = document.createElement('div'); panel.append(scale, coverage, chart); container.append(panel);
    renderDailyPanel(chart, filtered, { ...options, domainIds: group.map(d => d.id), timeBounds });
  }
}

function renderDailyPanel(container, dataset, { date, domainIds, showMedication = true, timeBounds = [0, 1440] } = {}) {
  const domains = selectedDomains(dataset, domainIds);
  const ids = new Set(domains.map((domain) => domain.id));
  const observations = (dataset.observations || []).filter((item) => item.date === date && ids.has(item.domain) && validScore(item.score) && minutesAt(item.time) !== null);
  const events = showMedication ? (dataset.medicationEvents || []).filter((item) => item.date === date && minutesAt(item.time) !== null).sort((a, b) => a.time.localeCompare(b.time)) : [];
  const plot = createChart(container, `Daily symptom and medication journal for ${date || "the selected day"}`,
    `${observations.length} recorded symptom scores and ${events.length} visible medication events. Horizontal axis is the selected range of local clock time. Vertical axis is the recorded score from 1 to 10. Each symptom has its own scale endpoints. Lines connect recorded points at most three hours apart; unmeasured hours are not estimated. Tab into the chart, then use arrow keys for points. Tap or press Enter to pin details.`);
  const [start, end] = timeBounds;
  const x = minute => plot.margin.left + ((minute - start) / (end - start)) * (plot.right - plot.margin.left);
  const step = (end - start) / (plot.width < 450 ? 4 : 8);
  for (let minute = start; minute <= end; minute += step) {
    const hour = minute / 60;
    plot.svg.append(svgElement('text', { x: x(minute), y: plot.height - 11, fill: '#59604f', 'font-size': 14,
      'text-anchor': minute === start ? 'start' : minute === end ? 'end' : 'middle', 'aria-hidden': 'true' },
      `${Math.floor(hour) % 12 || 12}${minute % 60 ? ':' + String(minute % 60).padStart(2, '0') : ''}${hour < 12 || hour === 24 ? 'a' : 'p'}`));
  }
  const eventCounts = new Map();
  for (const event of events) eventCounts.set(event.time, (eventCounts.get(event.time) || 0) + 1);
  events.forEach((event, index) => drawMedication(plot, event, dataset, x(minutesAt(event.time)), index, eventCounts.get(event.time)));

  // Group coincident values, retaining every original observation in its tooltip.
  // Conflicting scores at the same instant are all shown and are never averaged.
  const renderedPoints = [];
  for (const domain of domains) {
    const grouped = new Map();
    for (const observation of observations.filter((item) => item.domain === domain.id)) {
      const minute = minutesAt(observation.time);
      if (!grouped.has(minute)) grouped.set(minute, new Map());
      const byScore = grouped.get(minute);
      const score = Number(observation.score);
      if (!byScore.has(score)) byScore.set(score, []);
      byScore.get(score).push(observation);
    }
    let segment = [];
    let previousMinute = null;
    for (const [minute, scores] of [...grouped.entries()].sort(([a], [b]) => a - b)) {
      if (scores.size > 1 || (previousMinute !== null && minute - previousMinute > 180)) {
        drawSegment(plot, segment, domain);
        segment = [];
      }
      for (const [score, entries] of scores) {
        const first = entries[0];
        const details = entries.map((entry) => [entry.note, entry.context].filter(Boolean).join(" · ")).filter(Boolean);
        const label = `${domain.label}: ${score}/10 at ${timeLabel(first.time)}${entries.length > 1 ? ` (${entries.length} entries)` : ""}.${details.length ? ` ${details.join("; ")}` : ""}`;
        renderedPoints.push({ x: x(minute), score, domain, label, count: entries.length, tooltip: `${domain.label} · ${score}/10\n${timeLabel(first.time)}${entries.length > 1 ? ` · ${entries.length} entries` : ""}${details.length ? `\n${details.join("\n")}` : ""}` });
        if (scores.size === 1) segment.push({ x: x(minute), score });
      }
      if (scores.size > 1) previousMinute = null;
      else previousMinute = minute;
    }
    drawSegment(plot, segment, domain);
  }
  // Markers above all lines keep scores legible where two variables intersect.
  for (const point of renderedPoints) drawPoint(plot, point.x, point.score, point.domain, point.label, point.count, point.tooltip);
  if (!observations.length) {
    if (!domains.length) emptyMessage(plot, "No symptoms selected", events.length ? "Medication events shown." : "Select a variable above.");
    else emptyMessage(plot, "No ratings in this range", "Choose another variable or range.");
  }
}

/** Daily arithmetic means, with sample counts and no lines across missing days. */
export function renderTrendChart(container, dataset, options = {}) {
  container.replaceChildren();
  const domains = selectedDomains(dataset, options.domainIds);
  for (const domain of domains) {
    const panel = document.createElement('section'); panel.className = 'chart-panel';
    const heading = document.createElement('p'); heading.className = 'chart-scale';
    heading.textContent = `${domain.label}: 1 · ${domain.lowLabel} / 10 · ${domain.highLabel}`;
    const chart = document.createElement('div'); panel.append(heading, chart); container.append(panel);
    renderTrendPanel(chart, dataset, { ...options, domainIds: [domain.id] });
  }
}

function renderTrendPanel(container, dataset, { startDate, endDate, domainIds } = {}) {
  const domains = selectedDomains(dataset, domainIds);
  const observedDays = (dataset.observations || []).map((entry) => dateNumber(entry.date)).filter((day) => day !== null);
  const today = Math.floor(Date.now() / DAY_MS);
  const first = startDate === undefined ? (observedDays.length ? observedDays.reduce((min, day) => Math.min(min, day), Infinity) : today - 6) : dateNumber(startDate);
  const last = endDate === undefined ? (observedDays.length ? observedDays.reduce((max, day) => Math.max(max, day), -Infinity) : today) : dateNumber(endDate);
  const validRange = first !== null && last !== null && first <= last;
  const plot = createChart(container, "Daily symptom averages",
    "Each point is the arithmetic mean of the recorded scores for one symptom on one day. Each tooltip includes its observation count. Missing days have no values and break connecting lines. The vertical scale is 1 to 10; each symptom has its own scale endpoints. These are descriptive observations, not evidence of a medication effect.",
    "Points show daily averages. Hover over or focus on a point for the entry count. Days without entries appear as gaps. Check-in times may differ between days.");
  if (!validRange) {
    emptyMessage(plot, "Choose a valid date range", "The end date needs to be on or after the start date.");
    return;
  }
  const x = (day) => first === last ? (plot.margin.left + plot.right) / 2 : plot.margin.left + ((day - first) / (last - first)) * (plot.right - plot.margin.left);
  const span = last - first;
  const step = Math.max(1, Math.ceil(span / (plot.width < 450 ? 3 : 6)));
  const ticks = [];
  for (let day = first; day <= last; day += step) ticks.push(day);
  if (ticks[ticks.length - 1] !== last && last - ticks[ticks.length - 1] > step * 0.6) ticks.push(last);
  for (const day of ticks) {
    plot.svg.append(svgElement("text", {
      x: x(day), y: plot.height - 11, fill: "#6c6d60", "font-size": 14,
      "text-anchor": first === last ? "middle" : day === first ? "start" : day === last ? "end" : "middle", "aria-hidden": "true"
    }, dateLabel(day)));
  }
  let totalPoints = 0;
  const renderedPoints = [];
  for (const domain of domains) {
    const byDay = new Map();
    for (const observation of dataset.observations || []) {
      const day = dateNumber(observation.date);
      if (observation.domain !== domain.id || day === null || day < first || day > last || !validScore(observation.score)) continue;
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(Number(observation.score));
    }
    let segment = [];
    let previousDay = null;
    for (const [day, scores] of [...byDay.entries()].sort(([a], [b]) => a - b)) {
      if (previousDay !== null && day - previousDay !== 1) { drawSegment(plot, segment, domain); segment = []; }
      const score = scores.reduce((sum, value) => sum + value, 0) / scores.length;
      const average = Number(score.toFixed(1));
      const minimum = scores.reduce((min, value) => Math.min(min, value), Infinity);
      const maximum = scores.reduce((max, value) => Math.max(max, value), -Infinity);
      const label = `${domain.label} on ${dateLabel(day, true)}: daily average ${average}/10 from ${scores.length} ${scores.length === 1 ? "entry" : "entries"}; recorded range ${minimum}–${maximum}.`;
      segment.push({ x: x(day), score });
      renderedPoints.push({ x: x(day), score, domain, label, tooltip: `${domain.label} · average ${average}/10\n${dateLabel(day, true)} · ${scores.length} ${scores.length === 1 ? "entry" : "entries"}\nRecorded range: ${minimum}–${maximum}` });
      previousDay = day;
      totalPoints++;
    }
    drawSegment(plot, segment, domain);
  }
  for (const point of renderedPoints) drawPoint(plot, point.x, point.score, point.domain, point.label, 1, point.tooltip);
  if (!totalPoints) emptyMessage(plot, domains.length ? "No ratings in this range" : "No symptoms selected", domains.length ? "Choose another range." : "Select a variable above.");
}
