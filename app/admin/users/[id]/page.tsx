import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser(["ADMIN", "SUPER_ADMIN"]);
  const { id } = await params;
  const [{ data: user }, { data: companies }] = await Promise.all([
    u.supabase.from("profiles").select("*,companies(name)").eq("id", id).maybeSingle(),
    u.supabase.from("companies").select("id,name").eq("is_active", true).order("name"),
  ]);

  if (!user) notFound();

  return (
    <AppShell user={u.profile}>
      <div className="pagehead"><div><p className="eyebrow">User details</p><h1>{user.name}</h1><p className="muted">Review identity, role, company, and project access in one place.</p></div><a className="btn btn-secondary" href="/admin/users">Back to users</a></div>
      <div className="detail-layout">
        <aside className="card profile-summary"><div className="avatar">{user.name?.slice(0, 1).toUpperCase()}</div><h2>{user.name}</h2><p className="muted">{user.email}</p><span className="badge">{user.role}</span><dl><dt>Phone</dt><dd>{user.phone || "Not provided"}</dd><dt>Company</dt><dd>{user.companies?.name || "Not assigned"}</dd><dt>Status</dt><dd>{user.is_active ? "Active" : "Disabled"}</dd></dl></aside>
        <form className="card formgrid" action="/api/admin/users" method="post">
          <input type="hidden" name="action" value="update" /><input type="hidden" name="id" value={user.id} />
          <div className="section-heading span2"><div><p className="eyebrow">Access settings</p><h2>Edit details</h2></div></div>
          <div className="field"><label>Name</label><input name="name" defaultValue={user.name} required /></div>
          <div className="field"><label>Email</label><input type="email" name="email" defaultValue={user.email} required /></div>
          <div className="field"><label>Phone</label><input name="phone" defaultValue={user.phone || ""} /></div>
          <div className="field"><label>Role</label><select name="role" defaultValue={user.role}><option>CONTRACTOR</option><option>PMC</option><option>CLIENT</option><option>ADMIN</option></select></div>
          <div className="field"><label>Company</label><select name="companyId" defaultValue={user.company_id || ""}><option value="">None</option>{companies?.map((company: any) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>
          <button className="btn btn-primary">Save user details</button>
        </form>
      </div>
    </AppShell>
  );
}
