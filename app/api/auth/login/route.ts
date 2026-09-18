import {NextResponse} from "next/server";import {createClient} from "@/lib/supabase/server";

function normalizeRole(role: string | null | undefined) {
  if (!role) return "";
  return role.toUpperCase().replace(/\s+/g, "_");
}

export async function POST(r: Request) {
  let email = "";
  let password = "";
  let selectedRole = "";

  const contentType = r.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await r.json().catch(() => ({}));
    email = String(body.email || "");
    password = String(body.password || "");
    selectedRole = normalizeRole(body.role || body.selectedRole);
  } else {
    const form = await r.formData().catch(() => null);
    const identifier = form?.get("identifier") ?? "";
    const pass = form?.get("password") ?? "";
    selectedRole = normalizeRole(String(form?.get("selectedRole") || ""));
    email = String(identifier).trim();
    password = String(pass);
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const s = await createClient();
  const { data, error } = await s.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=invalid&role=${encodeURIComponent(selectedRole || "user")}`, r.url), 303);
  }

  const { data: profile, error: profileError } = await s
    .from("profiles")
    .select("role,is_active,name")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    await s.auth.signOut();
    return NextResponse.redirect(new URL(`/login?error=profile&role=${encodeURIComponent(selectedRole || "user")}`, r.url), 303);
  }

  if (!profile.is_active) {
    await s.auth.signOut();
    return NextResponse.redirect(new URL(`/login?error=disabled&role=${encodeURIComponent(selectedRole || "user")}`, r.url), 303);
  }

  const role = normalizeRole(profile.role);
  if (!['CONTRACTOR', 'PMC', 'CLIENT', 'ADMIN'].includes(role) || selectedRole !== role) {
    await s.auth.signOut();
    return NextResponse.redirect(new URL(`/login?error=invalid&role=${encodeURIComponent(selectedRole || "")}`, r.url), 303);
  }
  const dashboardMap: Record<string, string> = {
    CONTRACTOR: "/contractor",
    PMC: "/pmc",
    CLIENT: "/client",
    ADMIN: "/admin",
  };

  const target = dashboardMap[role] || "/dashboard";

  if (contentType.includes("application/json")) {
    return NextResponse.json({ ok: true, role, redirect: target });
  }

  return NextResponse.redirect(new URL(target, r.url), 303);
}