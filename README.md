# ResponseMap

An interactive ADHD symptom and medication journal for patients and conversations with their providers. Record observations throughout the day, place medication events on the same timeline, and select the variables you want to compare.

**[Open the public app](https://alexkdot.github.io/psych-med-visualizer/)** · [Source code](https://github.com/ALEXKDOT/psych-med-visualizer)

## Session-only privacy

Version 1.1 keeps entries only in the open page's memory. It does not save journal entries, medication events, notes, custom variables, or chart preferences to browser storage or a server. Reloading or closing the page ends the session, and returning through browser history starts fresh. This is a temporary workspace, not a retained medical record.

Start with fictional sample data or a blank session. There are no accounts, patient profile fields, uploads, downloads, saved backups, or provider sharing. Avoid names, contact details, record numbers, or other identifying information in free-text fields. Anything typed is visible to people with access to the open page.

The app has no analytics, external fonts, third-party scripts, cloud database, or data API. Its Content Security Policy blocks outgoing data connections and form submissions. GitHub receives ordinary requests for the static application files and may retain hosting information such as IP addresses; the app does not include journal contents in those requests. This is not a claim that the host receives no visitor information.

Older versions saved journals in browser storage. This version does not read, migrate, overwrite, or delete those old records. Use your browser's site-data controls if you want to remove them. The public GitHub Pages address is a different origin from the original local development address and cannot read its saved records.

## What it does

- Manual check-ins at any time, including hourly, with whole-number ratings from 1 to 10. Ratings begin unrated; choose only what you want to record.
- A searchable catalog of 42 variables covering attention, mood, energy, sleep, appetite, and physical experiences. Add custom variables with descriptions of what 1 and 10 mean.
- Medication events with medication name, formulation, dose text, local date and time, and taken, missed, partial, or unknown status. Each event can describe a different medication or dose.
- Daily line charts with independently selectable variables and medication markers. Hover or focus a point for details. Lines connect recorded points up to three hours apart; longer gaps stay open.
- Editable and deletable entries, reporter roles, context, notes, and optional explicit links between a rating and a medication event.
- Date-range review of the current session, with daily averages, observation counts, and recorded entries.

Hourly recording is manual. The app does not schedule notifications, collect sensor measurements, or contact a provider. Each variable has its own scale: a higher score is not always better. The app organizes observations; it does not diagnose, establish medication effects, or recommend treatment changes.

## Run locally

Use Node.js 20 or later and a modern browser. There are no package dependencies and no install step.

```sh
npm run dev
```

Open [ResponseMap locally](http://127.0.0.1:4173). To use a different port, set `RESPONSE_MAP_PORT` before starting the server. Local sessions have the same temporary behavior as the public app.

## Check and publish

```sh
npm test
npm run check
npm run build
```

The tests cover journal validation, calculations, compatibility utilities, and public-app privacy safeguards. Syntax checks cover the application modules and build/server scripts. The build recreates `dist/` from an explicit allowlist of six static assets: `index.html`, `styles.css`, `favicon.svg`, and the three browser modules in `src/`. It excludes the development server, documentation, tests, private configuration, user files, and the unused portability module.

GitHub Pages publishes only `dist/`. The [Pages workflow](.github/workflows/pages.yml) runs tests, syntax checks, and the build on each push to `main`, then deploys the generated files. It can also be run manually. In repository **Settings → Pages**, choose **GitHub Actions** as the build source. The deployment uses the `github-pages` environment with narrowly scoped publishing permissions, following [GitHub's custom Pages workflow guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). The existing CI workflow also checks pull requests.

Assets use relative paths so the app works at the repository subpath. A failed check prevents that workflow run from deploying. Publishing this static site does not publish a user's open session or create shared provider access.

The source repository is public. Its published source and history contain application code and fictional test/sample records, not patient journals. Keep real records, credentials, backups, and identifying screenshots out of commits, issues, and pull requests.

See the [product boundaries](docs/PRODUCT_BOUNDARY.md) and [data dictionary](docs/DATA_DICTIONARY.md) for details.
