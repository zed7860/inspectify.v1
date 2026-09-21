import { publicAppUrl } from "@/lib/notifications/app-url";
import sharp from "sharp";
import { adminClient } from "@/lib/supabase/admin";
import { sendConfiguredEmail } from "@/lib/notifications/smtp";
import { recordEmailDelivery, deliveryFailure } from "@/lib/notifications/delivery";
import { loadReportData } from "@/lib/reports/data";
import { buildInspectionPdf } from "@/lib/reports/pdf";
import { reportPhotoReader } from "@/lib/reports/storage";
export { sendConfiguredEmail } from "@/lib/notifications/smtp";
type InspectionNotice = { inspectionId: string; title: string; message: string; recipientFilter?: string[] };

function escapeHtml(value: unknown) {
  return String(value ?? "-").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

function statusColor(status: string) {
  if (status === "FINAL_APPROVED" || status === "CLOSED") return "#16794c";
  if (status.includes("REJECTED")) return "#b42318";
  return "#a15c00";
}

async function deliverInspectionEmail({ inspectionId, title, message, recipientFilter }: InspectionNotice) {
  const admin = adminClient();
  const [inspection] = await loadReportData(admin, [inspectionId]);
  const { data: assignments, error: assignmentError } = await admin
    .from("project_users")
    .select("user_id,profiles!project_users_user_id_fkey(id,email,is_active)")
    .eq("project_id", inspection.project_id);
  if (assignmentError) throw new Error(`Unable to load assigned recipients: ${assignmentError.message}`);
  const recipients = new Map<string, string>();
  for (const assignment of assignments || []) {
    const profile = Array.isArray(assignment.profiles) ? assignment.profiles[0] : assignment.profiles;
    if (profile?.is_active && profile.email) recipients.set(profile.id, profile.email);
  }
  const { data: recipientContractor, error: contractorError } = await admin.from("profiles").select("id,email,is_active").eq("id", inspection.contractor_id).single();
  if (contractorError) throw new Error("Unable to load the inspection submitter.");
  if (recipientContractor?.is_active && recipientContractor.email) recipients.set(recipientContractor.id, recipientContractor.email);
  if (recipientFilter) for (const [id, email] of recipients) if (!recipientFilter.includes(email.toLowerCase())) recipients.delete(id);
  if (!recipients.size) throw new Error("No active assigned users are available to receive this inspection email.");

  if (!recipientFilter) await admin.from("notifications").insert([...recipients.keys()].map((userId) => ({ user_id: userId, inspection_id: inspectionId, title, message })));

  const project = Array.isArray(inspection.projects) ? inspection.projects[0] : inspection.projects;
  const category = Array.isArray(inspection.categories) ? inspection.categories[0] : inspection.categories;
  const submitter = Array.isArray(inspection.profiles) ? inspection.profiles[0] : inspection.profiles;
  const subcategoryRows = (inspection.inspection_subcategories || []).map((row: any) => Array.isArray(row.subcategories) ? row.subcategories[0] : row.subcategories).filter(Boolean);
  const subcategories = subcategoryRows.length ? subcategoryRows.map((row: any) => row.name).join(", ") : (Array.isArray(inspection.subcategories) ? inspection.subcategories[0]?.name : inspection.subcategories?.name) || "-";
  const revisions = [...(inspection.inspection_revisions || [])].sort((a: any, b: any) => a.revision_no - b.revision_no);
  const latestRevision = revisions[revisions.length - 1];
  const reviews = [...(inspection.reviews || [])].sort((a: any, b: any) => a.reviewed_at.localeCompare(b.reviewed_at));
  const pending = inspection.status === "PENDING_PMC" || inspection.status === "RESUBMITTED" ? "PMC" : inspection.status === "PENDING_CLIENT" ? "CLIENT" : String(inspection.status).includes("REJECTED") ? "CONTRACTOR" : "Complete";
  const { data: website } = await admin.from("app_settings").select("value").eq("key", "public_app_url").maybeSingle();
  let appUrl = "";
  try { appUrl = publicAppUrl(String(website?.value?.url || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : ""))); } catch { /* Email reports remain deliverable before a public domain is configured. */ }
  const lines = [
    "INSPECTIFIER INSPECTION WORKFLOW UPDATE",
    "=======================================",
    "",
    title,
    message,
    "",
    "INSPECTION DETAILS",
    `Inspection number: ${inspection.inspection_number}`,
    `Current status: ${String(inspection.status).replaceAll("_", " ")}`,
    `Pending with: ${pending}`,
    `Project: ${project?.code || "-"} - ${project?.name || "-"}`,
    `Project address: ${project?.address || "-"}`,
    `Location / area: ${inspection.location || "-"}`,
    `Category: ${category?.name || "-"}`,
    `Subcategories: ${subcategories}`,
    `Submitted by: ${submitter?.name || "-"} (${submitter?.email || "-"})`,
    `Submitted at: ${inspection.submitted_at || inspection.created_at || "-"}`,
    `Last updated: ${inspection.updated_at || "-"}`,
    appUrl ? `Open inspection: ${appUrl}/inspections/${inspectionId}` : "Sign in to your workspace and search for this inspection number. A public website link has not been configured yet.",
    "",
    "LATEST DESCRIPTION",
    latestRevision?.description || "-",
    "",
    "APPROVAL WORKFLOW",
    ...(inspection.inspection_events || []).sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)).map((event: any) => `${event.created_at} | ${event.action.replaceAll("_", " ")} | ${event.actor_name} (${event.actor_role}) | ${event.previous_status || "-"} -> ${event.new_status || "-"}`),
    "",
    "REVIEW DETAILS",
    ...(reviews.length ? reviews.map((review: any) => `${review.reviewed_at} | ${review.stage} | ${review.decision} | ${review.profiles?.name || "-"} (${review.profiles?.role || "-"})\nComments: ${review.comments || "-"}\nReason: ${review.rejection_reason || "-"}`) : ["No reviews recorded yet."]),
    "",
    `Revisions recorded: ${revisions.length}`,
    "The complete PDF report is attached, including submission history, review decisions, evidence photos and the activity timeline.",
  ];
  const readPhoto = reportPhotoReader();
  const pdf = await buildInspectionPdf([inspection], readPhoto);
  const attachments = await Promise.all((inspection.inspection_images || []).slice(-6).map(async (image: any, index: number) => {
    try {
      const content = await sharp(await readPhoto(image.storage_key)).rotate().resize({width:700,height:500,fit:"inside",withoutEnlargement:true}).jpeg({quality:65}).toBuffer();
      return { filename: `evidence-${index+1}.jpg`, content, cid: `inspection-image-${index}@inspectifier` };
    } catch { return null; }
  }));
  const validAttachments = attachments.filter(Boolean) as { filename: string; content: Buffer; cid: string }[];
  const status = String(inspection.status).replaceAll("_", " ");
  const eventRows = (inspection.inspection_events || []).sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)).map((event: any, index: number) => `<tr><td style="width:28px;vertical-align:top"><div style="width:22px;height:22px;border-radius:50%;background:${index === (inspection.inspection_events || []).length - 1 ? "#0f766e" : "#d7e5e3"};color:${index === (inspection.inspection_events || []).length - 1 ? "#fff" : "#31504d"};text-align:center;line-height:22px;font-size:12px;font-weight:700">${index + 1}</div></td><td style="padding:0 0 16px 10px"><strong>${escapeHtml(event.action.replaceAll("_", " "))}</strong><br><span style="color:#667085;font-size:13px">${escapeHtml(event.actor_name)} · ${escapeHtml(event.actor_role)} · ${escapeHtml(formatEmailDate(event.created_at))}</span>${event.details?.comments ? `<br><span style="font-size:13px">${escapeHtml(event.details.comments)}</span>` : ""}</td></tr>`).join("");
  const imageGrid = validAttachments.length ? `<h2 style="font-size:18px;color:#123b3a;margin:28px 0 12px">Evidence photos</h2><div>${validAttachments.map((image) => `<div style="display:inline-block;width:31%;margin:0 1.5% 12px 0;vertical-align:top"><img src="cid:${image.cid}" alt="${escapeHtml(image.filename)}" style="width:100%;height:130px;object-fit:cover;border-radius:8px;border:1px solid #dbe5e3"><div style="font-size:11px;color:#667085;margin-top:4px">${escapeHtml(image.filename)}</div></div>`).join("")}</div>` : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f3f7f6;color:#172b2a;font-family:Arial,Helvetica,sans-serif"><div style="max-width:720px;margin:0 auto;padding:24px 12px"><div style="background:#0d3331;border-radius:14px 14px 0 0;padding:24px 28px;color:#fff"><div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#a7d8cd;font-weight:700">Inspectifier workflow update</div><h1 style="font-size:26px;line-height:1.2;margin:10px 0">${escapeHtml(title)}</h1><span style="display:inline-block;background:${statusColor(String(inspection.status))};color:#fff;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700">${escapeHtml(status)}</span></div><div style="background:#fff;padding:26px 28px;border:1px solid #dbe5e3;border-top:0;border-radius:0 0 14px 14px"><p style="font-size:15px;line-height:1.6;margin-top:0">${escapeHtml(message)}</p><table role="presentation" style="width:100%;border-collapse:collapse;background:#f5faf9;border:1px solid #dbe5e3;border-radius:10px"><tr><td style="padding:14px"><div style="font-size:11px;color:#667085;text-transform:uppercase">Inspection</div><strong>${escapeHtml(inspection.inspection_number)}</strong></td><td style="padding:14px"><div style="font-size:11px;color:#667085;text-transform:uppercase">Pending with</div><strong>${escapeHtml(pending)}</strong></td><td style="padding:14px"><div style="font-size:11px;color:#667085;text-transform:uppercase">Updated</div><strong>${escapeHtml(formatEmailDate(inspection.updated_at))}</strong></td></tr></table><h2 style="font-size:18px;color:#123b3a;margin:28px 0 12px">Inspection details</h2><table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">${emailDetailRow("Project", `${project?.code || "-"} · ${project?.name || "-"}`)}${emailDetailRow("Location", inspection.location)}${emailDetailRow("Category", category?.name)}${emailDetailRow("Subcategories", subcategories)}${emailDetailRow("Submitted by", `${submitter?.name || "-"} · ${submitter?.email || "-"}`)}${emailDetailRow("Submitted at", formatEmailDate(inspection.submitted_at || inspection.created_at))}</table><h2 style="font-size:18px;color:#123b3a;margin:28px 0 12px">Latest description</h2><div style="background:#f8faf9;border-left:4px solid #0f766e;padding:14px 16px;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(latestRevision?.description || "-")}</div><h2 style="font-size:18px;color:#123b3a;margin:28px 0 12px">Approval steps</h2><table role="presentation" style="width:100%;border-collapse:collapse">${eventRows || `<tr><td style="color:#667085;font-size:14px">No workflow steps recorded yet.</td></tr>`}</table>${reviews.length ? `<h2 style="font-size:18px;color:#123b3a;margin:12px 0">Review decisions</h2>${reviews.map((review: any) => `<div style="border:1px solid #dbe5e3;border-radius:8px;padding:13px 15px;margin:0 0 10px"><strong>${escapeHtml(review.stage)} · ${escapeHtml(review.decision)}</strong><div style="font-size:13px;color:#667085;margin-top:4px">${escapeHtml(review.profiles?.name || "-")} · ${escapeHtml(formatEmailDate(review.reviewed_at))}</div><p style="font-size:14px;line-height:1.5;margin:8px 0 0">${escapeHtml(review.comments || "-")}</p>${review.rejection_reason ? `<div style="font-size:13px;color:#b42318;margin-top:6px">Reason: ${escapeHtml(review.rejection_reason)}</div>` : ""}</div>`).join("")}` : ""}${imageGrid}<p style="background:#f5faf9;border:1px solid #dbe5e3;padding:14px 16px;font-size:13px;line-height:1.6"><strong>PDF report attached</strong><br>The complete inspection report includes submission history, review decisions, evidence photos and the activity timeline.</p>${appUrl ? `<a href="${escapeHtml(`${appUrl}/inspections/${inspectionId}`)}" style="display:inline-block;margin-top:26px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;padding:12px 18px;font-size:14px;font-weight:700">Open complete inspection</a>` : `<p style="color:#667085;font-size:13px">Open your workspace and search for ${escapeHtml(inspection.inspection_number)}. The complete report is attached.</p>`}<p style="border-top:1px solid #e5ebe9;margin:28px 0 0;padding-top:14px;color:#667085;font-size:12px">Inspectifier · Automated workflow notification</p></div></div></body></html>`;
  return await sendConfiguredEmail({ to: [...recipients.values()], subject: `${title} · ${inspection.inspection_number}`, text: lines.join("\n"), html, attachments: [{ filename: `${inspection.inspection_number}-report.pdf`, content: pdf }, ...validAttachments] });
}

export async function notifyInspectionUsers(notice: InspectionNotice) {
  try {
    const result = await deliverInspectionEmail(notice);
    await recordEmailDelivery({ ...notice, accepted: result.accepted, rejected: result.rejected });
    return { status: "sent" as const, ...result };
  } catch (error) {
    const result = deliveryFailure(error);
    await recordEmailDelivery({ ...notice, ...result });
    return result;
  }
}

function formatEmailDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "-";
}

function emailDetailRow(label: string, value: unknown) {
  return `<tr><td style="padding:9px 0;border-bottom:1px solid #edf1f0;color:#667085;width:30%;font-size:12px;text-transform:uppercase">${escapeHtml(label)}</td><td style="padding:9px 0;border-bottom:1px solid #edf1f0;font-size:14px">${escapeHtml(value)}</td></tr>`;
}
