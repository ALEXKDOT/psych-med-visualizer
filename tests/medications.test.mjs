import test from 'node:test';
import assert from 'node:assert/strict';
import { MEDICATIONS, medicationSelection, chooseMedication, chooseFormulation } from '../src/medications.mjs';
import { createBlankDataset, validateDataset } from '../src/model.mjs';

test('strengths cannot carry over between release formulations or dosage forms', () => {
  assert.ok(medicationSelection({ brandId: 'adderall', formId: 'ir', doseText: '7.5 mg' }));
  assert.equal(medicationSelection({ brandId: 'adderall', formId: 'xr', doseText: '7.5 mg' }), null);
  assert.ok(medicationSelection({ brandId: 'vyvanse', formId: 'capsule', doseText: '70 mg' }));
  assert.equal(medicationSelection({ brandId: 'vyvanse', formId: 'chewable', doseText: '70 mg' }), null);
  assert.equal(medicationSelection({ brandId: 'concerta', formId: 'er', doseText: '20 mg' }), null);
  assert.equal(medicationSelection({ brandId: 'missing', formId: 'ir', doseText: '5 mg' }), null);
  assert.equal(medicationSelection(), null);
});

test('changing brand or formulation invalidates the dose and pending default without losing time', () => {
  const draft = { time: '08:45', brandId: 'adderall', formId: 'ir', doseText: '10 mg', saveDefault: true };
  chooseFormulation(draft, 'xr');
  assert.equal(medicationSelection(draft), null);
  assert.equal(draft.saveDefault, false);
  assert.equal(draft.time, '08:45');
  draft.doseText = '20 mg';
  const favorite = { brandId: draft.brandId, formId: draft.formId, doseText: draft.doseText };
  chooseMedication(draft, 'vyvanse');
  assert.equal(draft.formId, '');
  assert.equal(medicationSelection(draft), null);
  assert.equal(medicationSelection(favorite).medication, 'Adderall XR');
  chooseMedication(draft, 'concerta');
  assert.equal(draft.formId, 'er');
  assert.equal(draft.doseText, '');
  chooseFormulation(draft, 'chewable');
  assert.equal(draft.formId, '');
});

test('recorded events retain the brand variant and both ingredients of combination strengths', () => {
  assert.deepEqual(medicationSelection({ brandId: 'ritalin', formId: 'la', doseText: '30 mg' }), {
    medication: 'Ritalin LA', formulation: 'Extended-release capsule', doseText: '30 mg'
  });
  assert.deepEqual(medicationSelection({ brandId: 'azstarys', formId: 'capsule', doseText: '39.2 mg / 7.8 mg' }), {
    medication: 'Azstarys', formulation: 'Capsule (serdexmethylphenidate / dexmethylphenidate)', doseText: '39.2 mg / 7.8 mg'
  });
});

test('every catalog choice creates a valid event with a traceable official label', () => {
  const data = createBlankDataset();
  for (const medication of MEDICATIONS) for (const form of medication.forms) {
    assert.match(form.source, /^https:\/\/dailymed\.nlm\.nih\.gov\/dailymed\/drugInfo\.cfm\?setid=/);
    for (const doseText of form.doses) {
      const selection = medicationSelection({ brandId: medication.id, formId: form.id, doseText });
      assert.ok(selection);
      data.medicationEvents.push({ id: `med-${data.medicationEvents.length}`, date: '2026-10-13', time: '08:30', status: 'taken', note: '', ...selection });
    }
  }
  assert.deepEqual(validateDataset(data), []);
});
