# ResponseMap product boundary

## Intended use

ResponseMap 1.0 is a personal ADHD symptom and medication journal for patients and conversations with their providers. It supports frequent manual check-ins, including hourly recording, so the record can preserve details that are difficult to remember later.

One observation is one variable rated at one local date and time by a stated reporter in a stated context. One check-in can create several observations. Medication events are separate records, each with its own medication, formulation, dose, time, and status. An optional link between an observation and an event is chosen explicitly; proximity does not imply a relationship.

The catalog contains 42 built-in variables and supports custom 1–10 variables with named endpoints. It is a broad starting point, not a validated assessment instrument or an exhaustive catalog of symptoms. Users can track a manageable subset and hide chart variables without deleting their history.

## Display and interpretation

- Daily charts place recorded values at their stated time. Lines connect observations no more than three hours apart. They are visual connections, not measurements or estimates of the intervening hours.
- Unrecorded hours and days remain missing. Missing medication events do not establish that a dose was missed.
- Daily averages are arithmetic means of the available observations for each variable and date. Details include counts and recorded ranges. Different recording times, reporter mixes, and contexts can change the average.
- Scores are whole numbers from 1 to 10, interpreted using each variable's endpoints. High focus and high fatigue have different meanings. Variables are not combined into a total clinical score.
- Provider review offers the chosen date range, descriptive charts, medication entries, and observations. Printing, saving a PDF, or exporting a CSV is user initiated; the app does not send the result to anyone.

The app does not recommend a medication, dose, formulation, timing, or redosing; diagnose a condition; label a treatment as effective; infer medication onset or wear-off; or make an emergency assessment. Temporal proximity and descriptive changes do not establish a medication effect. The app does not monitor for urgent symptoms or replace clinical care.

## Privacy and storage

The application is local first: one journal is saved in the current browser profile using unencrypted browser storage. Its assets have no runtime third-party dependencies, analytics, cloud data service, or remote fonts. A host serves ordinary static application files; patient records are not submitted to an application server by the journal.

There are no accounts, provider portal, access controls, automatic backup service, cross-device synchronization, audit log, electronic health record integration, or encryption key management. Physical or browser-profile access can expose a journal. The software makes no HIPAA compliance, regulatory clearance, or clinical validation claim.

Journal saving reports browser storage failures. It also warns if another tab changes the saved journal instead of silently overwriting that version through a normal edit. This is not collaborative editing or a transactional multiuser database.

JSON backups, CSV files, and printed/PDF reports contain recorded health information and are unencrypted. Users choose where to store or share them. Restoring JSON replaces the active journal after confirmation; export a backup beforehand if the old journal needs to be retained. Browser storage can be cleared or become unavailable, and its capacity is often smaller than the import format's record limits.

## Current scope and future work

Hourly tracking is manual: there are no automatic prompts, background notifications, wearable integrations, or physiological measurements in their original units. Custom variables are 1–10 ratings; notes can preserve other details without converting them into validated measurements.

Clinical deployment involving an organization's patient records would need its own validated workflows, privacy and security architecture, authorization, audit and retention controls, accessibility and human-factors assessment, and applicable legal/regulatory review. Those capabilities are outside this version.
