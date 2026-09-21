import Link from "next/link";
import { ArrowUpRight, ArrowRight, Plus, FolderKanban, UsersRound, ClipboardCheck, CheckCircle2, Clock3 } from "lucide-react";
import { AppShell, Empty, Stat, StatusBadge } from "./app-shell";
import { formatIST } from "@/lib/timezone";

export async function Dashboard({ user }: { user: any }) {
  const { supabase, profile } = user;
  const isAdmin = profile.role === "ADMIN";
  const statuses = ["PENDING_PMC", "RESUBMITTED", "PENDING_CLIENT", "PMC_REJECTED", "CLIENT_REJECTED", "FINAL_APPROVED", "CLOSED"];
  const scoped = () => {
    const query = supabase.from("inspections").select("id", { count: "exact", head: true });
    return profile.role === "CONTRACTOR" ? query.eq("contractor_id", user.user.id) : query;
  };
  let query = supabase.from("inspections").select("id,inspection_number,location,status,updated_at,projects(name,code)").order("updated_at", { ascending: false }).limit(8);
  if (profile.role === "CONTRACTOR") query = query.eq("contractor_id", user.user.id);
  const [recent, all, projects, ...counts] = await Promise.all([query, scoped(), supabase.from("projects").select("id", { count: "exact", head: true }), ...statuses.map((status) => scoped().eq("status", status))]);
  if (recent.error || all.error || projects.error || counts.some((result: any) => result.error)) throw new Error("Unable to load the workspace overview. Please refresh.");
  const statusCounts = Object.fromEntries(statuses.map((status, index) => [status, counts[index].count || 0]));
  const total = all.count || 0;
  const approved = statusCounts.FINAL_APPROVED + statusCounts.CLOSED;
  const pending = statusCounts.PENDING_PMC + statusCounts.RESUBMITTED + statusCounts.PENDING_CLIENT;
  const rejected = statusCounts.PMC_REJECTED + statusCounts.CLIENT_REJECTED;
  const rate = total ? Math.round(approved / total * 100) : 0;
  const stages = [
    { label: "PMC review", value: statusCounts.PENDING_PMC + statusCounts.RESUBMITTED, color: "#168e87", href: "/inspections?status=pending" },
    { label: "Client approval", value: statusCounts.PENDING_CLIENT, color: "#87b5e7", href: "/inspections?status=PENDING_CLIENT" },
    { label: "Requires action", value: rejected, color: "#e9b869", href: "/inspections" },
    { label: "Approved / closed", value: approved, color: "#b9dfd0", href: "/inspections?status=FINAL_APPROVED" }
  ];
  return <AppShell user={profile}>
    <div className="workspace-breadcrumb">Workspace <span>/</span> Overview</div>
    <section className="project-hero"><div className="hero-topline"><span className="hero-live"><i /> {isAdmin ? "Administration" : "Inspection workspace"}</span><span>Built for better project delivery</span></div>
      <div className="hero-content"><p>YOUR WORK, IN PERSPECTIVE</p><h1>A clearer view of<br />every project.</h1><div className="hero-caption">Welcome back, {profile.name?.split(" ")[0]}. Keep your teams,<br className="desktop-break" /> evidence and approvals moving together.</div></div>
      <Link className="hero-link" href={isAdmin ? "/admin/master#create-project" : "/inspections"}>{isAdmin ? "Manage projects" : "Explore inspections"}<ArrowUpRight size={18} /></Link>
    </section>
    <div className="overview-tabs"><Link href={isAdmin ? "/admin" : `/${profile.role.toLowerCase()}`} aria-current="page">Overview</Link><Link href="/inspections">Inspections</Link>{isAdmin && <><Link href="/admin/master">Projects</Link><Link href="/admin/users">Team members</Link><Link href="/admin/allocations">Allocations</Link></>}<Link href="/reports">Reports</Link></div>
    <div className="overview-heading"><div><h2>Workspace at a glance</h2><p className="muted">Your latest activity and what needs attention.</p></div><Link className="btn btn-primary" href={isAdmin ? "/admin/users#create-user" : profile.role === "CONTRACTOR" ? "/inspections/new" : "/inspections?status=pending"}><Plus size={16} />{isAdmin ? "Add team member" : profile.role === "CONTRACTOR" ? "New inspection" : "Review inspections"}</Link></div>
    <div className="stats overview-stats"><Stat label="Total inspections" value={total} sub="Across your workspace" /><Stat label="Awaiting review" value={pending} sub="PMC and client approvals" /><Stat label="Approved & closed" value={approved} sub={`${rate}% of all inspections`} /><Stat label="Projects" value={projects.count || 0} sub="Available to your account" /></div>
    <div className="overview-panels"><section className="card pipeline-panel"><div className="section-heading"><div><p className="eyebrow">WORKFLOW</p><h2>Keep every stage moving</h2></div><Clock3 size={20} /></div><div className="pipeline-bar" aria-label="Inspection status distribution">{stages.map((stage) => <span key={stage.label} style={{ flex: stage.value || 0, background: stage.color }} />)}</div><div className="pipeline-legend">{stages.map((stage) => <Link key={stage.label} href={stage.href}><span><i style={{ background: stage.color }} />{stage.label}</span><strong>{stage.value}</strong></Link>)}</div></section>
      <section className="workspace-callout"><div className="callout-icon"><CheckCircle2 size={24} /></div><p className="eyebrow">CONNECTED TEAMS. CLEAR ACCOUNTABILITY.</p><h2>The right people.<br />The right project.</h2><p>Keep project access and inspection updates in sync.</p><Link href={isAdmin ? "/admin/allocations" : "/inspections"}>{isAdmin ? "Manage allocations" : "View your inspections"}<ArrowRight size={17} /></Link></section></div>
    <section className="card activity-card"><div className="section-heading"><div><p className="eyebrow">THE LATEST</p><h2>Recent inspections</h2></div><Link className="text-link" href="/inspections">View all <ArrowUpRight size={16} /></Link></div>{recent.data?.length ? <div className="tablewrap"><table className="table activity-table"><thead><tr><th>Inspection</th><th>Project / location</th><th>Status</th><th>Last updated</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{recent.data.map((inspection: any) => <tr key={inspection.id}><td><Link href={`/inspections/${inspection.id}`}><ClipboardCheck size={17} />{inspection.inspection_number}</Link></td><td><strong>{inspection.projects?.name || "Project"}</strong><small>{inspection.location}</small></td><td><StatusBadge status={inspection.status} /></td><td>{formatIST(inspection.updated_at)}</td><td><Link aria-label={`Open ${inspection.inspection_number}`} href={`/inspections/${inspection.id}`}><ArrowUpRight size={17} /></Link></td></tr>)}</tbody></table></div> : <Empty title="Your next inspection starts here" body="As your team submits inspections, you’ll see their progress in this space." />}</section>
  </AppShell>;
}
