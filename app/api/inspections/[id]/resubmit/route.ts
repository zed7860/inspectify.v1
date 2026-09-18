import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

const validPhoto = (file: File) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 10 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("id", user.id).single();
  if (!profile?.is_active || profile.role !== "CONTRACTOR") return NextResponse.json({ error: "Only the submitting contractor can resubmit." }, { status: 403 });

  const form = await request.formData();
  const description = String(form.get("description") || "").trim();
  const photos = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
  if (description.length < 3) return NextResponse.json({ error: "A description is required." }, { status: 400 });
  if (!photos.length || photos.some((photo) => !validPhoto(photo))) return NextResponse.json({ error: "Add at least one valid photo." }, { status: 400 });

  const admin = adminClient();
  const keys: string[] = [];
  const names: string[] = [];
  const mimes: string[] = [];
  const sizes: number[] = [];
  const { data: inspection } = await supabase.from("inspections").select("project_id").eq("id", id).single();
  if (!inspection) return NextResponse.json({ error: "Inspection not found." }, { status: 404 });

  try {
    for (const photo of photos) {
      const extension = photo.name.split(".").pop() || "jpg";
      const key = `${inspection.project_id}/${id}/contractor/${crypto.randomUUID()}.${extension}`;
      const { error } = await admin.storage.from("inspection-evidence").upload(key, await photo.arrayBuffer(), { contentType: photo.type });
      if (error) throw error;
      keys.push(key); names.push(photo.name); mimes.push(photo.type); sizes.push(photo.size);
    }
    const { error } = await supabase.rpc("resubmit_inspection", { p_inspection: id, p_description: description, p_storage_keys: keys, p_names: names, p_mimes: mimes, p_sizes: sizes });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    for (const key of keys) await admin.storage.from("inspection-evidence").remove([key]);
    return NextResponse.json({ error: error?.message || "Resubmission failed." }, { status: 409 });
  }
}
