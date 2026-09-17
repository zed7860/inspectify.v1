import {NextResponse} from "next/server";import {requireUser} from "@/lib/auth/guard";import {adminClient} from "@/lib/supabase/admin";

export async function POST(r: Request) {
  await requireUser(["ADMIN", "SUPER_ADMIN"]);
  const f = await r.formData();
  const action = String(f.get("action") || "create");
  const kind = String(f.get("kind") || "");
  const a = adminClient();
  const returnPath = kind === "company" ? "/admin/companies" : ["category", "subcategory"].includes(kind) ? "/admin/categories" : "/admin/master";

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
    await a.from("projects").insert({
      name: String(f.get("name") || ""),
      code: String(f.get("code") || ""),
      address: String(f.get("address") || "")
    });
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
