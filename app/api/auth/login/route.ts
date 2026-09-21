import { adminClient } from "@/lib/supabase/admin";
import { normalizeUsername } from "@/lib/auth/username";
import { inspectionReturnPath } from "@/lib/notifications/app-url";
import {NextResponse} from "next/server";import {createClient} from "@/lib/supabase/server";

function normalizeRole(role: string | null | undefined) {
  if (!role) return "";
  return role.toUpperCase().replace(/\s+/g, "_");
}

export async function POST(r: Request) {
  let email = "";
  let password = "";
  let selectedRole = "";
  let next = "";

  const contentType = r.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await r.json().catch(() => ({}));
    email = String(body.identifier || body.email || "").trim().toLowerCase();
    next = inspectionReturnPath(String(body.next || ""));
    password = String(body.password || "");
    selectedRole = normalizeRole(body.role || body.selectedRole);
  } else {
    const form = await r.formData().catch(() => null);
    next = inspectionReturnPath(String(form?.get("next") || ""));
    const identifier = form?.get("identifier") ?? "";
    const pass = form?.get("password") ?? "";
    selectedRole = normalizeRole(String(form?.get("selectedRole") || ""));
    email = String(identifier).trim();
    password = String(pass);
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Username or email and password are required." }, { status: 400 });
  }

  if (!email.includes("@")) {
    let username = "";
    try { username = normalizeUsername(email); } catch { /* Same invalid-login response for all unknown identifiers. */ }
    const { data: account } = username ? await adminClient().from("profiles").select("email").eq("username", username).is("deleted_at", null).maybeSingle() : { data: null };
    if (!account?.email) {
      if (contentType.includes("application/json")) return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}&error=invalid&role=${encodeURIComponent(selectedRole)}`, r.url), 303);
    }
    email = account.email;
  }
  const s = await createClient();
  const { data, error } = await s.auth.signInWithPassword({ email, password });

  if (error) {
    if (contentType.includes("application/json")) return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}&error=invalid&role=${encodeURIComponent(selectedRole || "user")}`, r.url), 303);
  }

  const { data: profile, error: profileError } = await s
    .from("profiles")
    .select("role,is_active,name")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    await s.auth.signOut();
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}&error=profile&role=${encodeURIComponent(selectedRole || "user")}`, r.url), 303);
  }

  if (!profile.is_active) {
    await s.auth.signOut();
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}&error=disabled&role=${encodeURIComponent(selectedRole || "user")}`, r.url), 303);
  }

  const role = normalizeRole(profile.role);
  if (!['CONTRACTOR', 'PMC', 'CLIENT', 'ADMIN'].includes(role) || selectedRole !== role) {
    await s.auth.signOut();
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}&error=invalid&role=${encodeURIComponent(selectedRole || "")}`, r.url), 303);
  }
  const dashboardMap: Record<string, string> = {
    CONTRACTOR: "/contractor",
    PMC: "/pmc",
    CLIENT: "/client",
    ADMIN: "/admin",
  };

  const target = next || dashboardMap[role] || "/dashboard";

  if (contentType.includes("application/json")) {
    return NextResponse.json({ ok: true, role, redirect: target });
  }

  return NextResponse.redirect(new URL(target, r.url), 303);
}