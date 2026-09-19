import Link from "next/link";
import { ArrowUpRight, ClipboardCheck, Plus, ShieldCheck, UsersRound } from "lucide-react";
import { AppShell, Empty, Stat, StatusBadge } from "./app-shell";
import { formatIST } from "@/lib/timezone";

function pendingWith(status: string) {
  if (status === "DRAFT") return "Submitted draft";
  if (status === "PENDING_PMC" || status === "RESUBMITTED") return "PMC review";
  if (status === "PENDING_CLIENT") return "Client approval";
  if (status.includes("REJECTED")) return "Contractor action";
  if (status === "FINAL_APPROVED") return "Complete";
  if (status === "CLOSED") return "Closed";
  return "-";
}

export async function Dashboard({ user }: { user: any }) {
  const supabase = user.supabase;
  const role = user.profile.role;
  const isAdmin = role === "ADMIN";
  let recentQuery = supabase.from("inspections").select("id,inspection_number,location,status,updated_at,submitted_at,projects(name,code),categories(name),subcategories!inspections_subcategory_id_fkey(name),profiles!inspections_contractor_id_fkey(name)", { count: "exact" }).order("updated_at", { ascending: false }).limit(500);
  if (role === "CONTRACTOR") recentQuery = recentQuery.eq("contractor_id", user.user.id);
  let { data: recent, count, error: recentError } = await recentQuery;
  if (recentError) {
    let fallbackQuery = supabase.from("inspections").select("id,inspection_number,location,status,updated_at,submitted_at", { count: "exact" }).order("updated_at", { ascending: false }).limit(500);
    if (role === "CONTRACTOR") fallbackQuery = fallbackQuery.eq("contractor_id", user.user.id);
    const fallback = await fallbackQuery;
    recent = fallback.data;
    count = fallback.count;
    recentError = fallback.error;
  }
  const live = recent;
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

  return <AppShell user={user.profile}>
    <div className="dashboard-hero"><div><p className="eyebrow">Operations overview</p><h1>Good to see you, {user.profile.name?.split(" ")[0] || "there"}.</h1><p className="muted">Track every inspection, evidence submission, approval owner, and action item from one workspace.</p></div><div className="dashboard-actions">{role === "CONTRACTOR" && <Link className="btn btn-primary" href="/inspections/new"><Plus size={17} /> New inspection</Link>}<Link className="btn btn-secondary" href="/inspections"><ClipboardCheck size={17} /> View inspections</Link></div></div>
    <div className="stats dashboard-stats"><Stat label="Total inspections" value={total} sub="All tracked records" /><Stat label="Pending PMC" value={statusCounts.PENDING_PMC} sub="Awaiting first review" /><Stat label="Pending client" value={statusCounts.PENDING_CLIENT} sub="Ready for approval" /><Stat label="Final approved" value={approved} sub={`${approvalRate} approval rate`} /><Stat label="Action required" value={actionRequired} sub="Rejected or resubmission" /></div>
    <div className="dashboard-grid"><section className="card dashboard-main-card"><div className="section-heading"><div><p className="eyebrow">Inspection register</p><h2>All inspections</h2><p className="muted">Every submitted, pending, approved, rejected, and closed inspection available to this user.</p></div><Link className="text-link" href="/inspections">Open full register <ArrowUpRight size={15} /></Link></div>{live?.length ? <div className="inspection-feed">{live.map((inspection: any) => <Link className="inspection-feed-row" href={`/inspections/${inspection.id}`} key={inspection.id}><div className="inspection-feed-main"><strong>{inspection.inspection_number}</strong><span>{inspection.projects?.code || "-"} · {inspection.projects?.name || "Unassigned"}</span><small>{inspection.location || "No location"} · {inspection.categories?.name || "Uncategorised"} · {inspection.subcategories?.name || "No subcategory"}</small></div><div className="inspection-feed-meta"><StatusBadge status={inspection.status} /><span>{pendingWith(inspection.status)}</span><small>Updated {formatIST(inspection.updated_at)}</small></div><ArrowUpRight size={17} /></Link>)}</div> : <Empty title="No inspections found" body="Submitted inspections will appear here after the database workflow is updated." />}</section><aside className="dashboard-side-stack"><section className="card workflow-card"><div className="section-heading"><h2>Workflow health</h2><ShieldCheck size={20} /></div><div className="health-meter"><span style={{ width: `${total ? Math.min(100, Math.max(8, (approved / total) * 100)) : 8}%` }} /></div><strong>{approvalRate} approved</strong><p className="muted">Clear pending reviews and action-required submissions.</p><Link className="btn btn-secondary full-width" href="/inspections?status=pending">Open pending queue</Link></section><section className="card quick-card"><div className="section-heading"><h2>Recently updated</h2><ArrowUpRight size={18} /></div>{recent?.slice(0, 4).map((inspection: any) => <Link href={`/inspections/${inspection.id}`} key={inspection.id}><ClipboardCheck size={17} /> {inspection.inspection_number} · {inspection.status.replaceAll("_", " ")} <ArrowUpRight size={15} /></Link>)}{isAdmin && <Link href="/admin/users"><UsersRound size={17} /> Manage users <ArrowUpRight size={15} /></Link>}{isAdmin && <Link href="/admin/master"><ShieldCheck size={17} /> Master data <ArrowUpRight size={15} /></Link>}</section></aside></div>
  </AppShell>;
}
