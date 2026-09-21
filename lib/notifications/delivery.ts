import { adminClient } from "@/lib/supabase/admin";
import { EmailDeliveryError } from "@/lib/notifications/smtp";
export async function recordEmailDelivery({ inspectionId, userId, title, message, accepted, rejected, error, requested }: { inspectionId?: string; userId?: string; title: string; message: string; accepted: string[]; rejected: string[]; error?: string; requested?: string[] }) {
  try {
  const {error: logError}=await adminClient().from("audit_logs").insert({user_id:userId||null,action:`${inspectionId?"INSPECTION":"REPORT"}_EMAIL_${error?"FAILED":"SENT"}`,entity_type:inspectionId?"Inspection":"Report",entity_id:inspectionId||null,new_state:{title,message,accepted,rejected,requested:requested||[...accepted,...rejected],error:error||null}});
  if(logError)console.error("Email delivery log failed",logError.message);
  } catch (error) { console.error("Email delivery log unavailable", error); }
}
export function deliveryFailure(error:unknown) {
  return {status:"failed" as const,accepted:error instanceof EmailDeliveryError?error.accepted:[],rejected:error instanceof EmailDeliveryError?error.rejected:[],error:error instanceof Error?error.message:"Email delivery failed. An administrator can retry it from Workflow delivery."};
}
