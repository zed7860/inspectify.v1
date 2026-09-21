# Local and cloud testing

The database update has already been applied. This design update requires no additional SQL.

## Local development

Use Node.js 22 or 24. Keep your existing `.env.local`.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Sign in with an existing username or email, password and account role.

## Test the production build locally

```sh
npm run test
npm run build
npm run preview
```

Open http://localhost:3001. The production server uses your existing `.env.local` and the same Supabase database. These are real records; creating inspections can send real workflow emails. `npm start` serves the build on port 3000 (or the host's `PORT`).

## Cloud: Node server

Upload or connect this repository to a Node host. Set the build command to `npm ci && npm run build`, the start command to `npm start`, and health-check path to `/api/health`. Use Node.js 22/24. Set environment variables from `.env.production.example` using your own project values. Set the service-role key as a runtime secret. Do not upload `.env.local` or local `.next` build output.

## Cloud: Docker

The Dockerfile excludes local environment files and runs as a non-root user. Supply the two public Supabase values as build arguments, then supply Supabase environment variables and the service-role secret at runtime through the hosting platform. A container host with configurable request size and timeouts is suitable for multiple inspection photos and report generation.

```sh
docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY -t inspectifier .
docker run --rm -p 3001:3000 --env-file .env.local inspectifier
```

Public Supabase values are embedded in the browser bundle at build time. Rebuild when changing Supabase projects. Keep the service-role key out of build arguments and source control.

## After deploying

1. Set **Workflow delivery → Public website address** to the deployed HTTPS origin. No localhost links are sent.
2. Add the cloud URL and localhost URLs to the Supabase Auth URL configuration as needed for the project's authentication flows.
3. Test login, admin pages, a project allocation, a multi-photo inspection, a review, and email links with designated test accounts.
4. Test desktop, tablet and phone layouts. On desktop, use Collapse menu / Expand menu to switch between names and icons; the preference is remembered. On smaller screens, the menu button gives access to every admin page with labels.

Publishing still requires a selected hosting account/project. No cloud deployment is created merely by building locally.

## Design

Visual direction: [Carbon Solutions B2B Dashboard Design by Ramotion](https://dribbble.com/shots/25554521-Carbon-Solutions-B2B-Dashboard-Design). Architecture cover: [Unsplash image](https://images.unsplash.com/photo-1486406146926-c627a92ad1ab). The app uses its own layout, branding and real inspection data.


## Email delivery checks

Every submission, resubmission and review sends the current PDF report to active users assigned to the project at every role, plus the active submitting contractor. Missing public URL configuration no longer prevents sending; configure the deployed URL to include working inspection links.

Reports are generated on the server from authorized inspection IDs, avoiding browser PDF re-uploads. Select up to 20 inspections and up to 50 recipient addresses; commas, semicolons, spaces and newlines are accepted. Duplicate addresses are removed. Attachments must total at most 18 MB before email encoding.

Workflow delivery shows accepted and rejected recipients and allows retrying failed inspection recipients. A saved inspection remains saved if mail delivery fails. SMTP acceptance does not guarantee inbox placement: verify a designated recipient's inbox/spam folder. Old silently failed notifications from before this update have no delivery history; use Reports to send their reports.

Allow sufficient server execution time for report generation and SMTP (routes request up to 300 seconds). A Node/container host avoids the small multipart upload limits imposed by some serverless hosts.
