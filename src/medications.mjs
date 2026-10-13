// U.S. labeled product strengths, checked 2026-10-13. These are logging choices,
// not starting doses, dose equivalents, or recommendations. Each form cites its label.
const label = setid => `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setid}`;
const form = (id, name, formulation, strengths, setid) => ({
  id, name, formulation, doses: strengths.map(strength => `${strength} mg`), source: label(setid)
});

export const MEDICATIONS = [
  { id: 'adderall', brand: 'Adderall', generic: 'amphetamine / dextroamphetamine', forms: [
    form('ir', 'Adderall · IR tablet', 'Immediate-release tablet', [5, 7.5, 10, 12.5, 15, 20, 30], 'f22635fe-821d-4cde-aa12-419f8b53db81'),
    form('xr', 'Adderall XR · ER capsule', 'Extended-release capsule', [5, 10, 15, 20, 25, 30], 'aff45863-ffe1-4d4f-8acf-c7081512a6c0')
  ] },
  { id: 'vyvanse', brand: 'Vyvanse', generic: 'lisdexamfetamine', forms: [
    form('capsule', 'Capsule', 'Capsule', [10, 20, 30, 40, 50, 60, 70], '704e4378-ca83-445c-8b45-3cfa51c1ecad'),
    form('chewable', 'Chewable tablet', 'Chewable tablet', [10, 20, 30, 40, 50, 60], '704e4378-ca83-445c-8b45-3cfa51c1ecad')
  ] },
  { id: 'concerta', brand: 'Concerta', generic: 'methylphenidate', forms: [
    form('er', 'ER tablet', 'Extended-release tablet', [18, 27, 36, 54], '1a88218c-5b18-4220-8f56-526de1a276cd')
  ] },
  { id: 'ritalin', brand: 'Ritalin', generic: 'methylphenidate', forms: [
    form('ir', 'Ritalin · IR tablet', 'Immediate-release tablet', [5, 10, 20], 'c0bf0835-6a2f-4067-a158-8b86c4b0668a'),
    form('la', 'Ritalin LA · ER capsule', 'Extended-release capsule', [10, 20, 30, 40], 'effd952d-ac94-47bb-b107-589a4934dcca')
  ] },
  { id: 'focalin', brand: 'Focalin', generic: 'dexmethylphenidate', forms: [
    form('ir', 'Focalin · IR tablet', 'Immediate-release tablet', [2.5, 5, 10], '2016f5c2-95d2-4655-af65-c588c2bf5e6d'),
    form('xr', 'Focalin XR · ER capsule', 'Extended-release capsule', [5, 10, 15, 20, 25, 30, 35, 40], '1a1da905-42a0-4748-9c39-67eca45deccc')
  ] },
  { id: 'strattera', brand: 'Strattera', generic: 'atomoxetine', forms: [
    form('capsule', 'Capsule', 'Capsule', [10, 18, 25, 40, 60, 80, 100], '309de576-c318-404a-bc15-660c2b1876fb')
  ] },
  { id: 'intuniv', brand: 'Intuniv', generic: 'guanfacine', forms: [
    form('er', 'ER tablet', 'Extended-release tablet', [1, 2, 3, 4], 'b972af81-3a37-40be-9fe1-3ddf59852528')
  ] },
  { id: 'qelbree', brand: 'Qelbree', generic: 'viloxazine', forms: [
    form('er', 'ER capsule', 'Extended-release capsule', [100, 150, 200], 'aedf408d-0f84-418d-9416-7c39ddb0d29a')
  ] },
  { id: 'mydayis', brand: 'Mydayis', generic: 'amphetamine / dextroamphetamine', forms: [
    form('er', 'ER capsule', 'Extended-release capsule', [12.5, 25, 37.5, 50], '141a7970-3f06-44ea-9ab7-aeece2c085fc')
  ] },
  { id: 'jornay', brand: 'Jornay PM', generic: 'methylphenidate', forms: [
    form('dr-er', 'Delayed + extended-release capsule', 'Delayed-release and extended-release capsule', [20, 40, 60, 80, 100], 'd95dede0-b1ff-4489-8f91-3bbe122852bf')
  ] },
  { id: 'azstarys', brand: 'Azstarys', generic: 'serdexmethylphenidate / dexmethylphenidate', forms: [
    form('capsule', 'Capsule · prodrug + immediate release', 'Capsule (serdexmethylphenidate / dexmethylphenidate)', ['26.1 mg / 5.2', '39.2 mg / 7.8', '52.3 mg / 10.4'], '00b5e716-5564-4bbd-acaf-df2bc45a5663')
  ] },
  { id: 'dexedrine', brand: 'Dexedrine Spansule', generic: 'dextroamphetamine', forms: [
    form('sr', 'Sustained-release capsule', 'Sustained-release capsule', [5, 10, 15], 'cc717b9b-22ea-4c60-a1d4-ee38a40bce78')
  ] },
  { id: 'zenzedi', brand: 'Zenzedi', generic: 'dextroamphetamine', forms: [
    form('ir', 'IR tablet', 'Immediate-release tablet', [2.5, 5, 7.5, 10, 15, 20, 30], 'd6394df5-f2c9-47eb-b57e-f3e9cfd94f84')
  ] }
];

export function medicationSelection({ brandId, formId, doseText } = {}) {
  const medication = MEDICATIONS.find(item => item.id === brandId);
  const formulation = medication?.forms.find(item => item.id === formId);
  if (!formulation?.doses.includes(doseText)) return null;
  const name = formulation.name.includes(' · ') && formulation.name.startsWith(medication.brand)
    ? formulation.name.split(' · ')[0] : medication.brand;
  return { medication: name, formulation: formulation.formulation, doseText };
}

export function chooseMedication(draft, brandId) {
  const medication = MEDICATIONS.find(item => item.id === brandId);
  draft.brandId = medication?.id || '';
  draft.formId = medication?.forms.length === 1 ? medication.forms[0].id : '';
  draft.doseText = '';
  draft.saveDefault = false;
}

export function chooseFormulation(draft, formId) {
  const medication = MEDICATIONS.find(item => item.id === draft.brandId);
  draft.formId = medication?.forms.some(item => item.id === formId) ? formId : '';
  draft.doseText = '';
  draft.saveDefault = false;
}
