import { requireUser } from "@/lib/auth/guard";
import { adminClient } from "@/lib/supabase/admin";
export async function POST(request: Request) {
  const user = await requireUser();
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  if (!name || name.length > 100) return Response.json({ error: "Enter a name between 1 and 100 characters." }, { status: 400 });
  // Identity comes only from the session; role, email and other submitted fields are ignored.
  const { error } = await adminClient().from("profiles").update({ name }).eq("id", user.user.id).eq("is_active", true).is("deleted_at", null).select("id").single();
  if (error) return Response.json({ error: "Unable to update your name. Please try again." }, { status: 400 });
  return Response.json({ message: "Your name was updated successfully.", redirect: "/profile" });
}
