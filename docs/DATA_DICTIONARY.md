# ResponseMap data dictionary

Schema version: **1.0.0**. JSON backups contain the complete journal. Built-in variable definitions live in `src/model.mjs`; user-defined variables travel with the journal.

## Journal

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Supported journal schema, currently `1.0.0`. |
| `createdAt`, `updatedAt` | UTC ISO timestamps for creation and last save. |
| `patient.alias` | Display nickname. Use an alias instead of a direct identifier. |
| `patient.ageBand` | Broad contextual text; defaults to `not_recorded`. |
| `episode.id`, `episode.label` | Stable episode identifier and journal tracking goal. |
| `episode.startDate` | Local calendar start date in `YYYY-MM-DD` format. |
| `episode.medication`, `episode.formulation`, `episode.doseText` | Optional legacy episode context; new medication events store their own details. |
| `episode.context` | Optional episode context text. |
| `customDomains` | Array of custom variable definitions. |
| `medicationEvents` | Array of medication event records. |
| `observations` | Array of individual variable ratings. |
| `migrationNotes` | Optional explanations of changes made during legacy import. |

## Variables

There are 42 built-in variables in four groups: Attention & thinking, Mood & emotions, Energy & sleep, and Physical & appetite. Custom variables use the same rating model.

| Field | Meaning |
| --- | --- |
| `id` | Stable identifier referenced by `observation.domain`; unique across built-in and custom variables. |
| `label` | Display name. |
| `group` | Display grouping. Custom variables created in the app use `Custom`. |
| `kind` | `target`, `adverse`, or `custom`; descriptive metadata, not a clinical classification of an entry. |
| `lowLabel`, `highLabel` | Meanings of scores 1 and 10 for this variable. |
| `color` | Six-digit hexadecimal chart color, such as `#6175D1`. |

Direction varies. Focus ranges from unable to focus to very focused; fatigue ranges from no fatigue to severe fatigue. Scores across different variables are not interchangeable. A custom variable's name and endpoints should state what is being rated.

## Medication event

| Field | Meaning |
| --- | --- |
| `id` | Stable identifier, unique within medication events. |
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
| `id` | Stable identifier, unique within observations. |
| `date`, `time` | Recorded local date (`YYYY-MM-DD`) and 24-hour time (`HH:MM`). |
| `domain` | Identifier of a built-in or custom variable. |
| `score` | Required integer from 1 to 10, using that variable's endpoints. An unrated variable creates no observation. |
| `reporter` | Person's role as recorded, for example Patient, Caregiver, or Clinician. |
| `context` | Context as recorded, for example Home, Work, or School. |
| `medicationEventId` | Explicit linked event identifier, or an empty string for no link. |
| `note` | Optional note, represented by an empty string when absent. |

The default is no linked medication event. Deleting a medication event clears its observation links while retaining the observations. Duplicate timestamps are allowed. Local date/time fields have no stored timezone or UTC offset; they preserve the clock time entered rather than supporting reliable absolute-time comparison across timezone changes or daylight-saving transitions.

## Presentation and exports

- **Daily chart:** actual recorded scores on a 1–10 axis. Connections stop at gaps over three hours. Conflicting scores at the same timestamp remain separate points; identical coincident scores retain their entry count.
- **Daily average:** arithmetic mean of all available ratings for one variable on one date, with count and observed minimum/maximum. Missing days break the line. Ratings from different reporters are included in the same daily average; inspect the entry table for their context.
- **Check-in count:** number of distinct time/reporter/context combinations on a selected day. It is a presentation grouping, not a stored check-in identifier.
- **JSON:** complete journal, all dates, observations, medication events, and custom variables. Chart-selection preferences are stored separately and are not a backup field. JSON is the restorable format.
- **CSV:** recorded entries within an inclusive chosen date range, sorted by date/time. Columns are `type`, `date`, `time`, `variable`, `score`, `medication`, `formulation`, `dose`, `status`, `reporter`, `context`, `linked_event_id`, and `notes`. Medication details on an observation row come only from its explicit event link. Potential spreadsheet formulas are prefixed with an apostrophe. CSV is for review, not reimport.
- **Print/PDF:** descriptive summary and entry tables for the chosen date range, using the browser print dialog. It is not a structured backup.

Hidden variables remain in the journal and in date-range entry exports. Derived chart values are not saved as clinical facts.

## Validation and compatibility

Imports must be plain JSON with a supported schema, real dates, valid times, supported medication statuses, finite integer scores, unique identifiers within each record type, known variable references, and resolvable medication links. The interface accepts backup files up to 10,000,000 bytes. The schema caps each journal at 200 custom variables, 100,000 observations, and 100,000 medication events; browser storage may reach its own limit much sooner.

Schema `0.1.0` is migrated before validation:

- Episode medication, formulation, and dose details are copied into each medication event. Missing legacy values are labeled `Not recorded (legacy)`.
- Legacy focus ratings measured difficulty, so they become the separate custom variable `legacy_focus_difficulty` (**Focus difficulty (legacy)**). Their direction is preserved and is not mixed with the new Focus variable.
- Legacy zero scores become 1 on the current 1–10 scale. Each affected observation retains its original zero in its note, and the journal includes a migration explanation.
- Supported numeric score strings become numbers; absent optional observation links and notes become empty strings.

Migration changes the schema and updates the journal timestamp. Other validation failures are reported; the import is not silently repaired or merged into the current journal.
