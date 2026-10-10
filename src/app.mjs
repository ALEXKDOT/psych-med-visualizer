import {
  createBlankDataset, createDemoDataset, getDomains, domainLabel, makeId, localDateString,
  validateDataset, getCheckIns, saveCheckIn, deleteCheckIn, removeMedicationEvent,
  resolveCheckInTime, reviewCoverage, localDateTime
} from './model.mjs?v=sample-day-20261010';
import { renderDailyChart, renderTrendChart } from './charts.mjs?v=sample-day-20261010';

const $ = id => document.getElementById(id);
const DEFAULT_TRACKERS = ['attention_focus', 'task_initiation', 'energy', 'sedation_fatigue', 'anxiety_distress'];
const makeSession = data => ({ data, tracked: [...DEFAULT_TRACKERS], quick: ['attention_focus', 'task_initiation'], visible: new Set(['attention_focus']), drafts: new Map(), date: localDateString() });
let sample = makeSession(createDemoDataset());
let blank = null;
let session = sample;
let currentView = 'journal';
let dialogDraft = null;
let dialogKey = '';
let dialogSaved = false;
let toastTimer, resizeTimer;
const domains = () => getDomains(session.data);
const trackedDomains = () => session.tracked.map(id => domains().find(d => d.id === id)).filter(Boolean);
const clone = value => structuredClone(value);
const currentTime = () => new Date().toTimeString().slice(0, 5);
const dateLabel = (value, options = {}) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...options });
const timeLabel = value => new Date(`2000-01-01T${value}:00`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const inRange = (item, range) => item.date >= range.startDate && item.date <= range.endDate;
function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4200); }
function selectValue(select, value) { if (![...select.options].some(o => o.value === value)) select.add(new Option(value, value)); select.value = value; }
function setOptions(select, options, value) { select.replaceChildren(...options.map(([label, id]) => new Option(label, id))); select.value = value; }
function initializeRange() { const start = new Date(); start.setDate(start.getDate() - 6); $('review-start').value = localDateString(start); $('review-end').value = localDateString(); }
initializeRange();

function newDraft(date = session.date) {
  return { date, time: currentTime(), timeMode: date === localDateString() ? 'now' : 'earlier', startedAt: null, values: new Map(), note: '', reporter: 'Patient', context: 'Home', link: '', sleepHours: null, sleepQuality: '', circumstances: '', touched: false };
}
function quickDraft() {
  const key = `checkin:${session.date}`;
  if (!session.drafts.has(key)) session.drafts.set(key, newDraft());
  return session.drafts.get(key);
}
function beginDraft(draft) {
  if (draft.timeMode === 'now' && !draft.startedAt) draft.startedAt = resolveCheckInTime(draft);
  draft.touched = true;
}
function draftTime(draft) { return draft.timeMode === 'now' && draft.startedAt ? draft.startedAt : resolveCheckInTime(draft); }
function updateDraftLabel() {
  const draft = quickDraft();
  $('draft-status').textContent = draft.touched ? 'Draft kept' : '';
  $('checkin-now').textContent = session.drafts.get(`checkin:${localDateString()}`)?.touched ? 'Resume check-in' : 'Check in now';
  $('quick-title').textContent = draft.timeMode === 'now' ? 'Check in now' : 'Add a check-in';
  $('quick-timestamp').textContent = draft.timeMode === 'now'
    ? draft.startedAt ? `Recording started ${dateLabel(draft.startedAt.date)} at ${timeLabel(draft.startedAt.time)}. Select Earlier to change it.` : 'Time is set when you start recording.'
    : `Recording for ${dateLabel(draft.date)} at your chosen time.`;
}
function readQuick() {
  const draft = quickDraft();
  draft.note = $('quick-note').value;
  draft.context = $('quick-context').value;
  draft.time = $('quick-time').value;
  draft.sleepHours = $('quick-sleep-hours').value === '' ? null : Number($('quick-sleep-hours').value);
  draft.sleepQuality = $('quick-sleep-quality').value;
  draft.circumstances = $('quick-circumstances').value;
  return draft;
}
function renderQuick() {
  const draft = quickDraft();
  $('quick-when').value = draft.timeMode;
  $('quick-when').options[0].disabled = session.date !== localDateString();
  $('quick-time-field').hidden = draft.timeMode !== 'earlier';
  $('quick-time').required = draft.timeMode === 'earlier';
  $('quick-time').value = draft.time;
  $('quick-note').value = draft.note;
  selectValue($('quick-context'), draft.context);
  $('quick-sleep-hours').value = draft.sleepHours ?? '';
  $('quick-sleep-quality').value = draft.sleepQuality;
  $('quick-circumstances').value = draft.circumstances;
  const list = session.quick.map(id => domains().find(d => d.id === id)).filter(Boolean);
  $('quick-ratings').replaceChildren(...list.map(d => ratingControl(d, draft, 'quick')));
  const extraCount = [...draft.values.keys()].filter(id => !session.quick.includes(id)).length;
  $('full-checkin').textContent = extraCount ? `More variables & details (${extraCount} additional ratings)` : 'More variables & details';
  updateDraftLabel();
}
function ratingControl(domain, draft, prefix) {
  const item = node('fieldset', 'rating-control');
  const legend = node('legend', '', domain.label);
  const output = node('output', 'rating-value');
  const controls = node('div', 'rating-options');
  controls.setAttribute('role', 'radiogroup'); controls.setAttribute('aria-label', domain.label);
  const buttons = [];
  const refresh = () => {
    output.textContent = draft.values.has(domain.id) ? `${draft.values.get(domain.id)} / 10` : 'Not rated';
    buttons.forEach((button, i) => {
      const selected = draft.values.get(domain.id) === i + 1;
      button.setAttribute('aria-checked', String(selected));
      button.tabIndex = selected || (!draft.values.has(domain.id) && i === 0) ? 0 : -1;
    });
  };
  const choose = score => { beginDraft(draft); draft.values.set(domain.id, score); refresh(); if (prefix === 'quick') updateDraftLabel(); };
  for (let score = 1; score <= 10; score++) {
    const button = node('button', 'rating-option', String(score)); button.type = 'button'; button.setAttribute('role', 'radio');
    button.setAttribute('aria-label', `${score} of 10${score === 1 ? ` · ${domain.lowLabel}` : score === 10 ? ` · ${domain.highLabel}` : ''}`);
    button.addEventListener('click', () => choose(score));
    button.addEventListener('keydown', event => {
      let next = score;
      if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = score === 10 ? 1 : score + 1;
      else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = score === 1 ? 10 : score - 1;
      else if (event.key === 'Home') next = 1;
      else if (event.key === 'End') next = 10;
      else return;
      event.preventDefault(); choose(next); buttons[next - 1].focus();
    });
    buttons.push(button); controls.append(button);
  }
  const clear = node('button', 'clear-rating', 'Clear / skip'); clear.type = 'button'; clear.setAttribute('aria-label', `Clear ${domain.label} rating`);
  clear.addEventListener('click', () => { draft.values.delete(domain.id); refresh(); });
  const top = node('div', 'rating-tools'); top.append(output, clear);
  const anchors = node('div', 'rating-anchors'); anchors.append(node('span', '', `1 · ${domain.lowLabel}`), node('span', '', `10 · ${domain.highLabel}`));
  item.append(legend, top, controls, anchors); refresh(); return item;
}
function transact(change) {
  const next = clone(session.data); change(next);
  const errors = validateDataset(next);
  if (errors.length) { toast(errors[0]); return false; }
  next.updatedAt = new Date().toISOString(); session.data = next; return true;
}
function render() {
  $('demo-banner').hidden = session !== sample;
  $('start-journal').textContent = blank ? 'Return to blank demo →' : 'Try a blank demo →';
  $('profile-alias').textContent = session === sample ? 'Fictional sample' : 'Blank demo';
  $('storage-status').textContent = 'Session only · not saved';
  $('footer-mode').textContent = 'Entries disappear on refresh';
  $('journal-date').value = session.date;
  $('day-label').textContent = dateLabel(session.date, { weekday: 'long', year: 'numeric' });
  renderQuick(); renderChartControls(); renderDaily(); renderTimeline(); renderHours();
  if (currentView === 'settings') renderSettings();
  if (currentView === 'trends') renderReview();
}
function setView(view) {
  currentView = view;
  for (const name of ['journal', 'trends', 'settings']) $(name + '-view').hidden = name !== view;
  document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === view); b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false'); });
  $('breadcrumb-current').textContent = { journal: 'Daily journal', trends: 'Visit summary', settings: 'Journal settings' }[view];
  render();
}
function renderChartControls() {
  const selected = session.tracked.filter(id => session.visible.has(id));
  const value = selected[0] || session.tracked[0] || '';
  if (!selected.length && value) session.visible.add(value);
  setOptions($('primary-variable'), trackedDomains().map(d => [d.label, d.id]), value);
  renderToggles('variable-toggles'); renderToggles('trend-toggles');
}
function renderToggles(targetId) {
  const target = $(targetId); target.replaceChildren();
  for (const d of trackedDomains()) {
    const label = node('label', 'variable-toggle'); const input = node('input'); input.type = 'checkbox'; input.checked = session.visible.has(d.id); input.dataset.domain = d.id;
    input.setAttribute('aria-label', `Show ${d.label}`);
    input.addEventListener('change', () => {
      if (!input.checked && session.visible.size === 1) { input.checked = true; toast('Keep one variable selected.'); return; }
      input.checked ? session.visible.add(d.id) : session.visible.delete(d.id);
      // Keep both sets of existing controls in place so keyboard focus survives.
      for (const checkbox of document.querySelectorAll('.variable-toggles input')) checkbox.checked = session.visible.has(checkbox.dataset.domain);
      $('primary-variable').value = session.tracked.find(id => session.visible.has(id)) || '';
      renderDaily(); if (currentView === 'trends') renderReview();
    });
    label.append(input, document.createTextNode(d.label)); target.append(label);
  }
}
function renderDaily() {
  const checkIns = getCheckIns(session.data).filter(c => c.date === session.date);
  const meds = session.data.medicationEvents.filter(e => e.date === session.date);
  const ratings = session.data.observations.filter(o => o.date === session.date);
  $('daily-chart-card').hidden = !ratings.length && !meds.length;
  $('timeline-card').hidden = !checkIns.length && !meds.length;
  $('hourly-details').hidden = !checkIns.length && !meds.length;
  $('chart-title').textContent = session.date === localDateString() ? 'Today’s pattern' : `Pattern for ${dateLabel(session.date)}`;
  const times = new Set(checkIns.map(o => o.time)).size;
  $('daily-coverage').textContent = `${checkIns.length} ${checkIns.length === 1 ? 'check-in' : 'check-ins'} · ${times} recorded ${times === 1 ? 'time' : 'times'}`;
  renderDailyChart($('daily-chart'), session.data, { date: session.date, domainIds: [...session.visible], showMedication: $('show-medication').checked, timeRange: $('chart-range').value, layout: $('chart-layout').value });
}
function renderHours() {
  const filled = new Set(getCheckIns(session.data).filter(c => c.date === session.date).map(c => Number(c.time.slice(0, 2))));
  $('hour-strip').replaceChildren();
  for (let hour = 0; hour < 24; hour++) {
    const time = `${String(hour).padStart(2, '0')}:00`;
    const button = node('button', 'hour-button' + (filled.has(hour) ? ' recorded' : ''), timeLabel(time));
    button.addEventListener('click', () => openEntry('checkin', null, time)); $('hour-strip').append(button);
  }
}
function entrySummary(item) {
  const content = node('div', 'timeline-content');
  const med = item.type === 'medication';
  content.append(node('strong', '', med ? item.medication : item.ratings.length ? 'Check-in' : 'Note'));
  if (med) content.append(node('p', 'timeline-meta', `${item.formulation} · ${item.doseText} · ${item.status}`));
  else {
    const scores = node('div', 'entry-scores');
    item.ratings.forEach(o => scores.append(node('span', 'score-pill', `${domainLabel(o.domain, session.data)} ${o.score}/10`)));
    content.append(scores, node('p', 'timeline-meta', `${item.reporter} · ${item.context}${item.medicationEventId ? ' · Linked medication event' : ''}`));
    const context = [item.sleepHours !== null && item.sleepHours !== undefined ? `Sleep: ${item.sleepHours} h` : '', item.sleepQuality, item.circumstances].filter(Boolean);
    if (context.length) content.append(node('p', 'timeline-meta', context.join(' · ')));
  }
  if (item.note) content.append(node('p', 'timeline-note', item.note));
  return content;
}
function entryRow(item) {
  const row = node('article', 'timeline-row'); const med = item.type === 'medication';
  const actions = node('div', 'row-actions');
  if (!med) {
    const pin = node('button', '', item.pinned ? 'Unpin' : 'Pin for visit'); pin.setAttribute('aria-pressed', String(item.pinned));
    pin.addEventListener('click', () => {
      if (transact(next => {
        const current = getCheckIns(next).find(c => c.id === item.id);
        saveCheckIn(next, new Map(current.ratings.map(o => [o.domain, o.score])), { ...current, link: current.medicationEventId, pinned: !current.pinned }, current.id);
      })) { item.pinned = !item.pinned; pin.textContent = item.pinned ? 'Unpin' : 'Pin for visit'; pin.setAttribute('aria-pressed', String(item.pinned)); if (currentView === 'trends') renderReview(); }
    }); actions.append(pin);
  }
  const edit = node('button', '', 'Edit'); edit.setAttribute('aria-label', `Edit ${med ? item.medication : 'check-in'} at ${timeLabel(item.time)}`); edit.addEventListener('click', () => openEntry(med ? 'medication' : 'checkin', item));
  const remove = node('button', '', 'Delete'); remove.setAttribute('aria-label', `Delete ${med ? item.medication : 'check-in'} at ${timeLabel(item.time)}`);
  remove.addEventListener('click', () => {
    if (!confirm(`Delete this ${med ? 'medication event? Linked check-ins will be kept without this link.' : 'check-in and its ratings?'}`)) return;
    if (transact(next => med ? removeMedicationEvent(next, item.id) : deleteCheckIn(next, item.id))) {
      session.drafts.delete(`edit:${item.id}`);
      if (med) for (const draft of session.drafts.values()) if (draft.link === item.id) draft.link = '';
      render(); toast('Entry deleted.');
    }
  }); actions.append(edit, remove);
  const time = node('time', 'timeline-time', timeLabel(item.time)); time.dateTime = `${item.date}T${item.time}`;
  row.append(time, entrySummary(item), actions); return row;
}
function renderTimeline() {
  const checkIns = getCheckIns(session.data).filter(c => c.date === session.date).reverse().sort((a, b) => b.time.localeCompare(a.time));
  $('latest-checkin').replaceChildren(checkIns.length ? entryRow(checkIns[0]) : node('p', 'empty-state', 'Start with one observation. There’s no need to fill every rating or every hour.'));
  const filter = $('entry-filter').value;
  const entries = [
    ...(filter !== 'medication' ? checkIns.slice(1) : []),
    ...(filter !== 'symptoms' ? session.data.medicationEvents.filter(e => e.date === session.date).map(e => ({ ...e, type: 'medication' })) : [])
  ].sort((a, b) => b.time.localeCompare(a.time));
  $('entries-description').textContent = `${checkIns.length} ${checkIns.length === 1 ? 'check-in' : 'check-ins'} for ${dateLabel(session.date)} · latest shown above`;
  $('timeline').replaceChildren(...entries.map(entryRow));
  if (!entries.length) $('timeline').append(node('p', 'empty-state', 'No earlier entries for this selection.'));
}
function populateLinks(selected = '') {
  const events = [...session.data.medicationEvents].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  setOptions($('entry-link'), [['No linked event', ''], ...events.map(e => [`${e.date} ${e.time} · ${e.medication} · ${e.doseText} (${e.status})`, e.id])], selected);
}
function openEntry(type, existing = null, time = null) {
  const med = type === 'medication';
  // Hourly capture uses a separate draft and never replaces the quick draft.
  dialogKey = existing ? `edit:${existing.id}` : time ? `hour:${session.date}:${time}` : `${type}:${session.date}`;
  const stored = session.drafts.get(dialogKey);
  dialogDraft = stored ? clone(stored) : existing ? {
    ...newDraft(existing.date), ...existing, values: new Map((existing.ratings || []).map(o => [o.domain, o.score])), link: existing.medicationEventId || '', timeMode: 'earlier'
  } : newDraft();
  if (time && !stored) { dialogDraft.time = time; dialogDraft.timeMode = 'earlier'; }
  beginDraft(dialogDraft);
  const stamp = draftTime(dialogDraft);
  dialogDraft.date = stamp.date; dialogDraft.time = stamp.time; dialogDraft.timeMode = 'earlier';
  dialogSaved = false;
  $('entry-form').reset(); $('entry-error').textContent = '';
  $('entry-id').value = existing?.id || ''; $('entry-type').value = type;
  $('entry-date').value = dialogDraft.date; $('entry-time').value = dialogDraft.time; $('entry-note').value = dialogDraft.note;
  $('medication-fields').hidden = !med; $('symptom-fields').hidden = med;
  $('entry-title').textContent = existing ? `Edit ${med ? 'medication event' : 'check-in'}` : med ? 'Log medication' : 'Check-in details';
  $('save-entry').textContent = existing ? 'Update entry' : med ? 'Record medication' : 'Record check-in';
  for (const id of ['medication-name', 'medication-formulation', 'medication-dose']) $(id).required = med;
  if (med) {
    $('medication-name').value = dialogDraft.medication || ''; $('medication-formulation').value = dialogDraft.formulation || ''; $('medication-dose').value = dialogDraft.doseText || ''; $('medication-status').value = dialogDraft.status || 'taken';
    $('medication-suggestions').replaceChildren(...[...new Set(session.data.medicationEvents.map(e => e.medication))].map(m => new Option(m)));
  } else {
    selectValue($('entry-reporter'), dialogDraft.reporter); selectValue($('entry-context'), dialogDraft.context); populateLinks(dialogDraft.link);
    $('entry-sleep-hours').value = dialogDraft.sleepHours ?? ''; $('entry-sleep-quality').value = dialogDraft.sleepQuality; $('entry-circumstances').value = dialogDraft.circumstances;
    const ids = new Set([...session.quick, ...session.tracked, ...dialogDraft.values.keys()]);
    $('entry-ratings').replaceChildren(...[...ids].map(id => domains().find(d => d.id === id)).filter(Boolean).map(d => ratingControl(d, dialogDraft, 'entry')));
  }
  $('entry-dialog').showModal();
}
function readDialog() {
  Object.assign(dialogDraft, { date: $('entry-date').value, time: $('entry-time').value, timeMode: 'earlier', note: $('entry-note').value,
    reporter: $('entry-reporter').value, context: $('entry-context').value, link: $('entry-link').value,
    sleepHours: $('entry-sleep-hours').value === '' ? null : Number($('entry-sleep-hours').value), sleepQuality: $('entry-sleep-quality').value, circumstances: $('entry-circumstances').value,
    medication: $('medication-name').value, formulation: $('medication-formulation').value, doseText: $('medication-dose').value, status: $('medication-status').value });
  return dialogDraft;
}
$('entry-dialog').addEventListener('close', () => {
  if (dialogDraft && !dialogSaved) { readDialog(); session.drafts.set(dialogKey, clone(dialogDraft)); }
  dialogDraft = null; renderQuick();
});
$('discard-entry').addEventListener('click', () => { session.drafts.delete(dialogKey); dialogSaved = true; $('entry-dialog').close(); toast('Draft discarded.'); });
$('quick-form').addEventListener('submit', event => {
  event.preventDefault(); const draft = readQuick(); $('quick-error').textContent = '';
  if (!draft.values.size && !draft.note.trim()) { $('quick-error').textContent = 'Choose a rating or write a note.'; return; }
  beginDraft(draft); const stamp = draftTime(draft);
  if (!localDateTime(stamp.date, stamp.time)) { $('quick-error').textContent = 'Choose a valid local date and time.'; return; }
  const key = `checkin:${session.date}`;
  if (transact(next => saveCheckIn(next, draft.values, { ...draft, ...stamp, note: draft.note.trim() }))) {
    session.drafts.delete(key); session.date = stamp.date; render(); toast('Check-in recorded.');
  }
});
$('entry-form').addEventListener('submit', event => {
  event.preventDefault(); const draft = readDialog(); const med = $('entry-type').value === 'medication'; const id = $('entry-id').value;
  $('entry-error').textContent = '';
  if (!localDateTime(draft.date, draft.time)) { $('entry-error').textContent = 'Choose a valid local date and time.'; return; }
  if (!med && !draft.values.size && !draft.note.trim()) { $('entry-error').textContent = 'Choose a rating or write a note.'; return; }
  const next = clone(session.data);
  if (med) {
    const record = { id: id || makeId('medication'), date: draft.date, time: draft.time, note: draft.note.trim(), medication: draft.medication.trim(), formulation: draft.formulation.trim(), doseText: draft.doseText.trim(), status: draft.status };
    if (id) next.medicationEvents = next.medicationEvents.map(e => e.id === id ? record : e); else next.medicationEvents.push(record);
  } else saveCheckIn(next, draft.values, { ...draft, note: draft.note.trim() }, id);
  const errors = validateDataset(next);
  if (errors.length) { $('entry-error').textContent = errors[0]; return; }
  next.updatedAt = new Date().toISOString(); session.data = next; session.drafts.delete(dialogKey); session.date = draft.date;
  dialogSaved = true; $('entry-dialog').close(); render(); toast(id ? 'Entry updated.' : med ? 'Medication recorded.' : 'Check-in recorded.');
});
for (const id of ['quick-note', 'quick-context', 'quick-time', 'quick-sleep-hours', 'quick-sleep-quality', 'quick-circumstances']) $(id).addEventListener('input', () => { beginDraft(readQuick()); updateDraftLabel(); });
$('quick-when').addEventListener('change', () => {
  const draft = readQuick(); const previousTime = draftTime(draft);
  draft.timeMode = $('quick-when').value;
  draft.time = previousTime.time; draft.startedAt = null;
  if (draft.timeMode === 'now' && draft.touched) beginDraft(draft);
  renderQuick();
});
$('discard-quick').addEventListener('click', () => { session.drafts.delete(`checkin:${session.date}`); $('quick-error').textContent = ''; renderQuick(); toast('Draft discarded.'); });

function renderSettings() {
  $('explore-demo').textContent = session === sample && blank ? 'Return to blank demo' : 'Open sample journal';
  renderQuickPreferences(); renderCatalog();
}
function renderQuickPreferences() {
  $('quick-preferences').replaceChildren();
  for (let index = 0; index < 3; index++) {
    const label = node('label', '', index === 2 ? 'Third variable (optional)' : `Favorite ${index + 1}`);
    const select = node('select'); select.id = `quick-favorite-${index}`;
    setOptions(select, [...(index === 2 ? [['None', '']] : []), ...domains().map(d => [d.label, d.id])], session.quick[index] || '');
    select.addEventListener('change', () => {
      const previous = session.quick[index] || '';
      const chosen = select.value;
      const other = session.quick.findIndex((id, i) => i !== index && id === chosen);
      if (other >= 0) {
        // Swapping populated slots makes reordering direct and keeps favorites unique.
        if (!previous && other < 2) { $('preferences-error').textContent = 'That variable is already a favorite. Choose another for the optional third slot.'; select.value = ''; return; }
        $(`quick-favorite-${other}`).value = previous;
      }
      const ids = [0, 1, 2].map(i => $(`quick-favorite-${i}`).value).filter(Boolean);
      $('preferences-error').textContent = ''; session.quick = ids;
      for (const id of ids) if (!session.tracked.includes(id)) session.tracked.push(id);
      renderQuick(); renderChartControls(); renderCatalog();
    }); label.append(select); $('quick-preferences').append(label);
  }
}
function renderCatalog() {
  const search = $('tracker-search').value.trim().toLowerCase(); const list = domains().filter(d => `${d.label} ${d.group}`.toLowerCase().includes(search));
  $('tracker-catalog').replaceChildren();
  for (const group of [...new Set(list.map(d => d.group))]) {
    const section = node('section', 'tracker-group'); section.append(node('h3', '', group));
    for (const d of list.filter(d => d.group === group)) {
      const label = node('label', 'tracker-item'); const input = node('input'); input.type = 'checkbox'; input.checked = session.tracked.includes(d.id);
      input.addEventListener('change', () => {
        if (!input.checked && session.quick.includes(d.id)) { input.checked = true; toast('Change this quick favorite above before removing it.'); return; }
        if (input.checked) session.tracked.push(d.id); else { session.tracked = session.tracked.filter(id => id !== d.id); session.visible.delete(d.id); }
        renderChartControls();
      });
      const text = node('span', '', d.label); text.append(node('small', '', `1 · ${d.lowLabel} / 10 · ${d.highLabel}`)); label.append(input, text); section.append(label);
    }
    $('tracker-catalog').append(section);
  }
  if (!list.length) $('tracker-catalog').append(node('p', 'empty-state', 'No matching variables. Add a custom variable if needed.'));
}
$('custom-form').addEventListener('submit', event => {
  event.preventDefault(); const label = $('custom-label').value.trim(), lowLabel = $('custom-low').value.trim(), highLabel = $('custom-high').value.trim();
  if (!label || !lowLabel || !highLabel) { $('custom-error').textContent = 'Enter a name and both scale descriptions.'; return; }
  if (domains().some(d => d.label.toLowerCase() === label.toLowerCase())) { $('custom-error').textContent = 'A variable with this name already exists.'; return; }
  const id = makeId('custom');
  if (transact(next => next.customDomains.push({ id, label, lowLabel, highLabel, group: 'Custom', kind: 'custom', color: '#475569' }))) {
    session.tracked.push(id); $('custom-dialog').close(); $('tracker-search').value = ''; render(); toast('Custom variable added.');
  }
});
function createTable(headers, rows) {
  if (!rows.length) return node('p', 'empty-state', 'No entries for this selection.');
  const table = node('table'), head = node('thead'), headRow = node('tr'), body = node('tbody');
  headers.forEach(h => { const th = node('th', '', h); th.scope = 'col'; headRow.append(th); }); head.append(headRow);
  rows.forEach(row => { const tr = node('tr'); row.forEach(value => tr.append(node('td', '', String(value ?? '')))); body.append(tr); }); table.append(head, body); return table;
}
function reviewRange() {
  const startDate = $('review-start').value, endDate = $('review-end').value;
  const error = !startDate || !endDate ? 'Choose both dates.' : startDate > endDate ? 'The start date must be on or before the end date.' : '';
  $('review-error').textContent = error; return error ? null : { startDate, endDate };
}
function renderReview() {
  const range = reviewRange();
  for (const id of ['review-summary', 'review-pinned', 'review-domain-summary', 'trend-chart', 'review-days', 'review-medications', 'review-observations']) $(id).replaceChildren();
  $('review-count').textContent = ''; $('summary-subtitle').textContent = '';
  if (!range) return;
  const all = getCheckIns(session.data);
  for (const [key, id, label] of [['reporter', 'review-reporter', 'All reporters'], ['context', 'review-context', 'All contexts']]) {
    const select = $(id), value = select.value;
    setOptions(select, [[label, ''], ...[...new Set(all.map(c => c[key]))].sort().map(v => [v, v])], value); if (!select.value) select.value = '';
  }
  const reporter = $('review-reporter').value, context = $('review-context').value;
  const matches = c => (!reporter || c.reporter === reporter) && (!context || c.context === context);
  const filtered = { ...session.data, observations: session.data.observations.filter(matches), checkIns: (session.data.checkIns || []).filter(matches) };
  const checkIns = getCheckIns(filtered).filter(c => inRange(c, range)).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const meds = session.data.medicationEvents.filter(e => inRange(e, range)).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const coverage = reviewCoverage(filtered, range.startDate, range.endDate);
  $('summary-subtitle').textContent = `${session === sample ? 'Fictional sample · ' : ''}${dateLabel(range.startDate, { year: 'numeric' })} – ${dateLabel(range.endDate, { year: 'numeric' })}${reporter || context ? ' · filtered check-ins' : ''}`;
  $('review-count').textContent = `${coverage.checkIns} ${coverage.checkIns === 1 ? 'check-in' : 'check-ins'}`;
  for (const [value, label] of [[`${coverage.recorded} / ${coverage.days}`, 'days with check-ins'], [coverage.missing, 'days without check-ins'], [coverage.checkIns, 'check-ins in this selection']]) {
    const card = node('div', 'review-stat'); card.append(node('strong', '', String(value)), document.createTextNode(label)); $('review-summary').append(card);
  }
  const planning = session.data.visitPlanning || {};
  for (const key of ['concerns', 'goals', 'questions']) if (document.activeElement !== $('visit-' + key)) $('visit-' + key).value = planning[key] || '';
  const pinned = checkIns.filter(c => c.pinned);
  if (!pinned.length) $('review-pinned').append(node('p', 'empty-state', 'Pin a check-in from the daily journal to bring it here.'));
  for (const item of pinned) { const card = node('article', 'pinned-observation'); card.append(node('p', 'eyebrow', `${dateLabel(item.date)} · ${timeLabel(item.time)}`), entrySummary(item)); $('review-pinned').append(card); }
  const rows = [...session.visible].map(id => {
    const d = domains().find(d => d.id === id); const observations = filtered.observations.filter(o => o.domain === id && inRange(o, range));
    const recordedDays = new Set(observations.map(o => o.date)).size;
    const average = observations.length ? (observations.reduce((sum, o) => sum + o.score, 0) / observations.length).toFixed(1) : 'Not recorded';
    return [d.label, average, `${observations.length} ${observations.length === 1 ? 'rating' : 'ratings'} across ${recordedDays} recorded ${recordedDays === 1 ? 'day' : 'days'}`, `1 · ${d.lowLabel}; 10 · ${d.highLabel}`];
  });
  $('review-domain-summary').append(createTable(['Variable', 'Average / 10', 'Coverage', 'Scale meaning'], rows));
  renderTrendChart($('trend-chart'), filtered, { ...range, domainIds: [...session.visible], onSelectDate: openReviewDay });
  for (const date of [...new Set(checkIns.map(c => c.date))].sort()) {
    const button = node('button', 'button secondary', `Explore ${dateLabel(date)}`); button.addEventListener('click', () => openReviewDay(date)); $('review-days').append(button);
  }
  $('review-medications').append(createTable(['Date & time', 'Medication', 'Formulation', 'Dose', 'Status', 'Notes'], meds.map(e => [`${e.date} ${e.time}`, e.medication, e.formulation, e.doseText, e.status, e.note])));
  $('review-observations').append(createTable(['Date & time', 'Ratings', 'Reporter / context', 'Notes & circumstances'], checkIns.map(c => [`${c.date} ${c.time}`, c.ratings.map(o => `${domainLabel(o.domain, session.data)} ${o.score}/10`).join('; ') || 'Note only', `${c.reporter} / ${c.context}`, [c.note, c.sleepHours !== null ? `Sleep ${c.sleepHours} h` : '', c.sleepQuality, c.circumstances].filter(Boolean).join(' · ')])));
}
function openReviewDay(date) { session.date = date; setView('journal'); const target = $($('daily-chart-card').hidden ? 'latest-card' : 'daily-chart-card'); target.tabIndex = -1; target.focus(); }
function changeDate(date) { if (!localDateTime(date, '12:00')) return; session.date = date; $('quick-error').textContent = ''; render(); }
function moveDate(offset) { const date = new Date(`${session.date}T12:00:00`); date.setDate(date.getDate() + offset); changeDate(localDateString(date)); }
for (const key of ['concerns', 'goals', 'questions']) $('visit-' + key).addEventListener('input', () => { session.data.visitPlanning ||= { concerns: '', goals: '', questions: '' }; session.data.visitPlanning[key] = $('visit-' + key).value; session.data.updatedAt = new Date().toISOString(); });
for (const id of ['review-start', 'review-end', 'review-reporter', 'review-context']) $(id).addEventListener('change', renderReview);
for (const id of ['show-medication', 'chart-range', 'chart-layout']) $(id).addEventListener('change', renderDaily);
$('primary-variable').addEventListener('change', () => { session.visible = new Set([$('primary-variable').value]); renderToggles('variable-toggles'); renderToggles('trend-toggles'); renderDaily(); });
$('tracker-search').addEventListener('input', renderCatalog);
$('start-journal').addEventListener('click', () => { blank ||= makeSession(createBlankDataset()); session = blank; setView('journal'); toast('Blank demo opened. Entries last only while this page is open.'); });
$('explore-demo').addEventListener('click', () => { session = session === sample && blank ? blank : sample; setView('journal'); });
$('log-medication').addEventListener('click', () => openEntry('medication'));
$('full-checkin').addEventListener('click', () => { readQuick(); openEntry('checkin'); });
$('checkin-now').addEventListener('click', () => { changeDate(localDateString()); $('quick-form').focus(); });
$('add-note').addEventListener('click', () => $('quick-note').focus());
$('skip-checkin').addEventListener('click', event => { event.preventDefault(); setView('journal'); $('quick-form').focus(); });
$('manage-trackers').addEventListener('click', () => { setView('settings'); $('tracker-search').focus(); });
$('add-custom').addEventListener('click', () => { $('custom-form').reset(); $('custom-error').textContent = ''; $('custom-dialog').showModal(); });
$('visit-button').addEventListener('click', () => setView('trends'));
$('entry-filter').addEventListener('change', renderTimeline);
$('previous-day').addEventListener('click', () => moveDate(-1)); $('next-day').addEventListener('click', () => moveDate(1)); $('today-button').addEventListener('click', () => changeDate(localDateString()));
$('journal-date').addEventListener('change', event => { if (event.target.value) changeDate(event.target.value); else event.target.value = session.date; });
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).close()));
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { renderDaily(); if (currentView === 'trends') renderReview(); }, 150); });
function discardSession() {
  clearTimeout(toastTimer); clearTimeout(resizeTimer); dialogSaved = true; dialogDraft = null;
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  blank = makeSession(createBlankDataset()); sample = makeSession(createDemoDataset()); session = blank;
  for (const form of document.forms) form.reset();
  for (const id of ['entry-ratings', 'entry-link', 'medication-suggestions', 'review-summary', 'review-pinned', 'review-domain-summary', 'review-days', 'review-medications', 'review-observations', 'trend-chart', 'quick-preferences']) $(id).replaceChildren();
  for (const id of ['visit-concerns', 'visit-goals', 'visit-questions', 'tracker-search']) $(id).value = '';
  for (const id of ['quick-error', 'entry-error', 'custom-error', 'review-error', 'preferences-error', 'summary-subtitle', 'review-count', 'toast']) $(id).textContent = '';
  $('toast').classList.remove('visible');
  setOptions($('review-reporter'), [['All reporters', '']], ''); setOptions($('review-context'), [['All contexts', '']], '');
  initializeRange(); setView('journal'); renderSettings();
}
$('clear-journal').addEventListener('click', () => { if (confirm('Clear all entries and drafts in this session?')) { discardSession(); toast('Session cleared.'); } });
window.addEventListener('pagehide', discardSession);
window.addEventListener('pageshow', event => { if (event.persisted) discardSession(); });
render();
