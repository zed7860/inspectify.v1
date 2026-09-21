import { createClient } from "@/lib/supabase/server";
import { sendConfiguredEmail } from "@/lib/notifications/smtp";
import { parseRecipients } from "@/lib/notifications/recipients";
import { recordEmailDelivery, deliveryFailure } from "@/lib/notifications/delivery";
import { loadReportData } from "@/lib/reports/data";
import { buildInspectionPdf } from "@/lib/reports/pdf";
import { reportPhotoReader } from "@/lib/reports/storage";
import { z } from "zod";
export const maxDuration = 300;
export async function POST(request: Request) {
  let recipients:string[]=[];let userId:string|undefined;
  try {
    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return Response.json({error:"Your session has expired. Please sign in again."},{status:401});
    const {data:profile}=await supabase.from("profiles").select("is_active").eq("id",user.id).single();
    if(!profile?.is_active)return Response.json({error:"This account is disabled."},{status:403});
    userId=user.id;
    const body=await request.json().catch(()=>null);
    const parsed=z.object({ids:z.array(z.uuid()).min(1).max(20),recipients:z.string().min(1).max(10000)}).safeParse(body);
    if(!parsed.success)return Response.json({error:"Select 1–20 inspections and enter valid recipient addresses."},{status:400});
    try{recipients=parseRecipients(parsed.data.recipients);}catch(error){return Response.json({error:(error as Error).message},{status:400});}
    const inspections=await loadReportData(supabase,[...new Set(parsed.data.ids)]);
    const pdf=await buildInspectionPdf(inspections,reportPhotoReader());
    const result=await sendConfiguredEmail({to:recipients,subject:`Inspectifier report | ${inspections.length} inspection(s)`,text:`Attached is the inspection report, including submission history, review decisions, photos and activity timeline.\n\nInspections: ${inspections.map((row:any)=>row.inspection_number).join(", ")}`,attachment:{filename:"inspection-report.pdf",content:pdf}});
    await recordEmailDelivery({userId,title:"Inspection report",message:"Report requested from Reports",...result,requested:recipients});
    return Response.json({ok:true,message:`Report accepted by the mail server for all ${result.accepted.length} recipient(s).`,...result});
  } catch(error){
    const failure=deliveryFailure(error);
    if(userId)await recordEmailDelivery({userId,title:"Inspection report",message:"Report requested from Reports",...failure,requested:recipients});
    return Response.json({error:failure.error,accepted:failure.accepted,rejected:failure.rejected},{status:502});
  }
}
