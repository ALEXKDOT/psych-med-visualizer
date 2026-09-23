import { createBlankDataset, createDemoDataset, getDomains, domainLabel, makeId, localDateString, validateDataset } from './model.mjs';
import { renderDailyChart, renderTrendChart } from './charts.mjs?v=plain-copy-20260923';

const $ = id => document.getElementById(id);
const DEFAULT_TRACKERS = ['attention_focus', 'energy', 'sedation_fatigue', 'anxiety_distress', 'appetite_impact'];
let isDemo = true;
let dataset = createDemoDataset();
let temporaryJournal = null;
let temporaryPreferences = null;
let selectedDate = localDateString();
let currentView = 'journal';
let trackedIds = [...DEFAULT_TRACKERS];
let visibleIds = new Set(DEFAULT_TRACKERS);
let showMedication = true;
let toastTimer;
let quickValues = new Map();
let entryValues = new Map();
let entryFromQuick = false;
let journalStart = new Date(); journalStart.setDate(journalStart.getDate() - 6);
$('review-start').value = localDateString(journalStart);
$('review-end').value = selectedDate;
$('journal-date').value = selectedDate;
$('quick-time').value = currentTime();

function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
function currentTime() { return new Date().toTimeString().slice(0, 5); }
function clone(value) { return structuredClone(value); }
function dateLabel(value, options = {}) { return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...options }); }
function timeLabel(value) { return new Date(`2000-01-01T${value}:00`).toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'}); }
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4200); }
function domains() { return getDomains(dataset); }
function trackedDomains() { const available = new Map(domains().map(d => [d.id,d])); return trackedIds.map(id=>available.get(id)).filter(Boolean); }
function clearQuickDraft() { quickValues.clear(); $('quick-note').value=''; $('quick-error').textContent=''; }
function selectExistingValue(select, value) { if (![...select.options].some(option=>option.value===value)) select.add(new Option(value,value)); select.value=value; }

// The public app deliberately keeps all entries and choices in memory only.
function commit(next, {start = false} = {}) {
  const errors = validateDataset(next);
  if (errors.length) { toast(`Unable to add entry: ${errors[0]}`); return false; }
  next.updatedAt = new Date().toISOString();
  dataset = next;
  if (start) isDemo = false;
  if (!isDemo) temporaryJournal = next;
  render();
  return true;
}
function transact(change) { const next = clone(dataset); change(next); return commit(next); }

function render() {
  const valid = new Set(domains().map(d=>d.id));
  trackedIds = trackedIds.filter(id=>valid.has(id));
  visibleIds = new Set([...visibleIds].filter(id=>trackedIds.includes(id)));
  $('demo-banner').hidden = !isDemo;
  $('start-journal').textContent = temporaryJournal ? 'Return to session →' : 'Start a blank session →';
  $('profile-alias').textContent = isDemo ? 'Sample journal' : 'Temporary session';
  $('storage-status').textContent = 'Entries are not saved';
  $('footer-mode').textContent = 'Entries disappear on refresh';
  $('day-label').textContent = dateLabel(selectedDate, {weekday:'long',year:'numeric'});
  const observations = dataset.observations.filter(o=>o.date===selectedDate);
  const meds = dataset.medicationEvents.filter(e=>e.date===selectedDate);
  $('checkin-count').textContent = new Set(observations.map(o=>`${o.time}|${o.reporter}|${o.context}`)).size;
  $('med-count').textContent = meds.length;
  $('hour-count').textContent = new Set(observations.map(o=>o.time.slice(0,2))).size;
  $('checkin-detail').textContent = `${observations.length} ratings recorded`;
  $('med-detail').textContent = `${meds.filter(e=>e.status==='taken').length} marked taken`;
  renderToggles('variable-toggles'); renderToggles('trend-toggles');
  renderDailyChart($('daily-chart'),dataset,{date:selectedDate,domainIds:[...visibleIds],showMedication});
  renderHours(observations);
  renderTimeline();
  renderQuickRatings();
  if (currentView === 'settings') renderSettings();
  if (currentView === 'trends') renderReview();
}
function setView(view) {
  currentView = view;
  for (const name of ['journal','trends','settings']) $(name+'-view').hidden = view !== name;
  document.querySelectorAll('[data-view]').forEach(b=>{ b.classList.toggle('active',b.dataset.view===view); b.setAttribute('aria-current',b.dataset.view===view?'page':'false'); });
  $('breadcrumb-current').textContent = {journal:'Daily journal',trends:'Trends & review',settings:'Journal settings'}[view];
  $(view+'-view').classList.add('view-transition');
  render();
}
function renderToggles(targetId) {
  const target = $(targetId); target.replaceChildren();
  for (const d of trackedDomains()) {
    const label = node('label','variable-toggle');
    const checkbox = node('input'); checkbox.type='checkbox'; checkbox.checked=visibleIds.has(d.id); checkbox.setAttribute('aria-label',`Show ${d.label}`);
    checkbox.addEventListener('change',()=> { checkbox.checked ? visibleIds.add(d.id) : visibleIds.delete(d.id); renderToggles('variable-toggles'); renderToggles('trend-toggles'); renderDailyChart($('daily-chart'),dataset,{date:selectedDate,domainIds:[...visibleIds],showMedication}); if(currentView==='trends') renderReview(); });
    const swatch = node('span','swatch'); swatch.style.backgroundColor=d.color;
    label.append(checkbox,swatch,document.createTextNode(d.label)); target.append(label);
  }
  if (!trackedIds.length) target.append(node('p','chart-note','Select variables in Journal settings.'));
}
function renderHours(observations) {
  const filled = new Set(observations.map(o=>Number(o.time.slice(0,2)))); $('hour-strip').replaceChildren();
  for(let hour=0;hour<24;hour++) {
    const time = `${String(hour).padStart(2,'0')}:00`;
    const button = node('button','hour-button'+(filled.has(hour)?' recorded':''),`${hour===0?12:hour>12?hour-12:hour}${hour<12?'a':'p'}`);
    button.setAttribute('aria-label',`Add check-in at ${timeLabel(time)}${filled.has(hour)?', already has entries':''}`);
    button.title = filled.has(hour)?'This hour has recorded ratings':'No ratings this hour';
    button.addEventListener('click',()=>openEntry('symptom',null,time)); $('hour-strip').append(button);
  }
}
function ratingControl(d, map, prefix) {
  const item=node('div','rating-control'+(map.has(d.id)?'':' unrated'));
  const top=node('div','rating-top'); const label=node('label'); label.htmlFor=`${prefix}-${d.id}`;
  const swatch=node('span','swatch'); swatch.style.backgroundColor=d.color; label.append(swatch,document.createTextNode(d.label));
  const output=node('output'); output.htmlFor=`${prefix}-${d.id}`; output.value=map.has(d.id)?String(map.get(d.id)):'—';
  const range=node('input'); range.type='range'; range.id=`${prefix}-${d.id}`; range.min='1';range.max='10';range.step='1';range.value=String(map.get(d.id)??5);range.setAttribute('aria-valuetext',map.has(d.id)?`${range.value} of 10`:'Not rated. Adjust the slider to select a score.');
  const tools=node('div','rating-tools');const clear=node('button','clear-rating','Clear');clear.type='button';clear.setAttribute('aria-label',`Clear ${d.label} rating`);clear.hidden=!map.has(d.id);
  clear.addEventListener('click',()=>{map.delete(d.id);output.value='—';range.value='5';item.classList.add('unrated');clear.hidden=true;range.setAttribute('aria-valuetext','Not rated. Adjust the slider to select a score.');});
  const setRating=()=>{map.set(d.id,Number(range.value));output.value=range.value;item.classList.remove('unrated');clear.hidden=false;range.setAttribute('aria-valuetext',`${range.value} of 10`);};
  range.addEventListener('input',setRating);range.addEventListener('change',setRating);
  // A click on the current thumb is still an explicit choice of that rating.
  range.addEventListener('pointerup',setRating);
  tools.append(output,clear);top.append(label,tools);
  const anchors=node('div','rating-anchors');anchors.append(node('span','',`1 · ${d.lowLabel}`),node('span','',`10 · ${d.highLabel}`));item.append(top,range,anchors);return item;
}
function renderQuickRatings() {
  const quick=trackedDomains().slice(0,3); const ids=new Set(quick.map(d=>d.id));
  for(const id of quickValues.keys()) if(!ids.has(id)) quickValues.delete(id);
  $('quick-ratings').replaceChildren(...quick.map(d=>ratingControl(d,quickValues,'quick')));
  if(!quick.length) $('quick-ratings').append(node('p','chart-note','Choose at least one variable in Journal settings.'));
}
function renderTimeline() {
  const filter=$('entry-filter').value;
  const entries=[...(filter!=='medication'?dataset.observations.filter(o=>o.date===selectedDate).map(o=>({...o,type:'symptom'})):[]),...(filter!=='symptoms'?dataset.medicationEvents.filter(e=>e.date===selectedDate).map(e=>({...e,type:'medication'})):[])].sort((a,b)=>b.time.localeCompare(a.time)||a.id.localeCompare(b.id));
  $('entries-description').textContent=`${entries.length} ${entries.length===1?'entry':'entries'} · ${dateLabel(selectedDate)}`;
  $('timeline').replaceChildren();
  if(!entries.length){const empty=node('div','empty-state');empty.append(node('strong','','No entries for this day.'),node('p','','Add a check-in or log a medication.'));$('timeline').append(empty);return;}
  for(const item of entries) {
    const row=node('div','timeline-row');const isMed=item.type==='medication';const content=node('div','timeline-content');
    content.append(node('strong','',isMed?item.medication:domainLabel(item.domain,dataset)));
    content.append(node('p','timeline-meta',isMed?`${item.formulation} · ${item.doseText} · ${item.status==='partial'?'Partially taken':item.status[0].toUpperCase()+item.status.slice(1)}`:`${item.reporter} · ${item.context}${item.medicationEventId?' · Linked medication event':''}`));
    if(item.note) content.append(node('p','timeline-note',item.note));
    const actions=node('div','row-actions');
    if(!isMed) actions.append(node('span','score-pill',`${item.score} / 10`));
    const edit=node('button','','Edit');edit.setAttribute('aria-label',`Edit ${isMed?item.medication:domainLabel(item.domain,dataset)} at ${timeLabel(item.time)}`);edit.addEventListener('click',()=>openEntry(item.type,item));
    const remove=node('button','','Delete');remove.setAttribute('aria-label',`Delete ${isMed?item.medication:domainLabel(item.domain,dataset)} at ${timeLabel(item.time)}`);remove.addEventListener('click',()=>deleteEntry(item));actions.append(edit,remove);
    row.append(node('time','timeline-time',timeLabel(item.time)),node('span',`event-dot${isMed?' med':''}`,isMed?'◒':'⌁'),content,actions);$('timeline').append(row);
  }
}
function deleteEntry(item) {
  const med=item.type==='medication';
  const linked=med?dataset.observations.filter(o=>o.medicationEventId===item.id).length:0;
  if(!confirm(`Delete this ${med?'medication event':'rating'}?${linked?` ${linked} linked ratings will be kept, with their medication link removed.`:''}`))return;
  if(transact(next=>{if(med){next.medicationEvents=next.medicationEvents.filter(e=>e.id!==item.id);next.observations.forEach(o=>{if(o.medicationEventId===item.id)o.medicationEventId='';});}else next.observations=next.observations.filter(o=>o.id!==item.id);}))toast('Entry deleted.');
}
function populateLinks(selected='') {
  const select=$('entry-link');select.replaceChildren(new Option('No linked event',''));
  for(const e of [...dataset.medicationEvents].sort((a,b)=>`${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)))select.add(new Option(`${e.date} ${e.time} · ${e.medication} · ${e.doseText} (${e.status})`,e.id));
  select.value=selected;
}
function openEntry(type,existing=null,time=null) {
  entryFromQuick = false;
  $('entry-form').reset();$('entry-error').textContent='';entryValues=new Map();
  $('entry-type').value=type;$('entry-id').value=existing?.id||'';
  $('entry-date').value=existing?.date||selectedDate;$('entry-time').value=existing?.time||time||currentTime();
  $('entry-note').value=existing?.note||'';
  const med=type==='medication';$('medication-fields').hidden=!med;$('symptom-fields').hidden=med;
  $('entry-title').textContent=existing?`Edit ${med?'medication event':'rating'}`:med?'Log medication':'Add a check-in';
  $('save-entry').textContent=existing?'Update entry':med?'Add medication event':'Add check-in';
  for(const id of ['medication-name','medication-formulation','medication-dose'])$(id).required=med;
  if(med){
    $('medication-name').value=existing?.medication||'';$('medication-formulation').value=existing?.formulation||'';$('medication-dose').value=existing?.doseText||'';$('medication-status').value=existing?.status||'taken';
    $('medication-suggestions').replaceChildren(...[...new Set(dataset.medicationEvents.map(e=>e.medication))].map(m=>new Option(m)));
  } else {
    selectExistingValue($('entry-context'),existing?.context||$('quick-context').value);selectExistingValue($('entry-reporter'),existing?.reporter||'Patient');
    if(existing)entryValues.set(existing.domain,existing.score);
    const list=existing?domains().filter(d=>d.id===existing.domain):trackedDomains();
    $('entry-ratings').replaceChildren(...list.map(d=>ratingControl(d,entryValues,'entry')));
    if(!list.length)$('entry-ratings').append(node('p','chart-note','Choose variables in Journal settings first.'));
    populateLinks(existing?.medicationEventId||'');
  }
  $('entry-dialog').showModal();
}
function addObservations(next,values,{date,time,reporter,context,note,link=''}) {
  for(const [domain,score] of values)next.observations.push({id:makeId('observation'),date,time,domain,score,reporter,context,note,medicationEventId:link});
}
$('quick-form').addEventListener('submit',event=>{
  event.preventDefault();$('quick-error').textContent='';
  if(!quickValues.size){$('quick-error').textContent='Choose a rating for at least one variable.';return;}
  const values={date:selectedDate,time:$('quick-time').value,reporter:'Patient',context:$('quick-context').value,note:$('quick-note').value.trim()};
  if(transact(next=>addObservations(next,quickValues,values))){quickValues.clear();$('quick-note').value='';renderQuickRatings();toast(isDemo?'Sample check-in added.':'Check-in added.');}
});
$('entry-form').addEventListener('submit',event=>{
  event.preventDefault();$('entry-error').textContent='';const type=$('entry-type').value;const id=$('entry-id').value;
  const date=$('entry-date').value;const time=$('entry-time').value;const note=$('entry-note').value.trim();
  let next=clone(dataset);
  if(type==='medication'){
    const record={id:id||makeId('medication'),date,time,note,medication:$('medication-name').value.trim(),formulation:$('medication-formulation').value.trim(),doseText:$('medication-dose').value.trim(),status:$('medication-status').value};
    if(id)next.medicationEvents=next.medicationEvents.map(e=>e.id===id?record:e);else next.medicationEvents.push(record);
  }else{
    if(!entryValues.size){$('entry-error').textContent='Select at least one rating.';return;}
    const common={date,time,note,reporter:$('entry-reporter').value,context:$('entry-context').value,link:$('entry-link').value};
    if(id){const [domain,score]=[...entryValues][0];next.observations=next.observations.map(o=>o.id===id?{...o,date,time,note,reporter:common.reporter,context:common.context,medicationEventId:common.link,domain,score}:o);}
    else addObservations(next,entryValues,common);
  }
  const errors=validateDataset(next);if(errors.length){$('entry-error').textContent=errors[0];return;}
  const previousDate=selectedDate;selectedDate=date;
  if(commit(next)){$('journal-date').value=selectedDate;if(entryFromQuick||previousDate!==date){clearQuickDraft();renderQuickRatings();}$('entry-dialog').close();toast(id?'Entry updated.':type==='medication'?'Medication event added.':'Check-in added.');}
  else {selectedDate=previousDate;$('entry-error').textContent='Could not add this entry. Check the fields and try again.';}
});

function renderSettings() {
  renderCatalog();$('explore-demo').textContent=isDemo&&temporaryJournal?'Return to session':'Open sample journal';
}
function renderCatalog() {
  const search=$('tracker-search').value.trim().toLocaleLowerCase();const list=domains().filter(d=>`${d.label} ${d.group}`.toLocaleLowerCase().includes(search));
  $('tracker-catalog').replaceChildren();
  for(const group of [...new Set(list.map(d=>d.group))]){
    const section=node('section','tracker-group');section.append(node('h3','',group));
    for(const d of list.filter(d=>d.group===group)){
      const label=node('label','tracker-item');const input=node('input');input.type='checkbox';input.checked=trackedIds.includes(d.id);
      input.addEventListener('change',()=>{if(input.checked){trackedIds.push(d.id);visibleIds.add(d.id);}else{trackedIds=trackedIds.filter(id=>id!==d.id);visibleIds.delete(d.id);}renderToggles('variable-toggles');renderToggles('trend-toggles');renderQuickRatings();});
      const text=node('span','',d.label);text.append(node('small','',`1 · ${d.lowLabel} / 10 · ${d.highLabel}`));label.append(input,text);section.append(label);
    }
    $('tracker-catalog').append(section);
  }
  if(!list.length)$('tracker-catalog').append(node('p','empty-state','No matching variables. Select Custom variable to add one.'));
}
$('custom-form').addEventListener('submit',event=>{
  event.preventDefault();const label=$('custom-label').value.trim();const low=$('custom-low').value.trim();const high=$('custom-high').value.trim();
  if(!label||!low||!high){$('custom-error').textContent='Enter a name and both scale descriptions.';return;}
  if(domains().some(d=>d.label.toLowerCase()===label.toLowerCase())){$('custom-error').textContent='A variable with this name already exists.';return;}
  const id=makeId('custom');const d={id,label,group:'Custom',kind:'custom',lowLabel:low,highLabel:high,color:'#64748b'};
  const next=clone(dataset);next.customDomains.push(d);
  if(commit(next)){trackedIds.push(id);visibleIds.add(id);$('custom-dialog').close();$('tracker-search').value='';render();toast('Custom variable added.');}
});
function reviewRange() { const startDate=$('review-start').value,endDate=$('review-end').value;const error=!startDate||!endDate?'Choose both dates.':startDate>endDate?'The start date must be on or before the end date.':'';$('review-error').textContent=error;return error?null:{startDate,endDate}; }
function inRange(item,range){return item.date>=range.startDate&&item.date<=range.endDate;}
function createTable(headers,rows){if(!rows.length)return node('p','empty-state','No entries in this date range.');const table=node('table');const head=node('thead');const headRow=node('tr');headers.forEach(h=>headRow.append(node('th','',h)));head.append(headRow);const body=node('tbody');rows.forEach(row=>{const tr=node('tr');row.forEach(value=>tr.append(node('td','',String(value??''))));body.append(tr);});table.append(head,body);return table;}
function renderReview() {
  const range=reviewRange();if(!range){$('review-count').textContent='';$('review-summary').replaceChildren();$('review-medications').replaceChildren();$('review-observations').replaceChildren();$('trend-chart').replaceChildren();return;}
  const observations=dataset.observations.filter(o=>inRange(o,range)).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const meds=dataset.medicationEvents.filter(e=>inRange(e,range)).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const dates=new Set([...observations,...meds].map(o=>o.date));
  $('review-count').textContent=`${dates.size} days with entries`;
  $('summary-subtitle').textContent=`${isDemo?'FICTIONAL SAMPLE · ':''}Temporary session · ${dateLabel(range.startDate,{year:'numeric'})} – ${dateLabel(range.endDate,{year:'numeric'})} · ${dataset.episode.label}`;
  renderTrendChart($('trend-chart'),dataset,{...range,domainIds:[...visibleIds]});
  $('review-summary').replaceChildren();
  [[observations.length,'symptom ratings'],[meds.length,'medication events'],[new Set(observations.map(o=>o.reporter)).size,'reporter types']].forEach(([value,label])=>{const card=node('div','review-stat');card.append(node('strong','',String(value)),document.createTextNode(label));$('review-summary').append(card);});
  $('review-medications').replaceChildren(createTable(['Date & time','Medication','Formulation','Dose','Status','Notes'],meds.map(e=>[`${e.date} ${e.time}`,e.medication,e.formulation,e.doseText,e.status,e.note])));
  $('review-observations').replaceChildren(createTable(['Date & time','Variable','Rating','Reporter / context','Linked event','Notes'],observations.map(o=>{const linked=dataset.medicationEvents.find(e=>e.id===o.medicationEventId);return[`${o.date} ${o.time}`,domainLabel(o.domain,dataset),`${o.score} / 10`,`${o.reporter} / ${o.context}`,linked?`${linked.date} ${linked.time} · ${linked.medication} ${linked.doseText}`:'—',o.note];})));
}
function changeDate(date) { if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;selectedDate=date;$('journal-date').value=date;quickValues.clear();$('quick-note').value='';$('quick-error').textContent='';render(); }
function moveDate(offset) {const date=new Date(`${selectedDate}T12:00:00`);date.setDate(date.getDate()+offset);changeDate(localDateString(date));}
function resetChoices() { trackedIds=[...DEFAULT_TRACKERS]; visibleIds=new Set(DEFAULT_TRACKERS); showMedication=true; $('show-medication').checked=true; }
function startJournal() {
  if(isDemo&&temporaryJournal){
    dataset=temporaryJournal; isDemo=false; clearQuickDraft();
    if(temporaryPreferences){ trackedIds=[...temporaryPreferences.tracked]; visibleIds=new Set(temporaryPreferences.visible); }
    render(); toast('Session restored.'); return;
  }
  const next=createBlankDataset(); next.patient.alias='Temporary session'; next.episode.label='ADHD symptom journal';
  if(commit(next,{start:true})){resetChoices();clearQuickDraft();changeDate(localDateString());toast('Blank session started.');}
}
function toggleDemo() {
  if(isDemo&&temporaryJournal){startJournal();return;}
  if(!isDemo){
    temporaryJournal=dataset; temporaryPreferences={tracked:[...trackedIds],visible:[...visibleIds]};
    dataset=createDemoDataset();isDemo=true;resetChoices();clearQuickDraft();selectedDate=localDateString();$('journal-date').value=selectedDate;setView('journal');toast('Sample journal opened. Select “Return to session” to reopen the current entries.');
  } else setView('journal');
}
$('clear-journal').addEventListener('click',()=>{
  discardSession();toast('Session cleared.');
});
$('review-start').addEventListener('change',renderReview);$('review-end').addEventListener('change',renderReview);
$('tracker-search').addEventListener('input',renderCatalog);
$('explore-demo').addEventListener('click',toggleDemo);
$('start-journal').addEventListener('click',startJournal);
$('log-medication').addEventListener('click',()=>openEntry('medication'));
$('full-checkin').addEventListener('click',()=>{openEntry('symptom',null,$('quick-time').value);entryFromQuick=true;entryValues=new Map(quickValues);$('entry-note').value=$('quick-note').value;$('entry-ratings').replaceChildren(...trackedDomains().map(d=>ratingControl(d,entryValues,'entry')));});
$('manage-trackers').addEventListener('click',()=>{setView('settings');$('tracker-search').focus();});
$('add-custom').addEventListener('click',()=>{$('custom-form').reset();$('custom-error').textContent='';$('custom-dialog').showModal();});
$('visit-button').addEventListener('click',()=>setView('trends'));
$('entry-filter').addEventListener('change',renderTimeline);
$('previous-day').addEventListener('click',()=>moveDate(-1));$('next-day').addEventListener('click',()=>moveDate(1));$('today-button').addEventListener('click',()=>changeDate(localDateString()));
$('journal-date').addEventListener('change',event=>{if(event.target.value)changeDate(event.target.value);else event.target.value=selectedDate;});
$('show-medication').addEventListener('change',event=>{showMedication=event.target.checked;renderDailyChart($('daily-chart'),dataset,{date:selectedDate,domainIds:[...visibleIds],showMedication});});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{renderDailyChart($('daily-chart'),dataset,{date:selectedDate,domainIds:[...visibleIds],showMedication});if(currentView==='trends')renderReview();},150);});
function discardSession() {
  clearTimeout(toastTimer); clearTimeout(resizeTimer);
  dataset=createBlankDataset();dataset.patient.alias='Temporary session';dataset.episode.label='ADHD symptom journal';
  temporaryJournal=null;temporaryPreferences=null;isDemo=false;
  quickValues.clear();entryValues.clear();entryFromQuick=false;resetChoices();
  for(const form of document.forms)form.reset();
  $('entry-id').value='';$('entry-type').value='';$('entry-filter').value='all';
  const rangeStart=new Date();rangeStart.setDate(rangeStart.getDate()-6);
  $('review-start').value=localDateString(rangeStart);$('review-end').value=localDateString();
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  for(const id of ['quick-ratings','entry-ratings','entry-link','medication-suggestions','review-summary','review-medications','review-observations','review-count','trend-chart','summary-subtitle','toast'])$(id).replaceChildren();
  for(const id of ['quick-error','entry-error','custom-error','review-error'])$(id).textContent='';
  $('tracker-search').value='';$('toast').classList.remove('visible');
  $('entry-reporter').replaceChildren(...['Patient','Caregiver','Teacher','Clinician','Other'].map(value=>new Option(value,value)));
  $('entry-context').replaceChildren(...['Home','Work','School','Transit','Bedtime','Other'].map(value=>new Option(value,value)));
  selectedDate=localDateString();$('journal-date').value=selectedDate;$('quick-time').value=currentTime();
  currentView='journal';setView('journal');renderCatalog();
}
window.addEventListener('pagehide',discardSession);
window.addEventListener('pageshow',event=>{if(event.persisted)discardSession();});
render();
