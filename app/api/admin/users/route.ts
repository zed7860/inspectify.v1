import { normalizeUsername } from "@/lib/auth/username";
import {NextResponse} from "next/server";import {requireUser} from "@/lib/auth/guard";import {adminClient} from "@/lib/supabase/admin";

export async function POST(r: Request) {
  const u = await requireUser(["ADMIN"]);
  const f = await r.formData();
  const action = String(f.get("action") || "create");
  const a = adminClient();

  if (action === "delete") {
    const id = String(f.get("id") || "");
    if (!id) return NextResponse.redirect(new URL("/admin/users", r.url), 303);

    if (id === u.user.id) return NextResponse.json({ error: "You cannot delete your own admin account." }, { status: 400 });
    const { error: lookupError } = await a.from("profiles").select("id,deleted_at").eq("id", id).is("deleted_at", null).single();
    if (lookupError) return NextResponse.json({ error: "User not found or account migration has not been applied." }, { status: 400 });
    const { error: authError } = await a.auth.admin.deleteUser(id, true);
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    return NextResponse.redirect(new URL("/admin/users", r.url), 303);
  }

  if (action === "setActive") {
    const id = String(f.get("id") || "");
    const isActive = f.get("isActive") === "true";
    if (id === u.user.id && !isActive) return NextResponse.json({ error: "You cannot disable your own admin account." }, { status: 400 });
    const { error } = await a.from("profiles").update({ is_active: isActive }).eq("id", id).is("deleted_at", null).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ message: isActive ? "User enabled successfully." : "User disabled successfully.", redirect: "/admin/users" });
  }

  if (action === "resetPassword") {
    const id = String(f.get("id") || "");
    const password = String(f.get("password") || "");
    if (!id || password.length < 12) return NextResponse.json({ error: "A password of at least 12 characters is required." }, { status: 400 });
    const { error } = await a.auth.admin.updateUserById(id, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "update") {
    const id = String(f.get("id") || "");
    if (!id) return NextResponse.redirect(new URL("/admin/users", r.url), 303);

    let username: string | null = null;
    try { if (String(f.get("username") || "").trim()) username = normalizeUsername(String(f.get("username"))); }
    catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
    const name = String(f.get("name") || "").trim();
    const email = String(f.get("email") || "").trim().toLowerCase();
    const phone = String(f.get("phone") || "").trim();
    const role = String(f.get("role") || "");
    const isActive = f.get("isActive") !== "false";
    const companyId = String(f.get("companyId") || "") || null;
    if (!name || !email || !["ADMIN", "CONTRACTOR", "PMC", "CLIENT"].includes(role)) return NextResponse.json({ error: "Valid name, email and role are required." }, { status: 400 });
    if (id === u.user.id && (!isActive || role !== "ADMIN")) return NextResponse.json({ error: "You cannot disable or demote your own admin account." }, { status: 400 });
    const { data: original, error: lookupError } = await a.auth.admin.getUserById(id);
    if (lookupError || !original.user) return NextResponse.json({ error: "User account not found." }, { status: 404 });
    const { error: authError } = await a.auth.admin.updateUserById(id, { email, email_confirm: true, user_metadata: { name } });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
    const { data: saved, error: profileError } = await a.from("profiles").update({ name, username, email, phone: phone || null, role, company_id: companyId, is_active: isActive }).eq("id", id).is("deleted_at", null).select("id").single();
    if (profileError || !saved) {
      const { error: rollbackError } = await a.auth.admin.updateUserById(id, { email: original.user.email, email_confirm: true, user_metadata: original.user.user_metadata });
      return NextResponse.json({ error: rollbackError ? "Profile save and login rollback failed. Re-save this account to synchronize its email." : profileError?.message || "Profile not found." }, { status: 400 });
    }

    return NextResponse.redirect(new URL("/admin/users", r.url), 303);
  }

  let username: string;
  try { username = normalizeUsername(String(f.get("username") || "")); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const email = String(f.get("email") || "").trim().toLowerCase();
  const password = String(f.get("password") || "");
  const name = String(f.get("name") || "");
  const role = String(f.get("role") || "");

  if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || !["ADMIN", "CONTRACTOR", "PMC", "CLIENT"].includes(role)) return NextResponse.json({ error: "Provide a name, valid email and role, and a password of at least 12 characters." }, { status: 400 });
  if (action !== "create") return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  const { data, error } = await a.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name }
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const uid = data.user.id;
  const { error: profileError } = await a.from("profiles").insert({
    id: uid,
    username,
    email,
    name,
    phone: String(f.get("phone") || "") || null,
    role,
    company_id: String(f.get("companyId") || "") || null
  });

  if (profileError) { await a.auth.admin.deleteUser(uid); return NextResponse.json({ error: profileError.message }, { status: 400 }); }

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
