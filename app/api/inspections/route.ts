import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { notifyInspectionUsers } from "@/lib/notifications/email";

const validPhoto = (file: File) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 10 * 1024 * 1024;

export const maxDuration = 300;

export async function POST(req: Request) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("id", user.id).single();
	if (profile?.role !== "CONTRACTOR" || !profile.is_active) return NextResponse.json({ error: "Only Contractor can create inspections." }, { status: 403 });

	const form = await req.formData();
	const project = String(form.get("projectId") || "");
	const category = String(form.get("categoryId") || "");
	const subcategories = [...new Set(form.getAll("subcategoryIds").map(String).filter(Boolean))];
	const photoEntries = subcategories.flatMap((subcategoryId) => form.getAll(`photos_${subcategoryId}`).filter((value): value is File => value instanceof File && value.size > 0).map((file) => ({ file, subcategoryId })));
	const photos = photoEntries.map((entry) => entry.file);
	const location = String(form.get("location") || "").trim();
	const description = String(form.get("description") || "").trim();
	if (!photos.length || photos.some((photo) => !validPhoto(photo))) return NextResponse.json({ error: "Add at least one valid photo for each selected subcategory." }, { status: 400 });
	if (subcategories.some((subcategoryId) => !photoEntries.some((entry) => entry.subcategoryId === subcategoryId))) return NextResponse.json({ error: "Add evidence for every selected subcategory." }, { status: 400 });
	if (!project || !category || !subcategories.length || !location || !description) return NextResponse.json({ error: "All fields are mandatory." }, { status: 400 });

  const { data: assignment } = await supabase.from("project_users").select("project_id").eq("project_id", project).eq("user_id", user.id).maybeSingle();
  if (!assignment) return NextResponse.json({ error: "This project is not allocated to your account." }, { status: 403 });
  const { data: mapped } = await supabase.from("subcategories").select("id").eq("category_id", category).eq("is_active", true).in("id", subcategories);
  if (mapped?.length !== subcategories.length) return NextResponse.json({ error: "Select valid subcategories from the chosen category." }, { status: 400 });
	const admin = adminClient();
	const keys: string[] = [], names: string[] = [], mimes: string[] = [], sizes: number[] = [];
	let committed = false;
  try {
		const imageSubcategories: string[] = [];
		for (const { file: photo, subcategoryId } of photoEntries) {
			const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
			const key = `${project}/pending/${user.id}/${crypto.randomUUID()}.${extension}`;
			const { error } = await admin.storage.from("inspection-evidence").upload(key, await photo.arrayBuffer(), { contentType: photo.type, upsert: false });
			if (error) throw error;
			keys.push(key); names.push(photo.name); mimes.push(photo.type); sizes.push(photo.size);
			imageSubcategories.push(subcategoryId);
		}
		const { data, error } = await supabase.rpc("submit_inspection", { p_project: project, p_category: category, p_subcategories: subcategories, p_location: location, p_description: description, p_storage_keys: keys, p_names: names, p_mimes: mimes, p_sizes: sizes, p_image_subcategories: imageSubcategories });
		if (error) throw error;
		committed = true;
    const delivery = await notifyInspectionUsers({ inspectionId: data, title: "Inspection submitted", message: "A new inspection is awaiting PMC review." });
		return NextResponse.json({ id: data, delivery });
	} catch (error: any) {
		if (!committed) for (const key of keys) await admin.storage.from("inspection-evidence").remove([key]);
		return NextResponse.json({ error: error?.message || "Unable to submit inspection." }, { status: 400 });
	}
}
