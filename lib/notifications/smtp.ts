import nodemailer from "nodemailer";
import { adminClient } from "@/lib/supabase/admin";
import { parseRecipients } from "@/lib/notifications/recipients";
export type EmailAttachment = { filename: string; content: Buffer; cid?: string };
export class EmailDeliveryError extends Error {
  constructor(message: string, public accepted: string[] = [], public rejected: string[] = []) { super(message); this.name="EmailDeliveryError"; }
}
export async function sendConfiguredEmail({ to, subject, text, html, attachment, attachments }: { to: string[]; subject: string; text: string; html?: string; attachment?: EmailAttachment; attachments?: EmailAttachment[] }) {
  const recipients=parseRecipients(to,1000);
  const { data: setting, error } = await adminClient().from("app_settings").select("value").eq("key", "smtp").maybeSingle();
  if(error)throw new EmailDeliveryError("Unable to load SMTP settings.",[],recipients);
  const smtp=setting?.value;
  if(!smtp?.host||!smtp?.user||!smtp?.password||!smtp?.from)throw new EmailDeliveryError("SMTP settings are incomplete. Ask an administrator to configure Workflow delivery.",[],recipients);
  const files=attachments?.length?attachments:attachment?[attachment]:[];
  if(files.reduce((size,file)=>size+file.content.byteLength,0)>18*1024*1024)throw new EmailDeliveryError("The report is too large to email. Select fewer inspections and try again.",[],recipients);
  const port=Number(smtp.port||587);
  const transport=nodemailer.createTransport({host:smtp.host,port,secure:port===465,requireTLS:port!==465,auth:{user:smtp.user,pass:smtp.password},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:60000});
  try {
    const info:any=await transport.sendMail({from:smtp.from,to:recipients,subject,text,...(html?{html}:{}),attachments:files});
    const address=(item:any)=>String(typeof item==="string"?item:item.address).toLowerCase();
    const accepted=(info.accepted||[]).map(address);
    const rejected=recipients.filter(email=>!accepted.includes(email));
    if(rejected.length)throw new EmailDeliveryError(`The mail server accepted ${accepted.length} recipient(s), but rejected ${rejected.length}. Retry only the failed recipients.`,accepted,rejected);
    return {accepted,rejected,messageId:String(info.messageId||"")};
  } catch(error:any) {
    if(error instanceof EmailDeliveryError)throw error;
    const message=error.code==="EAUTH"?"SMTP authentication failed. Update the mail account password or app password in Workflow delivery.":error.code==="ETIMEDOUT"?"The SMTP server timed out. Delivery is unconfirmed; check the recipients before retrying.":error.message||"Unable to send email.";
    throw new EmailDeliveryError(message,[],recipients);
  } finally { transport.close(); }
}
