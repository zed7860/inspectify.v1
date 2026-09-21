import { requireUser } from "@/lib/auth/guard";
import { AppShell } from "@/components/app-shell";
import { AdminForm } from "@/components/admin-form";
export const dynamic = "force-dynamic";
export default async function Page() {
  const u = await requireUser(["ADMIN"]);
  const [projects, users, assignments] = await Promise.all([
    u.supabase.from("projects").select("id,name,code").order("name"),
    u.supabase.from("profiles").select("id,name,email,role,is_active").is("deleted_at", null).order("name"),
    u.supabase.from("project_users").select("project_id,user_id")
  ]);
  if (projects.error || users.error || assignments.error) throw new Error("Unable to load project allocations.");
  return <AppShell user={u.profile}><div className="pagehead"><div><h1>Project allocation</h1><p className="muted">Select the users who can access each project and receive its inspection emails. Disabled users do not receive notifications. Administrators retain access to all projects.</p></div></div>
    {!projects.data?.length && <p>Create a project first from the Projects page.</p>}
    {projects.data?.map((project) => <AdminForm className="card" action="/api/admin/allocations" method="post" key={project.id}>
      <h2>{project.code} — {project.name}</h2><input type="hidden" name="projectId" value={project.id} />
      <div className="checkbox-list">{users.data?.map((user) => <label key={user.id}><input type="checkbox" name="userIds" value={user.id} defaultChecked={assignments.data?.some((assignment) => assignment.project_id === project.id && assignment.user_id === user.id)} /> {user.name} · {user.email} · {user.role}{!user.is_active ? " (disabled)" : ""}</label>)}</div>
      <button className="btn btn-primary">Save allocation</button>
    </AdminForm>)}
  </AppShell>;
}
