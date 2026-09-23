# ResponseMap product boundary

## Intended use

ResponseMap 1.1 is a public, temporary ADHD symptom and medication journal for patients and conversations with their providers. It supports frequent manual check-ins, including hourly recording, and interactive comparison of observations within the open session. It deliberately does not retain a medical history after the session ends.

One observation is one variable rated at one local date and time by a stated reporter role in a stated context. One check-in can create several observations. Medication events are separate records, each with its own medication, formulation, dose, time, and status. An optional link between an observation and an event is chosen explicitly; proximity does not imply a relationship.

The catalog contains 42 built-in variables and supports custom 1–10 variables with named endpoints. It is a broad starting point, not a validated assessment instrument or an exhaustive catalog of symptoms. Users can track a manageable subset and hide chart variables without deleting entries from the current session.

## Display and interpretation

- Daily charts place recorded values at their stated time. Lines connect observations no more than three hours apart. These connections are not measurements or estimates of the intervening hours.
- Unrecorded hours and days remain missing. Missing medication events do not establish that a dose was missed.
- Daily averages are arithmetic means of available observations for each variable and date. Details include counts and recorded ranges. Recording times, reporter mixes, and contexts can change the average.
- Scores are whole numbers from 1 to 10, interpreted using each variable's endpoints. High focus and high fatigue have different meanings. Variables are not combined into a total clinical score.
- Date-range review presents descriptive charts, medication entries, and observations in the current session. There are no in-app export, print, backup, or sharing actions.

The app does not recommend a medication, dose, formulation, timing, or redosing; diagnose a condition; label treatment as effective; infer medication onset or wear-off; or make an emergency assessment. Temporal proximity and descriptive changes do not establish a medication effect. The app does not monitor for urgent symptoms or replace clinical care.

## Privacy and session lifetime

Journal entries and preferences exist only in the current page's memory. The public application does not read or write journals using `localStorage`, `sessionStorage`, IndexedDB, cookies, or a remote database. Reloading or closing the page ends the session; browser-history restoration starts a fresh session. There is no recovery or saved history to resume later.

Fictional sample data provides a way to explore the interface. A blank session supports temporary entries. The interface does not collect a patient profile. Free-text entries should not contain names, contact details, medical record numbers, or other identifying information. Someone with access to the open page can see its contents. The application cannot control a user's screenshots, browser features, extensions, or device-level recording.

Application assets have no runtime third-party dependencies, analytics, remote fonts, or network data API. The Content Security Policy blocks outgoing data connections and form submissions. GitHub Pages serves the static files and may log normal hosting information, including visitor IP addresses. The app does not send journal fields with those requests.

Prior versions saved records in browser storage. This release leaves those records untouched and does not load or migrate them. Users can remove old records through their browser's site-data controls. The GitHub Pages origin is separate from the original local development origin and cannot access that origin's storage.

There are no accounts, provider portal, access controls, background notifications, automatic backups, cross-device synchronization, audit log, electronic health record integration, or encryption key management. The software makes no HIPAA compliance, regulatory clearance, or clinical validation claim.

## Current scope and future work

Hourly tracking is manual: there are no automatic prompts, wearable integrations, or physiological measurements in their original units. Custom variables are 1–10 ratings; notes can preserve context during the session without converting it into a validated measurement.

A longitudinal journal or clinical deployment would require an explicit decision about retaining health information, plus appropriate privacy and security design, authorization, audit and retention controls, accessibility and human-factors assessment, and applicable legal/regulatory review. Those capabilities are outside this version.
