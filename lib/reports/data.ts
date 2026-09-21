import type { SupabaseClient } from "@supabase/supabase-js";
export const reportSelection = "*,projects(name,code,address),categories(name),subcategories!inspections_subcategory_id_fkey(name),profiles!inspections_contractor_id_fkey(name,email,role),inspection_subcategories(subcategory_id,subcategories(name)),inspection_revisions(*,profiles!inspection_revisions_submitted_by_fkey(name,role)),reviews(*,profiles!reviews_reviewer_id_fkey(name)),inspection_events(*),inspection_images(*)";
export async function loadReportData(client: SupabaseClient, ids: string[]) {
  const { data, error } = await client.from("inspections").select(reportSelection).in("id", ids).order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load report: ${error.message}`);
  if (!data?.length || data.length !== new Set(ids).size) throw new Error("One or more selected inspections are unavailable or you do not have access to them.");
  return data;
}
