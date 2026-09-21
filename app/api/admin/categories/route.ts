import { requireUser } from "@/lib/auth/guard";
import { adminClient } from "@/lib/supabase/admin";
import { parseCategoryMapping } from "@/lib/admin/category-mapping";

export async function GET() {
  await requireUser(["ADMIN"]);
  return new Response("Category,Subcategory\r\nCivil,Concrete\r\nCivil,Brickwork\r\nElectrical,Wiring\r\n", { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="category-mapping.csv"' } });
}
export async function POST(request: Request) {
  await requireUser(["ADMIN"]);
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 1024 * 1024) throw new Error("Choose a CSV file up to 1 MB.");
    const mappings = parseCategoryMapping(await file.text());
    const { error } = await adminClient().rpc("import_category_mapping", { p_rows: mappings });
    if (error) throw error;
    return Response.json({ message: `Imported ${mappings.length} mappings. Matching categories and subcategories were updated.`, redirect: "/admin/categories" });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : (error as { message?: string })?.message || "Import failed." }, { status: 400 }); }
}
