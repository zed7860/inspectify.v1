import { requireUser } from "@/lib/auth/guard";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function Page() {
  const u = await requireUser(["ADMIN"]);
  const [{ data: projects }, { data: companies }] = await Promise.all([
    u.supabase.from("projects").select("*").order("name"),
    u.supabase.from("companies").select("id,name,type").eq("is_active", true).order("name")
  ]);

  return <AppShell user={u.profile}>
    <div className="pagehead"><div><p className="eyebrow">Workspace setup</p><h1>Projects</h1><p className="muted">Projects are shared across the workspace and available to every user.</p></div><a className="btn btn-primary" href="#create-project">Add project</a></div>
    <section className="card formgrid" id="create-project"><div><p className="eyebrow">Project register</p><h2>Create project</h2><p className="muted">Add the project details and assign the companies that can inspect it.</p></div><form className="formgrid" action="/api/admin/master" method="post"><input type="hidden" name="kind" value="project" /><div className="field"><label>Name</label><input name="name" required /></div><div className="field"><label>Reference code</label><input name="code" required /></div><div className="field span2"><label>Address</label><textarea name="address" /></div><div className="field span2"><label>Assigned companies</label><select name="companyIds" multiple required size={Math.min(Math.max(companies?.length || 1, 3), 6)}>{companies?.map((company: any) => <option key={company.id} value={company.id}>{company.name} · {company.type}</option>)}</select><small className="muted">Every active user in the selected companies will be able to start inspections for this project.</small></div><button className="btn btn-primary">Create project</button></form></section>
    <section className="card"><div className="section-heading"><div><p className="eyebrow">Directory</p><h2>All projects</h2></div><span className="badge">{projects?.length || 0} projects</span></div><div className="liststack">{projects?.map((project: any) => <details className="expand-row" key={project.id}><summary><span><strong>{project.name}</strong><small>{project.code}</small></span><span className="summary-action">View / edit</span></summary><div className="expand-body"><div className="detail-copy"><span className="eyebrow">Shared project</span><h3>{project.name}</h3><p className="muted">{project.address || "No address provided"}</p></div><form className="inline-edit" action="/api/admin/master" method="post"><input type="hidden" name="action" value="update" /><input type="hidden" name="kind" value="project" /><input type="hidden" name="id" value={project.id} /><div className="field"><label>Name</label><input name="name" defaultValue={project.name} required /></div><div className="field"><label>Reference code</label><input name="code" defaultValue={project.code} required /></div><div className="field"><label>Address</label><textarea name="address" defaultValue={project.address || ""} /></div><button className="btn btn-primary">Save changes</button></form><form action="/api/admin/master" method="post"><input type="hidden" name="action" value="delete" /><input type="hidden" name="kind" value="project" /><input type="hidden" name="id" value={project.id} /><button className="btn btn-danger">Delete project</button></form></div></details>)}</div></section>
  </AppShell>;
}
