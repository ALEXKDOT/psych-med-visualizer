# ResponseMap 1.2 verification

Verified on October 10, 2026, with fictional data only.

## Automated checks

`npm test`, `npm run check`, and `npm run build` pass. The 50 tests cover existing calculations, validation, compatibility and privacy safeguards, plus:

- Separate submissions at identical timestamps retain distinct check-in IDs.
- Group edits preserve rating identities and shared metadata; cleared ratings are removed.
- Note-only entries count toward coverage without introducing a numerical score.
- Removing a medication event preserves check-ins and clears both group/rating links.
- “Now” uses recording time across midnight, while explicit times remain unchanged.
- Invalid memberships, duplicate ratings, conflicting metadata and empty entries are rejected.
- The opening demo includes eight check-ins from 07:30 to 22:00 for the current date, at every launch hour. These fictional entries intentionally include the complete day even when opened before morning. Every current and historical sample check-in includes all five default variables. Historical days retain sparse timing and gaps. A blank session has no entries.
- Every built-in chart stroke exceeds 3:1 contrast on the ivory plot background.

## Browser interaction checks

Checked the running app in the Codex browser at desktop width and 390- and 320-pixel mobile widths:

- An unfinished note and rating survive previous/next date navigation.
- An intentionally entered earlier time survives date navigation unchanged.
- Closing the expanded check-in retains its additional ratings and shared note; submitting the quick form records the whole group once.
- Closing and reopening the medication form restores its draft.
- A note-only entry can be recorded and pinned; the visit summary counts it as a check-in and does not fabricate ratings.
- Editing a multi-rating check-in updates the shared note and selected rating together.
- All five default variables appear in the main check-in form and initial overlaid chart, with all chart checkboxes visible and selected. No variable dropdown is shown; checkboxes hide and restore individual series.
- Five quick-variable settings preserve their configured order, including empty optional slots.
- Toggling a comparison by keyboard keeps focus on the existing checkbox.
- Arrow keys navigate chart points, Enter pins details, and each panel has one chart tab stop.
- Reporter filtering changes check-in coverage and calculated summaries while retaining the period's medication-event history.
- Daily charts fit the available mobile width; the page does not overflow horizontally at either tested mobile width.
- Reloading starts a fresh fictional sample, clearing temporary entries and drafts.
- No browser error/warning messages were observed during these checks.

## Limits

These checks do not constitute a complete accessibility audit or user research. The proposed usability sessions with people with ADHD, and the under-30-second unaided check-in target, still need participant testing. Retained storage remains a separate product decision; this release deliberately stays session-only.
