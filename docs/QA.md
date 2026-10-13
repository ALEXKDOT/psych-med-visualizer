# ResponseMap 1.2 verification

Verified on October 10, 2026, with the Harbor palette rechecked on October 13, 2026. Fictional data only.

## Harbor palette verification

- All 50 existing tests, syntax checks, and the production build pass. The chart-contrast test now reads the actual `--paper` color from the stylesheet.
- The implemented UI matches the approved Harbor preview's measured geometry, typography, and colors at 1440- and 390-pixel widths. The application, model, and chart modules are unchanged.
- All 29 checks against the production assets pass, including filters, rating and chart keyboard navigation, recording, medication dialog, visit summary, and settings. Automated WCAG A/AA checks report no violations in the tested views, and page overflow checks pass at 320, 390, 768, and 1440 pixels.
- The approved Harbor palette was also inspected for visible keyboard focus in the navy navigation and rating controls, legible chart labels, and readable text, controls, and hover states. Mint navigation focus and a darker content focus color preserve visibility on their respective surfaces.

## Automated checks

`npm test`, `npm run check`, and `npm run build` pass. The 54 tests cover existing calculations, validation, compatibility and privacy safeguards, plus:

- Separate submissions at identical timestamps retain distinct check-in IDs.
- Group edits preserve rating identities and shared metadata; cleared ratings are removed.
- Note-only entries count toward coverage without introducing a numerical score.
- Removing a medication event preserves check-ins and clears both group/rating links.
- The legacy timestamp utility handles midnight and preserves explicit times. The current UI records the displayed date and time directly.
- Invalid memberships, duplicate ratings, conflicting metadata and empty entries are rejected.
- The opening demo includes eight check-ins from 07:30 to 22:00 for the current date, at every launch hour. These fictional entries intentionally include the complete day even when opened before morning. Every current and historical sample check-in includes the three default variables and optional Fatigue and Anxiety data. Historical days retain sparse timing and gaps. A blank session has no entries.
- Every built-in chart stroke exceeds 3:1 contrast on the ivory plot background.

## Browser interaction checks

Checked the running app in the Codex browser at desktop width and 390- and 320-pixel mobile widths:

- An unfinished note and rating survive previous/next date navigation.
- An intentionally entered earlier time survives date navigation unchanged.
- Closing the expanded check-in retains its additional ratings and shared note; submitting the quick form records the whole group once.
- Closing and reopening the medication form restores its draft.
- A note-only entry can be recorded and pinned; the visit summary counts it as a check-in and does not fabricate ratings.
- Editing a multi-rating check-in updates the shared note and selected rating together.
- All three default variables appear in the main check-in form and initial overlaid chart, with all chart checkboxes visible and selected. No variable dropdown is shown; checkboxes hide and restore individual series.
- Five quick-variable settings preserve their configured order, including empty optional slots.
- Toggling a comparison by keyboard keeps focus on the existing checkbox.
- Arrow keys navigate chart points, Enter pins details, and each panel has one chart tab stop.
- Reporter filtering changes check-in coverage and calculated summaries while retaining the period's medication-event history.
- Daily charts fit the available mobile width; the page does not overflow horizontally at either tested mobile width.
- Reloading starts a fresh fictional sample, clearing temporary entries and drafts.
- No browser error/warning messages were observed during these checks.

## Limits

These checks do not constitute a complete accessibility audit or user research. The proposed usability sessions with people with ADHD, and the under-30-second unaided check-in target, still need participant testing. Retained storage remains a separate product decision; this release deliberately stays session-only.


## Medication card checks (2026-10-13)

- The daily screen shows Log medication dose in place of Latest check-in. Journal entries includes the latest check-in with working edit, delete, and pin controls.
- Fatigue and Anxiety are absent from default quick ratings and chart series, but remain selectable in Journal settings (including the empty fourth and fifth quick slots).
- Chart headers no longer show scale endpoints; separate charts retain their variable names.
- A brand selection reveals the formulation choices. Single-form brands select that form automatically; no dose is selected automatically unless a session default exists. Record dose appears only after a valid strength is selected.
- Adderall IR 7.5 mg cannot carry into XR; Vyvanse 70 mg cannot carry into chewables. Changing either brand or formulation clears dose and pending default selection.
- Record dose adds one taken event with the selected journal date, time, branded formulation, and dose; it updates the medication lane, chart marker, entries, and visit summary. Hidden medication events and narrowed chart ranges are reset to show the newly recorded dose.
- Make this my default medication/dose takes effect on recording; it prefills later fresh drafts within that sample/blank session. Date/view navigation retains per-date drafts. Clear default removes the preference without deleting recorded events. Reload and Clear session reset it.
- Check keyboard radio selection, a narrow phone viewport, and the Other medication or dose / missed dose link. Custom dose combinations remain free text rather than inferred dose equivalents.
- Catalog choices are U.S. labeled strengths, not starting doses, recommended doses, or proof of local availability. Source URLs and the verification date are in src/medications.mjs; no drug-label data is requested at runtime.


## Direct time entry checks (2026-10-13)

- The quick check-in has a required time input and adjacent Now button; there is no time-mode dropdown. Medication time has its own Now button.
- Now updates only its own time field to the current local clock time and does not submit a form, erase a draft, or change the journal date.
- Manually entered times survive rating selection, date navigation, opening the expanded check-in, and submission. Empty time fields cannot be recorded.
- A medication dose can be recorded into a blank journal with zero check-ins and zero symptom ratings. It appears in the medication lane and graph; an unfinished symptom draft is retained.
