# Inspectifier by Cubixtop India

Production-oriented construction inspection workflow: **Contractor → PMC → Client → Final Approval**. This edition uses Supabase directly for PostgreSQL, Auth and private Storage. Prisma is not used.

## 1. Requirements
- Node.js 20+ (Node 24 recommended)
- npm
- A Supabase project

## 2. Supabase database setup
In Supabase Dashboard → **SQL Editor**, run these files in this exact order:
For your **existing database**, run only **`supabase/one-shot-update.sql`**. Open Supabase Dashboard → SQL Editor → New query, paste the entire file, and click Run. It includes all recent migrations and can be run again safely. Do not rerun `schema.sql` or `seed.sql` on an existing database.

For a brand-new empty project only:
1. `supabase/schema.sql`
2. `supabase/one-shot-update.sql`
3. `supabase/seed.sql`

`one-shot-update.sql` includes RLS, private storage, optional review photos, multi-subcategory inspections, allocation, usernames, account deletion and category overrides. You do not need to run the individual migration files separately. It creates the missing table before policies, drops existing policies before recreating them, and can be run again safely. Existing databases can run it directly after `schema.sql` has already been applied.

`schema.sql` creates the relational model, workflow RPCs, immutable revision/event structures, indexes and concurrency-safe inspection numbering. `rls.sql` enables project-aware Row Level Security. `storage.sql` creates the private `inspection-evidence` bucket. `seed.sql` adds settings and starter categories.

## 3. Environment
Copy `.env.example` to `.env.local` and enter values from Supabase Project Settings / Connect:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_KEY
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=use-a-strong-12-plus-character-password
NEXT_PUBLIC_APP_NAME=Inspectifier by Cubixtop India
```

Never expose the service-role key in browser code and never prefix it with `NEXT_PUBLIC_`.

## 4. Local setup in VS Code
```bash
npm install
npm run bootstrap:admin
npm run dev
```
Open `http://localhost:3000` and sign in with the bootstrap Admin credentials.

Use **Admin → Master Data** to create companies/projects. Use **Admin → Users** to create Contractor, PMC, Client and Admin accounts and assign projects.

## 5. Workflow
Contractor creates an inspection with mandatory project/location/category/multiple subcategories/description/photos. The database assigns `INS-YYYY-000001` and server timestamp. PMC can review only assigned-project inspections in `PENDING_PMC`/`RESUBMITTED`; Client can review only `PENDING_CLIENT`. Rejections remain historical and contractor correction uses a new revision. Submission, approval, rejection, and resubmission create in-app notifications and email every active project user plus the submitting contractor when SMTP is configured in Admin → Projects. `lock_version` plus row locking prevents simultaneous finalization.

All database timestamps are `timestamptz` (UTC internally); UI formats them in `Asia/Kolkata` as IST.

## 6. Storage
The `inspection-evidence` bucket is private. Browser users do not receive the service-role key. Server routes validate image MIME/size, upload evidence and inspection detail pages issue short-lived signed URLs after authorization/RLS has allowed access to the inspection.

## 7. Build locally
```bash
npm run build
npm start
```
Resolve any build error locally before deploying.

## 8. Vercel
Push to GitHub and import into Vercel. Add all `.env.local` values to Vercel → Project → Settings → Environment Variables. Do **not** configure a custom Output Directory for a normal Next.js deployment. Build command: `npm run build`.

## Security notes
- Supabase Auth is authoritative for identity.
- `profiles.role` is authoritative for application role; homepage role selection never grants permissions.
- RLS restricts inspection reads to assigned projects, with Admin override.
- Critical workflow writes occur through `SECURITY DEFINER` RPC functions with explicit role/project/status validation.
- Admin Auth user creation uses a server-only service-role client.
- Approval history/revisions/events are not exposed to normal hard-delete UI.
- Production should add rate limiting/WAF rules, malware scanning for uploads, email verification/reset flows, backup/PITR policy, and application-level monitoring before high-stakes site rollout.

### User administration, category imports and project allocation

Run `supabase/one-shot-update.sql` to install all required updates, including atomic CSV mapping imports and project allocation saves.

Administrators can edit name, login email, phone, role, company and active status from Users, and reset passwords from either the directory or user detail page. Re-save an affected user's email to synchronize an earlier profile-only email change with Supabase Auth. The new email becomes the login address immediately; select the account's current role at login.

Download the CSV mapping format under Inspection categories. Use `Category,Subcategory` columns, with one pair per row and repeated category names for multiple children. Imports accept up to 2,000 rows / 1 MB, update matching entries in place and apply all rows together. Repeated names are trimmed and deduplicated within a submission; categories match by name and subcategories by parent plus name. Existing IDs and evidence links remain unchanged. Repeated entries are reactivated without resetting their sort order. Categories are shared with all inspecting users. During inspection, check subcategories and attach at least one photo for each selection; multiple photos per selection are supported.

Allocate existing projects under Project allocation. The selected users receive access and inspection notifications; disabled users are excluded from emails. Administrators retain visibility of all projects. The inspection creator also receives workflow notifications.

Set the deployed public HTTPS origin in **Workflow delivery → Public website address**. Any public deployment domain is supported. Alternatively set `NEXT_PUBLIC_APP_URL`, or use Vercel's production domain environment variable. Localhost links are rejected. This setting does not deploy the application; the configured domain must already serve it. Email links preserve the inspection destination through login.

### Usernames, profile names, deletion and action feedback

The single `supabase/one-shot-update.sql` file also installs usernames and account deletion. Existing accounts can continue using email login. Administrators assign optional usernames to existing accounts and a required username when creating an account. Usernames are case-insensitive and unique (3–30 letters, numbers, dots, underscores or hyphens). Users can update their own display name on Profile; this endpoint cannot change another user's account or permissions.

Users has explicit Disable/Enable and Delete actions. Disabled accounts can be enabled later. Delete uses Supabase Auth soft deletion and a database trigger to remove directory/project access atomically while preserving references in inspection history. Deleted accounts cannot be re-enabled. The trigger also releases the previous email and username for reuse. Apply the migration before using deletion.

Confirmation dialogs are limited to permanent deletion, disabling an active account, and administrator password resets. Routine saves, login/logout, uploads, downloads, reviews and emails proceed directly. Success feedback is shown only after the server accepts the operation, including after redirects. Photo selection is labeled as selection, and downloads are labeled as started (the application cannot observe when the browser finishes saving a file).

### Updated design and deployment

The workspace and login use the teal navigation, pale canvas and project-cover direction of the supplied Carbon Solutions reference. Mobile navigation includes every admin page; forms stack and tables scroll within their cards. Success notices dismiss automatically after five seconds.

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for local development, production preview on port 3001, and Node/Docker cloud hosting. The applied database update does not need to be rerun for this design release.
