# ResponseMap data dictionary

Public app version: **1.2.0**. Internal journal schema: **1.0.0**. All user-created data described here exists only in the open page's memory. There is no public import/export format or saved journal. Built-in variable definitions live in `src/model.mjs`.

## Session dataset

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Internal supported data shape, currently `1.0.0`. This is independent of the app release version. |
| `createdAt`, `updatedAt` | UTC ISO timestamps for the in-memory dataset's creation and latest change. |
| `customDomains` | Custom variable definitions created in the current session. |
| `medicationEvents` | Medication event records in the current session. |
| `checkIns` | Groups with stable IDs, shared notes/context, optional sleep information and a pinned flag. |
| `visitPlanning` | Session-only `concerns`, `goals`, and `questions` text. |
| `observations` | Individual variable ratings in the current session. |

The internal model retains compatibility metadata such as `patient`, `episode`, or `migrationNotes`. The public interface does not collect a patient profile or load legacy journals. Compatibility helpers in the source do not provide an import or persistence feature in the public app.

## Variables

There are 42 built-in variables in four groups: Attention & thinking, Mood & emotions, Energy & sleep, and Physical & appetite. Custom variables use the same rating model.

| Field | Meaning |
| --- | --- |
| `id` | Identifier referenced by `observation.domain`; unique across built-in and custom variables. |
| `label` | Display name. |
| `group` | Display grouping. Custom variables created in the app use `Custom`. |
| `kind` | `target`, `adverse`, or `custom`; descriptive metadata, not a clinical classification of an entry. |
| `lowLabel`, `highLabel` | Meanings of scores 1 and 10 for this variable. |
| `color` | Six-digit hexadecimal chart color, such as `#6175D1`. |

Direction varies. Focus ranges from unable to focus to very focused; fatigue ranges from no fatigue to severe fatigue. Scores across different variables are not interchangeable. A custom variable's name and endpoints should state what is being rated.

## Medication event

| Field | Meaning |
| --- | --- |
| `id` | Identifier unique within medication events in the dataset. |
| `date`, `time` | Recorded local calendar date (`YYYY-MM-DD`) and 24-hour time (`HH:MM`). |
| `medication` | Medication name as entered. |
| `formulation` | Formulation as entered, such as a release type or dosage form. |
| `doseText` | Dose and unit as entered. No unit conversion, equivalence, or dose validation is performed. |
| `status` | `taken`, `missed`, `partial`, or `unknown`. A recorded status, not an inferred adherence result. |
| `note` | Optional note, represented by an empty string when absent. |

Each event has its own required medication, formulation, and dose text. The data model permits multiple medications or formulations within a day and changes between events. A partial event does not calculate a quantity from the recorded dose text.

## Check-in

`checkIns` is an additive extension to the internal 1.0.0 schema. Older compatibility fixtures without it remain valid; the public app still does not import them.

Each check-in has `id`, `date`, `time`, `reporter`, `context`, `note`, `medicationEventId`, `pinned` (boolean), `sleepHours` (0–24 or null), `sleepQuality` (empty, Poor, Fair, or Restful), and `circumstances` (optional text). It must contain at least one associated rating or a nonempty note. A note-only entry creates no numerical observation. Unanswered sleep duration remains null, distinct from zero.

The associated observations reference `checkInId` and retain shared date/time, reporter, context, note and medication link for existing calculation helpers. Validation requires these fields to agree with the parent. Each variable appears at most once in a check-in; separate submissions at the same timestamp have distinct check-in IDs. Editing preserves existing rating IDs where possible and deletes only ratings cleared from that check-in. Legacy observations without `checkInId` remain individual entries because their original submission boundaries are unknown.

Drafts and favorite order are separate in-memory UI state. Drafts are keyed by date and workflow, with editing drafts keyed by record ID. The check-in and medication time fields are initialized to the current local clock time. “Now” fills the current clock time at the moment the button is pressed, preserving the selected journal date. Recording uses the displayed time; entering ratings, navigating, or submitting does not replace it. The two time fields are independent. Reloading or leaving clears all drafts.

## Observation

| Field | Meaning |
| --- | --- |
| `id` | Identifier unique within observations in the dataset. |
| `date`, `time` | Recorded local date (`YYYY-MM-DD`) and 24-hour time (`HH:MM`). |
| `checkInId` | Owning check-in identifier for new entries; omitted only on compatibility records. |
| `domain` | Identifier of a built-in or custom variable. |
| `score` | Required integer from 1 to 10, using that variable's endpoints. An unrated variable creates no observation. |
| `reporter` | Person's role as recorded, for example Patient, Caregiver, or Clinician. |
| `context` | Context as recorded, for example Home, Work, or School. |
| `medicationEventId` | Explicit linked event identifier, or an empty string for no link. |
| `note` | Optional note, represented by an empty string when absent. |

The default is no linked medication event. Deleting a medication event clears both check-in and observation links while retaining their content. Duplicate timestamps are allowed. Local date/time fields have no stored timezone or UTC offset; they preserve the clock time entered rather than supporting reliable absolute-time comparison across timezone changes or daylight-saving transitions.

Avoid identifying information in free-text fields. Notes, medication details, and scores can themselves be sensitive even when no name is recorded, which is why the public app does not persist or transmit them.

## Presentation

- **Daily chart:** recorded scores on a 1–10 axis. Connections stop at gaps over three hours. Conflicting scores at the same timestamp remain separate points; identical coincident scores retain their entry count.
- **Daily average:** arithmetic mean of all available ratings for one variable on one date, with count and observed minimum/maximum. Missing days break the line. Reporter and context filters determine which check-ins contribute. Averages remain descriptive; they do not adjust for recording times or missingness.
- **Check-in count:** number of check-in identifiers, including note-only entries. Matching time/reporter/context does not merge entries.
- **Chart selection:** controls visibility and remains in memory for the session. Hiding a variable does not delete its observations.
- **Date-range review:** shows current-session entries for an inclusive chosen date range. It does not retrieve previous sessions or send records to a provider.

Derived chart values are not recorded as clinical facts. Reloading, closing, or returning through browser history clears the session data and its display preferences.

## Validation

The internal model validates real dates, valid times, supported medication statuses, finite integer scores, unique identifiers within each record type, known variable references, and resolvable medication links. Its limits are 200 custom variables, 100,000 observations, and 100,000 medication events per in-memory dataset. These are structural safeguards, not targets for hourly recording.

Legacy migration and serialization helpers remain in the source for compatibility tests. The public interface does not call them to import, export, restore, or save patient data.
