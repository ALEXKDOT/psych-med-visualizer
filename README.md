# ResponseMap

An ADHD symptom and medication journal that helps patients bring specific observations to conversations with their providers. Record how you feel throughout the day, put medication events on the same timeline, and compare days without relying on memory alone.

Source: [ALEXKDOT/psych-med-visualizer](https://github.com/ALEXKDOT/psych-med-visualizer) — private repository; access is required.

## What it does

- Manual check-ins at any time, including hourly, with whole-number ratings from 1 to 10. Ratings begin unrated; choose only what you want to record.
- A searchable catalog of 42 variables covering attention, mood, energy, sleep, appetite, and physical experiences. Add custom variables with your own descriptions of what 1 and 10 mean.
- Medication events with medication name, formulation, dose text, local date and time, and taken, missed, partial, or unknown status. Different events can record different medications and doses.
- Daily line charts with independently selectable variables and medication markers. Hover or focus a point for details. Lines connect recorded points up to three hours apart; longer gaps stay open.
- Editable and deletable entries, reporter and context fields, notes, and optional explicit links between a rating and a medication event.
- Date-range review with daily averages, observation counts, recorded entries, and a printable visit summary. Export the range as CSV or use the browser print dialog to save a PDF.
- Full-journal JSON backup and restore, including custom variables and all dates. Validated imports include migration from the earlier 0.1.0 format.
- Fictional sample data kept separate from your saved journal. Select **Start my journal** to begin saving your own entries.

Hourly recording is a manual workflow. The app does not schedule notifications, collect sensor measurements, or automatically contact a provider. A higher score is not always better: each variable has its own scale descriptions.

## Run locally

Use Node.js 20 or later and a modern browser. The app has no package dependencies and does not need an install step.

From this directory:

```sh
npm run dev
```

Open [ResponseMap locally](http://127.0.0.1:4173). To use a different port, set `RESPONSE_MAP_PORT` before starting the server. Keep using the same browser and address to access the same saved journal; browser storage is specific to an origin.

## Check and build

```sh
npm test
npm run check
npm run build
```

The tests exercise journal validation, migration, calculations, and exports. The syntax check covers application modules and build/server scripts. CI runs these three commands with Node.js 24; it does not publish the app.

The build recreates `dist/` using an explicit allowlist: `index.html`, `styles.css`, `favicon.svg`, and the four browser modules in `src/`. It excludes the development server, documentation, tests, private configuration, and journal backups.

To deploy, serve **only `dist/`** with an HTTPS static host. Keep its directory structure intact and serve `.mjs` files with a JavaScript content type. The assets use relative paths and support hosting under a subdirectory. Hosting the assets does not create shared patient accounts or provider access. Moving to a new origin does not move an existing journal; export a JSON backup and restore it there if desired.

## Your data

Version 1.0 stores one journal in unencrypted `localStorage` in the current browser profile. Anyone who can use that profile may be able to read it. Clearing browser data can remove the journal; JSON backups are manual and are also unencrypted. Importing a backup replaces the current journal after confirmation. A CSV or printed report is a review export, not a restorable backup.

The browser app has no analytics, external fonts, third-party scripts, cloud database, account system, or network data API. A static host still receives ordinary requests for the application files. The app is not an encrypted clinical record system and makes no HIPAA or regulatory compliance claim. Use a nickname and avoid unnecessary identifying details. It organizes observations; it does not diagnose, establish medication effects, or recommend treatment changes.

See [product boundaries](docs/PRODUCT_BOUNDARY.md) and the [data dictionary](docs/DATA_DICTIONARY.md) for details.
