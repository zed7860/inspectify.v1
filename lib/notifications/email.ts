import nodemailer from "nodemailer";
import { lookup, setDefaultResultOrder } from "node:dns";
import { adminClient } from "@/lib/supabase/admin";

setDefaultResultOrder("ipv4first");

type InspectionNotice = {
  inspectionId: string;
  title: string;
  message: string;
};

type EmailAttachment = { filename: string; content: Buffer };

export async function sendConfiguredEmail({ to, subject, text, html, attachment, attachments }: { to: string[]; subject: string; text: string; html?: string; attachment?: EmailAttachment; attachments?: EmailAttachment[] }) {
  const admin = adminClient();
  const { data: setting } = await admin.from("app_settings").select("value").eq("key", "smtp").maybeSingle();
  const smtp = setting?.value as Record<string, string> | null;
  if (!smtp?.host || !smtp.user || !smtp.password || !smtp.from) throw new Error("SMTP email settings are not configured by an administrator.");
  const smtpAddress = await new Promise<string>((resolve, reject) => {
    lookup(smtp.host, { family: 4 }, (error, address) => error ? reject(error) : resolve(address));
  });
  const smtpPort = Number(smtp.port || 587);
  const secure = smtpPort === 465 ? true : smtpPort === 587 ? false : String(smtp.secure) === "true";
  const transport = nodemailer.createTransport({
    host: smtpAddress,
    port: smtpPort,
    secure,
    requireTLS: !secure,
    tls: { servername: smtp.host },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    auth: { user: smtp.user, pass: smtp.password },
  });
  const allAttachments = attachments?.length ? attachments : attachment ? [attachment] : undefined;
  await transport.sendMail({ from: smtp.from, to, subject, text, ...(html ? { html } : {}), ...(allAttachments ? { attachments: allAttachments } : {}) });
}

function escapeHtml(value: unknown) {
  return String(value ?? "-").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

function statusColor(status: string) {
  if (status === "FINAL_APPROVED" || status === "CLOSED") return "#16794c";
  if (status.includes("REJECTED")) return "#b42318";
  return "#a15c00";
}

export async function notifyInspectionUsers({ inspectionId, title, message }: InspectionNotice) {
  const admin = adminClient();
  const { data: inspection } = await admin
    .from("inspections")
    .select("*,projects(name,code,address),categories(name),subcategories!inspections_subcategory_id_fkey(name),profiles!inspections_contractor_id_fkey(name,email,role),inspection_subcategories(subcategories(name)),inspection_revisions(revision_no,description,submitted_at,profiles!inspection_revisions_submitted_by_fkey(name,role)),reviews(stage,decision,comments,rejection_reason,reviewed_at,profiles!reviews_reviewer_id_fkey(name,role)),inspection_events(actor_name,actor_role,action,previous_status,new_status,details,created_at),inspection_images(storage_key,original_filename,mime_type,stage,uploaded_at)")
    .eq("id", inspectionId)
    .single();
  if (!inspection) return;

  const { data: assignments } = await admin
    .from("project_users")
    .select("user_id,profiles!project_users_user_id_fkey(id,email,is_active)")
    .eq("project_id", inspection.project_id);
  const recipients = new Map<string, string>();
  for (const assignment of assignments || []) {
    const profile = Array.isArray(assignment.profiles) ? assignment.profiles[0] : assignment.profiles;
    if (profile?.is_active && profile.email) recipients.set(profile.id, profile.email);
  }
  const { data: recipientContractor } = await admin.from("profiles").select("id,email,is_active").eq("id", inspection.contractor_id).single();
  if (recipientContractor?.is_active && recipientContractor.email) recipients.set(recipientContractor.id, recipientContractor.email);
  if (!recipients.size) return;

  await admin.from("notifications").insert([...recipients.keys()].map((userId) => ({ user_id: userId, inspection_id: inspectionId, title, message })));

  const project = Array.isArray(inspection.projects) ? inspection.projects[0] : inspection.projects;
  const category = Array.isArray(inspection.categories) ? inspection.categories[0] : inspection.categories;
  const submitter = Array.isArray(inspection.profiles) ? inspection.profiles[0] : inspection.profiles;
  const subcategoryRows = (inspection.inspection_subcategories || []).map((row: any) => Array.isArray(row.subcategories) ? row.subcategories[0] : row.subcategories).filter(Boolean);
  const subcategories = subcategoryRows.length ? subcategoryRows.map((row: any) => row.name).join(", ") : (Array.isArray(inspection.subcategories) ? inspection.subcategories[0]?.name : inspection.subcategories?.name) || "-";
  const revisions = [...(inspection.inspection_revisions || [])].sort((a: any, b: any) => a.revision_no - b.revision_no);
  const latestRevision = revisions[revisions.length - 1];
  const reviews = [...(inspection.reviews || [])].sort((a: any, b: any) => a.reviewed_at.localeCompare(b.reviewed_at));
  const pending = inspection.status === "PENDING_PMC" || inspection.status === "RESUBMITTED" ? "PMC" : inspection.status === "PENDING_CLIENT" ? "CLIENT" : "-";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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
    `Open inspection: ${appUrl}/inspections/${inspectionId}`,
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
    "Images are attached to this email when available.",
  ];
  const attachments = await Promise.all((inspection.inspection_images || []).slice(-10).map(async (image: any, index: number) => {
    const signed = await admin.storage.from("inspection-evidence").createSignedUrl(image.storage_key, 300);
    if (!signed.data?.signedUrl) return null;
    const response = await fetch(signed.data.signedUrl);
    if (!response.ok) return null;
    return { filename: image.original_filename || `${image.stage.toLowerCase()}-evidence`, content: Buffer.from(await response.arrayBuffer()), cid: `inspection-image-${index}@inspectifier` };
  }));
  const validAttachments = attachments.filter(Boolean) as { filename: string; content: Buffer; cid: string }[];
  const status = String(inspection.status).replaceAll("_", " ");
  const eventRows = (inspection.inspection_events || []).sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)).map((event: any, index: number) => `<tr><td style="width:28px;vertical-align:top"><div style="width:22px;height:22px;border-radius:50%;background:${index === (inspection.inspection_events || []).length - 1 ? "#0f766e" : "#d7e5e3"};color:${index === (inspection.inspection_events || []).length - 1 ? "#fff" : "#31504d"};text-align:center;line-height:22px;font-size:12px;font-weight:700">${index + 1}</div></td><td style="padding:0 0 16px 10px"><strong>${escapeHtml(event.action.replaceAll("_", " "))}</strong><br><span style="color:#667085;font-size:13px">${escapeHtml(event.actor_name)} · ${escapeHtml(event.actor_role)} · ${escapeHtml(formatEmailDate(event.created_at))}</span>${event.details?.comments ? `<br><span style="font-size:13px">${escapeHtml(event.details.comments)}</span>` : ""}</td></tr>`).join("");
  const imageGrid = validAttachments.length ? `<h2 style="font-size:18px;color:#123b3a;margin:28px 0 12px">Evidence photos</h2><div>${validAttachments.map((image) => `<div style="display:inline-block;width:31%;margin:0 1.5% 12px 0;vertical-align:top"><img src="cid:${image.cid}" alt="${escapeHtml(image.filename)}" style="width:100%;height:130px;object-fit:cover;border-radius:8px;border:1px solid #dbe5e3"><div style="font-size:11px;color:#667085;margin-top:4px">${escapeHtml(image.filename)}</div></div>`).join("")}</div>` : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f3f7f6;color:#172b2a;font-family:Arial,Helvetica,sans-serif"><div style="max-width:720px;margin:0 auto;padding:24px 12px"><div style="background:#0d3331;border-radius:14px 14px 0 0;padding:24px 28px;color:#fff"><div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#a7d8cd;font-weight:700">Inspectifier workflow update</div><h1 style="font-size:26px;line-height:1.2;margin:10px 0">${escapeHtml(title)}</h1><span style="display:inline-block;background:${statusColor(String(inspection.status))};color:#fff;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700">${escapeHtml(status)}</span></div><div style="background:#fff;padding:26px 28px;border:1px solid #dbe5e3;border-top:0;border-radius:0 0 14px 14px"><p style="font-size:15px;line-height:1.6;margin-top:0">${escapeHtml(message)}</p><table role="presentation" style="width:100%;border-collapse:collapse;background:#f5faf9;border:1px solid #dbe5e3;border-radius:10px"><tr><td style="padding:14px"><div style="font-size:11px;color:#667085;text-transform:uppercase">Inspection</div><strong>${escapeHtml(inspection.inspection_number)}</strong></td><td style="padding:14px"><div style="font-size:11px;color:#667085;text-transform:uppercase">Pending with</div><strong>${escapeHtml(pending)}</strong></td><td style="padding:14px"><div style="font-size:11px;color:#667085;text-transform:uppercase">Updated</div><strong>${escapeHtml(formatEmailDate(inspection.updated_at))}</strong></td></tr></table><h2 style="font-size:18px;color:#123b3a;margin:28px 0 12px">Inspection details</h2><table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">${emailDetailRow("Project", `${project?.code || "-"} · ${project?.name || "-"}`)}${emailDetailRow("Location", inspection.location)}${emailDetailRow("Category", category?.name)}${emailDetailRow("Subcategories", subcategories)}${emailDetailRow("Submitted by", `${submitter?.name || "-"} · ${submitter?.email || "-"}`)}${emailDetailRow("Submitted at", formatEmailDate(inspection.submitted_at || inspection.created_at))}</table><h2 style="font-size:18px;color:#123b3a;margin:28px 0 12px">Latest description</h2><div style="background:#f8faf9;border-left:4px solid #0f766e;padding:14px 16px;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(latestRevision?.description || "-")}</div><h2 style="font-size:18px;color:#123b3a;margin:28px 0 12px">Approval steps</h2><table role="presentation" style="width:100%;border-collapse:collapse">${eventRows || `<tr><td style="color:#667085;font-size:14px">No workflow steps recorded yet.</td></tr>`}</table>${reviews.length ? `<h2 style="font-size:18px;color:#123b3a;margin:12px 0">Review decisions</h2>${reviews.map((review: any) => `<div style="border:1px solid #dbe5e3;border-radius:8px;padding:13px 15px;margin:0 0 10px"><strong>${escapeHtml(review.stage)} · ${escapeHtml(review.decision)}</strong><div style="font-size:13px;color:#667085;margin-top:4px">${escapeHtml(review.profiles?.name || "-")} · ${escapeHtml(formatEmailDate(review.reviewed_at))}</div><p style="font-size:14px;line-height:1.5;margin:8px 0 0">${escapeHtml(review.comments || "-")}</p>${review.rejection_reason ? `<div style="font-size:13px;color:#b42318;margin-top:6px">Reason: ${escapeHtml(review.rejection_reason)}</div>` : ""}</div>`).join("")}` : ""}${imageGrid}<a href="${escapeHtml(`${appUrl}/inspections/${inspectionId}`)}" style="display:inline-block;margin-top:26px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;padding:12px 18px;font-size:14px;font-weight:700">Open complete inspection</a><p style="border-top:1px solid #e5ebe9;margin:28px 0 0;padding-top:14px;color:#667085;font-size:12px">Inspectifier · Automated workflow notification</p></div></div></body></html>`;
  await sendConfiguredEmail({ to: [...recipients.values()], subject: `${title} · ${inspection.inspection_number}`, text: lines.join("\n"), html, attachments: validAttachments });
}

function formatEmailDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "-";
}

function emailDetailRow(label: string, value: unknown) {
  return `<tr><td style="padding:9px 0;border-bottom:1px solid #edf1f0;color:#667085;width:30%;font-size:12px;text-transform:uppercase">${escapeHtml(label)}</td><td style="padding:9px 0;border-bottom:1px solid #edf1f0;font-size:14px">${escapeHtml(value)}</td></tr>`;
}
