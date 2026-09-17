import {NextResponse} from "next/server";import {requireUser} from "@/lib/auth/guard";import {adminClient} from "@/lib/supabase/admin";

export async function POST(r: Request) {
  const u = await requireUser(["ADMIN", "SUPER_ADMIN"]);
  const f = await r.formData();
  const action = String(f.get("action") || "create");
  const a = adminClient();

  if (action === "delete") {
    const id = String(f.get("id") || "");
    if (!id) return NextResponse.redirect(new URL("/admin/users", r.url), 303);

    await a.from("project_users").delete().eq("user_id", id);
    await a.from("profiles").delete().eq("id", id);
    await a.auth.admin.deleteUser(id);

    return NextResponse.redirect(new URL("/admin/users", r.url), 303);
  }

  if (action === "update") {
    const id = String(f.get("id") || "");
    if (!id) return NextResponse.redirect(new URL("/admin/users", r.url), 303);

    const name = String(f.get("name") || "");
    const email = String(f.get("email") || "");
    const phone = String(f.get("phone") || "");
    const role = String(f.get("role") || "");
    const companyId = String(f.get("companyId") || "") || null;
    await a.from("profiles").update({
      name,
      email,
      phone: phone || null,
      role,
      company_id: companyId
    }).eq("id", id);

    return NextResponse.redirect(new URL("/admin/users", r.url), 303);
  }

  const email = String(f.get("email") || "");
  const password = String(f.get("password") || "");
  const name = String(f.get("name") || "");
  const role = String(f.get("role") || "");

  const { data, error } = await a.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name }
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const uid = data.user.id;
  await a.from("profiles").insert({
    id: uid,
    email,
    name,
    phone: String(f.get("phone") || "") || null,
    role,
    company_id: String(f.get("companyId") || "") || null
  });

  await a.from("audit_logs").insert({
    user_id: u.user.id,
    user_name_snapshot: u.profile.name,
    role_snapshot: u.profile.role,
    action: "CREATE_USER",
    entity_type: "User",
    entity_id: uid,
    new_state: { email, role }
  });

  return NextResponse.redirect(new URL("/admin/users", r.url), 303);
}
