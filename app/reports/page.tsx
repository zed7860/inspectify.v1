import { requireUser } from "@/lib/auth/guard";
import { AppShell } from "@/components/app-shell";
import { ReportBrowser } from "@/components/report-browser";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const u = await requireUser();
  const params = await searchParams;
  const projectId = typeof params.projectId === "string" ? params.projectId : "";
  const from = typeof params.from === "string" ? params.from : "";
  const to = typeof params.to === "string" ? params.to : "";
  const { data: projects } = await u.supabase.from("projects").select("id,name,code").order("name");
  let inspectionQuery = u.supabase.from("inspections").select("id,inspection_number,location,status,created_at,projects(name),categories(name)").order("created_at", { ascending: false });
  if (projectId) inspectionQuery = inspectionQuery.eq("project_id", projectId);
  if (from) inspectionQuery = inspectionQuery.gte("created_at", `${from}T00:00:00.000Z`);
  if (to) { const end = new Date(`${to}T00:00:00.000Z`); end.setUTCDate(end.getUTCDate() + 1); inspectionQuery = inspectionQuery.lt("created_at", end.toISOString()); }
  const { data: inspections } = await inspectionQuery;
  const query = new URLSearchParams({ ...(projectId ? { projectId } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  const exportBase = `/api/reports?${query}`;

  return (
    <AppShell user={u.profile}>
      <div className="pagehead">
        <div>
          <h1>Reports</h1>
          <p className="muted">Inspection register and export-ready reporting views.</p>
        </div>
      </div>

      <div className="card">
        <h2>Inspection Register</h2>
        <p className="muted">Choose a project and date range, then generate an organized PDF dossier with the complete inspection history and photos.</p>
        <form className="formgrid report-filters" method="get">
          <div className="field"><label htmlFor="report-project">Project</label><select id="report-project" name="projectId" defaultValue={projectId}><option value="">All projects</option>{projects?.map((project: any) => <option key={project.id} value={project.id}>{project.code} — {project.name}</option>)}</select></div>
          <div className="field"><label htmlFor="report-from">From date</label><input id="report-from" type="date" name="from" defaultValue={from} /></div>
          <div className="field"><label htmlFor="report-to">To date</label><input id="report-to" type="date" name="to" defaultValue={to} /></div>
          <div className="row-actions report-filter-actions"><button className="btn btn-primary">Apply filters</button><a className="btn btn-secondary" href="/reports">Clear</a></div>
        </form>
      </div>
      <ReportBrowser rows={inspections || []} exportBase={exportBase} />
    </AppShell>
  );
}
