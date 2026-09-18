import Link from "next/link";
import { ArrowUpRight, ClipboardCheck, Plus, ShieldCheck, UsersRound } from "lucide-react";
import { AppShell, Empty, Stat, StatusBadge } from "./app-shell";
import { formatIST } from "@/lib/timezone";

export async function Dashboard({ user }: { user: any }) {
  const supabase = user.supabase;
  const role = user.profile.role;
  const isAdmin = role === "ADMIN";
  let recentQuery = supabase.from("inspections").select("id,inspection_number,status,updated_at,projects(name),categories(name),profiles!inspections_contractor_id_fkey(name)", { count: "exact" }).order("updated_at", { ascending: false }).limit(8);
  if (role === "CONTRACTOR") recentQuery = recentQuery.eq("contractor_id", user.user.id);
  const { data: recent, count } = await recentQuery;
  const statusCounts: Record<string, number> = {};
  for (const status of ["PENDING_PMC", "PENDING_CLIENT", "PMC_REJECTED", "CLIENT_REJECTED", "FINAL_APPROVED"]) {
    let query = supabase.from("inspections").select("id", { count: "exact", head: true }).eq("status", status);
    if (role === "CONTRACTOR") query = query.eq("contractor_id", user.user.id);
    statusCounts[status] = (await query).count || 0;
  }
  const total = count || 0;
  const approved = statusCounts.FINAL_APPROVED;
  const actionRequired = statusCounts.PMC_REJECTED + statusCounts.CLIENT_REJECTED;
  const approvalRate = total ? `${Math.round((approved / total) * 100)}%` : "0%";

  return (
    <AppShell user={user.profile}>
      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1>Good to see you, {user.profile.name?.split(" ")[0] || "there"}.</h1>
          <p className="muted">Track inspection flow, approvals, and action items from one workspace.</p>
        </div>
        <div className="dashboard-actions">
          {role === "CONTRACTOR" && <Link className="btn btn-primary" href="/inspections/new"><Plus size={17} /> New inspection</Link>}
          <Link className="btn btn-secondary" href="/inspections"><ClipboardCheck size={17} /> View inspections</Link>
        </div>
      </div>

      <div className="stats dashboard-stats">
        <Stat label="Total inspections" value={total} sub="All tracked records" />
        <Stat label="Pending PMC" value={statusCounts.PENDING_PMC} sub="Awaiting first review" />
        <Stat label="Pending client" value={statusCounts.PENDING_CLIENT} sub="Ready for approval" />
        <Stat label="Final approved" value={approved} sub={`${approvalRate} approval rate`} />
        <Stat label="Action required" value={actionRequired} sub="Rejected or resubmission" />
      </div>

      <div className="dashboard-grid">
        <section className="card dashboard-main-card">
          <div className="section-heading"><div><p className="eyebrow">Live workflow</p><h2>Recent inspections</h2></div><Link className="text-link" href="/inspections">View all <ArrowUpRight size={15} /></Link></div>
          {recent?.length ? <div className="tablewrap dashboard-table"><table className="table"><thead><tr><th>Inspection</th><th>Project</th><th>Category</th><th>Status</th><th>Updated</th></tr></thead><tbody>{recent.map((inspection: any) => <tr key={inspection.id}><td><Link className="table-link" href={`/inspections/${inspection.id}`}><b>{inspection.inspection_number}</b></Link></td><td>{inspection.projects?.name || "Unassigned"}</td><td>{inspection.categories?.name || "Uncategorised"}</td><td><StatusBadge status={inspection.status} /></td><td>{formatIST(inspection.updated_at)}</td></tr>)}</tbody></table></div> : <Empty />}
        </section>

        <aside className="dashboard-side-stack">
          <section className="card workflow-card"><div className="section-heading"><h2>Workflow health</h2><ShieldCheck size={20} /></div><div className="health-meter"><span style={{ width: `${total ? Math.min(100, Math.max(8, (approved / total) * 100)) : 8}%` }} /></div><strong>{approvalRate} approved</strong><p className="muted">Keep projects moving by clearing pending reviews.</p><Link className="btn btn-secondary full-width" href="/inspections?status=pending">Open pending queue</Link></section>
          <section className="card quick-card"><div className="section-heading"><h2>Quick access</h2><ArrowUpRight size={18} /></div><Link href="/reports"><ClipboardCheck size={17} /> Reports <ArrowUpRight size={15} /></Link>{isAdmin && <Link href="/admin/users"><UsersRound size={17} /> Manage users <ArrowUpRight size={15} /></Link>}{isAdmin && <Link href="/admin/master"><ShieldCheck size={17} /> Master data <ArrowUpRight size={15} /></Link>}</section>
        </aside>
      </div>
    </AppShell>
  );
}
