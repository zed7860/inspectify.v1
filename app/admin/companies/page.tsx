import { requireUser } from "@/lib/auth/guard";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function Page() {
  const u = await requireUser(["ADMIN"]);
  const { data: companies } = await u.supabase.from("companies").select("*").order("name");

  return <AppShell user={u.profile}>
    <div className="pagehead"><div><p className="eyebrow">Administration</p><h1>Companies</h1><p className="muted">A focused directory for contractor, PMC, and client organizations.</p></div><a className="btn btn-primary" href="#create-company">Add company</a></div>
    <section className="card formgrid" id="create-company"><div><p className="eyebrow">Company directory</p><h2>Add company</h2><p className="muted">Keep organization setup quick and uncluttered.</p></div><form className="formgrid" action="/api/admin/master" method="post"><input type="hidden" name="kind" value="company" /><div className="field"><label>Name</label><input name="name" required /></div><div className="field"><label>Type</label><select name="type"><option>CONTRACTOR</option><option>PMC</option><option>CLIENT</option></select></div><button className="btn btn-primary">Create company</button></form></section>
    <section className="card"><div className="section-heading"><div><p className="eyebrow">Directory</p><h2>All companies</h2></div><span className="badge">{companies?.length || 0} records</span></div><div className="liststack">{companies?.map((company: any) => <details className="expand-row" key={company.id}><summary><span><strong>{company.name}</strong><small>{company.type}</small></span><span className="summary-action">View / edit</span></summary><div className="expand-body"><div className="detail-copy"><span className="eyebrow">Company profile</span><h3>{company.name}</h3><p className="muted">Organization type: {company.type}</p></div><form className="inline-edit" action="/api/admin/master" method="post"><input type="hidden" name="action" value="update" /><input type="hidden" name="kind" value="company" /><input type="hidden" name="id" value={company.id} /><div className="field"><label>Name</label><input name="name" defaultValue={company.name} required /></div><div className="field"><label>Type</label><select name="type" defaultValue={company.type}><option>CONTRACTOR</option><option>PMC</option><option>CLIENT</option></select></div><div className="row-actions"><button className="btn btn-primary">Save changes</button></div></form><form action="/api/admin/master" method="post"><input type="hidden" name="action" value="delete" /><input type="hidden" name="kind" value="company" /><input type="hidden" name="id" value={company.id} /><button className="btn btn-danger">Delete company</button></form></div></details>)}</div></section>
  </AppShell>;
}
