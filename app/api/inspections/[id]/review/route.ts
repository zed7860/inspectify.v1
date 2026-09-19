import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { notifyInspectionUsers } from "@/lib/notifications/email";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("id", user.id).single();
  if (!profile?.is_active || !["PMC", "CLIENT", "ADMIN"].includes(profile.role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 403 });
  }

  const form = await req.formData();
  const photos = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
  const comments = String(form.get("comments") || "").trim();
  const decision = String(form.get("decision")) === "approve" ? "APPROVED" : "REJECTED";
  const stage = String(form.get("stage"));
  const version = Number(form.get("expectedVersion"));
  if (!comments) return NextResponse.json({ error: "Review comments are required." }, { status: 400 });
  if (photos.some((photo) => !["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 10485760)) return NextResponse.json({ error: "Invalid photo." }, { status: 400 });

  const { data: inspection } = await supabase.from("inspections").select("project_id").eq("id", id).single();
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });

  const admin = adminClient();
  const keys: string[] = [];
  const names: string[] = [];
  const mimes: string[] = [];
  const sizes: number[] = [];
  try {
    for (const photo of photos) {
      const extension = photo.name.split(".").pop() || "jpg";
      const key = `${inspection.project_id}/${id}/${stage.toLowerCase()}/${crypto.randomUUID()}.${extension}`;
      const { error } = await admin.storage.from("inspection-evidence").upload(key, await photo.arrayBuffer(), { contentType: photo.type });
      if (error) throw error;
      keys.push(key); names.push(photo.name); mimes.push(photo.type); sizes.push(photo.size);
    }
    const { error } = await supabase.rpc("review_inspection", { p_inspection: id, p_stage: stage, p_decision: decision, p_comments: comments, p_reason: String(form.get("reason") || ""), p_expected_version: version, p_storage_keys: keys, p_names: names, p_mimes: mimes, p_sizes: sizes });
    if (error) throw error;
    try { await notifyInspectionUsers({ inspectionId: id, title: decision === "APPROVED" ? `${stage} approval recorded` : `${stage} rejection requires action`, message: decision === "APPROVED" ? `The inspection has moved to the next approval level.` : `The inspection was rejected. Review the comments and resubmit corrected evidence.` }); } catch (notificationError) { console.error("Inspection notification failed", notificationError); }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    for (const key of keys) await admin.storage.from("inspection-evidence").remove([key]);
    return NextResponse.json({ error: error?.message || "Review failed" }, { status: 409 });
  }
}
