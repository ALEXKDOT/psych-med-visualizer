# ResponseMap data dictionary

Public app version: **1.1.0**. Internal journal schema: **1.0.0**. All user-created data described here exists only in the open page's memory. There is no public import/export format or saved journal. Built-in variable definitions live in `src/model.mjs`.

## Session dataset

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Internal supported data shape, currently `1.0.0`. This is independent of the app release version. |
| `createdAt`, `updatedAt` | UTC ISO timestamps for the in-memory dataset's creation and latest change. |
| `customDomains` | Custom variable definitions created in the current session. |
| `medicationEvents` | Medication event records in the current session. |
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

## Observation

| Field | Meaning |
| --- | --- |
| `id` | Identifier unique within observations in the dataset. |
| `date`, `time` | Recorded local date (`YYYY-MM-DD`) and 24-hour time (`HH:MM`). |
| `domain` | Identifier of a built-in or custom variable. |
| `score` | Required integer from 1 to 10, using that variable's endpoints. An unrated variable creates no observation. |
| `reporter` | Person's role as recorded, for example Patient, Caregiver, or Clinician. |
| `context` | Context as recorded, for example Home, Work, or School. |
| `medicationEventId` | Explicit linked event identifier, or an empty string for no link. |
| `note` | Optional note, represented by an empty string when absent. |

The default is no linked medication event. Deleting a medication event clears its observation links while retaining the observations. Duplicate timestamps are allowed. Local date/time fields have no stored timezone or UTC offset; they preserve the clock time entered rather than supporting reliable absolute-time comparison across timezone changes or daylight-saving transitions.

Avoid identifying information in free-text fields. Notes, medication details, and scores can themselves be sensitive even when no name is recorded, which is why the public app does not persist or transmit them.

## Presentation

- **Daily chart:** recorded scores on a 1–10 axis. Connections stop at gaps over three hours. Conflicting scores at the same timestamp remain separate points; identical coincident scores retain their entry count.
- **Daily average:** arithmetic mean of all available ratings for one variable on one date, with count and observed minimum/maximum. Missing days break the line. Ratings from different reporters are included in the same daily average; inspect the entry table for their context.
- **Check-in count:** number of distinct time/reporter/context combinations on a selected day. It is a presentation grouping, not a stored check-in identifier.
- **Chart selection:** controls visibility and remains in memory for the session. Hiding a variable does not delete its observations.
- **Date-range review:** shows current-session entries for an inclusive chosen date range. It does not retrieve previous sessions or send records to a provider.

Derived chart values are not recorded as clinical facts. Reloading, closing, or returning through browser history clears the session data and its display preferences.

## Validation

The internal model validates real dates, valid times, supported medication statuses, finite integer scores, unique identifiers within each record type, known variable references, and resolvable medication links. Its limits are 200 custom variables, 100,000 observations, and 100,000 medication events per in-memory dataset. These are structural safeguards, not targets for hourly recording.

Legacy migration and serialization helpers remain in the source for compatibility tests. The public interface does not call them to import, export, restore, or save patient data.
