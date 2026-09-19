<<<<<<< HEAD
# Inspectifier by Cubixtop India
=======
# Inspectifier — Next.js 16 + Supabase (No Prisma)

Production-oriented construction inspection workflow: **Contractor → PMC → Client → Final Approval**. This edition uses Supabase directly for PostgreSQL, Auth and private Storage. Prisma is not used.

## 1. Requirements
- Node.js 20+ (Node 24 recommended)
- npm
- A Supabase project

## 2. Supabase database setup
In Supabase Dashboard → **SQL Editor**, run these files in this exact order:
1. `supabase/schema.sql`
2. `supabase/one-shot-update.sql`
3. `supabase/storage.sql`
4. `supabase/seed.sql`

`one-shot-update.sql` replaces the older `rls.sql` plus the multi-subcategory migration for a fresh setup. It creates the missing table before policies, drops existing policies before recreating them, and can be run again safely. Existing databases can run it directly after `schema.sql` has already been applied.

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
