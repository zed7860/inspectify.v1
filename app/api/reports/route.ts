import { requireUser } from "@/lib/auth/guard";
import { loadReportData } from "@/lib/reports/data";
import { buildInspectionPdf } from "@/lib/reports/pdf";
import { reportPhotoReader } from "@/lib/reports/storage";
import { z } from "zod";
export const maxDuration = 300;
export async function GET(request: Request) {
  const user = await requireUser();
  try {
    const params = new URL(request.url).searchParams;
    let ids = [...new Set((params.get("ids") || "").split(",").filter(Boolean))];
    if(ids.some(id=>!z.uuid().safeParse(id).success))throw new Error("Invalid inspection selection.");
    if(!ids.length){
      let query=user.supabase.from("inspections").select("id").order("created_at",{ascending:false}).limit(21);
      if(params.get("projectId"))query=query.eq("project_id",params.get("projectId")!);
      if(params.get("from"))query=query.gte("created_at",new Date(params.get("from")!).toISOString());
      if(params.get("to")){const end=new Date(params.get("to")!);end.setUTCDate(end.getUTCDate()+1);query=query.lt("created_at",end.toISOString());}
      const {data,error}=await query;if(error)throw error;ids=(data||[]).map(row=>row.id);
    }
    if(!ids.length||ids.length>20)throw new Error("Select between 1 and 20 inspections per report.");
    const inspections=await loadReportData(user.supabase,ids);
    const pdf=await buildInspectionPdf(inspections,reportPhotoReader());
    return new Response(new Uint8Array(pdf),{headers:{"content-type":"application/pdf","content-disposition":"attachment; filename=inspection-report.pdf"}});
  } catch(error){return Response.json({error:(error as Error).message||"Unable to generate report."},{status:400});}
}
