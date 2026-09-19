import {NextResponse} from "next/server";import {requireUser} from "@/lib/auth/guard";import {adminClient} from "@/lib/supabase/admin";

export async function POST(r: Request) {
  await requireUser(["ADMIN"]);
  const f = await r.formData();
  const action = String(f.get("action") || "create");
  const kind = String(f.get("kind") || "");
  const a = adminClient();
  const returnPath = kind === "company" ? "/admin/companies" : ["category", "subcategory"].includes(kind) ? "/admin/categories" : "/admin/master";

  if (kind === "smtp") {
    const actor = await requireUser(["ADMIN"]);
    const value = {
      host: String(f.get("host") || "").trim(),
      port: String(f.get("port") || "587").trim(),
      secure: f.get("secure") === "on",
      user: String(f.get("user") || "").trim(),
      password: String(f.get("password") || ""),
      from: String(f.get("from") || "").trim()
    };
    if (value.host && value.user && value.password && value.from) {
      await a.from("app_settings").upsert({ key: "smtp", value, updated_by: actor.user.id, updated_at: new Date().toISOString() });
    }
    return NextResponse.redirect(new URL("/admin/master", r.url), 303);
  }

  if (action === "delete") {
    const id = String(f.get("id") || "");
    if (!id) return NextResponse.redirect(new URL(returnPath, r.url), 303);

    if (kind === "project") await a.from("projects").delete().eq("id", id);
    if (kind === "company") await a.from("companies").delete().eq("id", id);
    if (kind === "category") await a.from("categories").delete().eq("id", id);
    if (kind === "subcategory") await a.from("subcategories").delete().eq("id", id);

    return NextResponse.redirect(new URL(returnPath, r.url), 303);
  }

  if (action === "update") {
    const id = String(f.get("id") || "");
    if (!id) return NextResponse.redirect(new URL(returnPath, r.url), 303);

    if (kind === "project") {
      await a.from("projects").update({
        name: String(f.get("name") || ""),
        code: String(f.get("code") || ""),
        address: String(f.get("address") || "")
      }).eq("id", id);
    }

    if (kind === "company") {
      await a.from("companies").update({
        name: String(f.get("name") || ""),
        type: String(f.get("type") || "")
      }).eq("id", id);
    }

    if (kind === "category") {
      await a.from("categories").update({ name: String(f.get("name") || "") }).eq("id", id);
    }

    if (kind === "subcategory") {
      await a.from("subcategories").update({
        category_id: String(f.get("categoryId") || ""),
        name: String(f.get("name") || "")
      }).eq("id", id);
    }

    return NextResponse.redirect(new URL(returnPath, r.url), 303);
  }

  if (kind === "project") {
    const { data: project, error } = await a.from("projects").insert({
      name: String(f.get("name") || ""),
      code: String(f.get("code") || ""),
      address: String(f.get("address") || "")
    }).select("id").single();
    if (error || !project) return NextResponse.json({ error: error?.message || "Unable to create project." }, { status: 400 });

    const companyIds = [...new Set(f.getAll("companyIds").map(String).filter(Boolean))];
    if (companyIds.length) {
      await a.from("project_companies").insert(companyIds.map((companyId) => ({ project_id: project.id, company_id: companyId })));
      const { data: companyUsers } = await a.from("profiles").select("id").in("company_id", companyIds).eq("is_active", true);
      if (companyUsers?.length) await a.from("project_users").insert(companyUsers.map((profile) => ({ project_id: project.id, user_id: profile.id })));
    }
  }

  if (kind === "company") {
    await a.from("companies").insert({
      name: String(f.get("name") || ""),
      type: String(f.get("type") || "")
    });
  }

  if (kind === "category") {
    const names = String(f.get("names") || f.get("name") || "")
      .split(/[,\n]/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (names.length) await a.from("categories").insert(names.map((name) => ({ name })));
  }

  if (kind === "subcategory") {
    const categoryId = String(f.get("categoryId") || "");
    const names = String(f.get("names") || f.get("name") || "")
      .split(/[,\n]/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (categoryId && names.length) {
      await a.from("subcategories").insert(names.map((name) => ({ category_id: categoryId, name })));
    }
  }

  return NextResponse.redirect(new URL(returnPath, r.url), 303);
}
