import { requireUser } from "@/lib/auth/guard";
import { adminClient } from "@/lib/supabase/admin";
import { z } from "zod";
export async function POST(request: Request) {
  await requireUser(["ADMIN"]);
  const form = await request.formData();
  const parsed = z.object({ projectId: z.uuid(), userIds: z.array(z.uuid()).max(5000) }).safeParse({ projectId: form.get("projectId"), userIds: [...new Set(form.getAll("userIds"))] });
  if (!parsed.success) return Response.json({ error: "Invalid project or user selection." }, { status: 400 });
  const { error } = await adminClient().rpc("allocate_project_users", { p_project: parsed.data.projectId, p_users: parsed.data.userIds });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ message: "Project access and email recipients updated." });
}
