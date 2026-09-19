import { NextResponse } from "next/server";
import { PDFDocument, PDFPage, PDFFont, RGB, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";
import { requireUser } from "@/lib/auth/guard";
import { adminClient } from "@/lib/supabase/admin";
import { formatIST } from "@/lib/timezone";

type Ctx = { pdf: PDFDocument; page: PDFPage; y: number; regular: PDFFont; bold: PDFFont; inspectionNo: string; status: string };
const navy = rgb(0.08, 0.19, 0.29);
const green = rgb(0.08, 0.52, 0.32);
const red = rgb(0.78, 0.17, 0.25);
const gray = rgb(0.94, 0.96, 0.97);
const muted = rgb(0.37, 0.43, 0.48);

function value(item: any) { return Array.isArray(item) ? item[0] : item; }
function text(valueToDraw: unknown) { return String(valueToDraw ?? "-"); }

function header(ctx: Ctx, title: string) {
  ctx.page.drawRectangle({ x: 18, y: 535, width: 806, height: 44, color: navy });
  ctx.page.drawRectangle({ x: 604, y: 535, width: 220, height: 44, color: ctx.status === "FINAL_APPROVED" ? green : ctx.status.includes("REJECTED") ? red : rgb(0.86, 0.62, 0.12) });
  ctx.page.drawText("INSPECTIFIER", { x: 38, y: 550, size: 10, font: ctx.bold, color: rgb(1, 1, 1) });
  ctx.page.drawText(ctx.status.replaceAll("_", " "), { x: 620, y: 550, size: 10, font: ctx.bold, color: rgb(1, 1, 1) });
  ctx.page.drawText(title, { x: 36, y: 494, size: 24, font: ctx.bold, color: navy });
  ctx.page.drawText(`Inspectifier by Cubixtop India | Inspection ${ctx.inspectionNo}`, { x: 36, y: 22, size: 7, font: ctx.regular, color: muted });
  ctx.y = 468;
}

function newPage(ctx: Ctx, title: string) {
  ctx.page = ctx.pdf.addPage([842, 595]);
  header(ctx, title);
}

function ensure(ctx: Ctx, height = 30, title = "Inspection Report") {
  if (ctx.y < height) newPage(ctx, title);
}

function drawText(ctx: Ctx, content: unknown, x = 36, size = 8, bold = false, color = rgb(0.1, 0.13, 0.16)) {
  ensure(ctx, 38);
  ctx.page.drawText(text(content).slice(0, 150), { x, y: ctx.y, size, font: bold ? ctx.bold : ctx.regular, color });
  ctx.y -= size + 5;
}

function heading(ctx: Ctx, content: string) {
  ensure(ctx, 60);
  ctx.page.drawText(content, { x: 36, y: ctx.y, size: 12, font: ctx.bold, color: navy });
  ctx.y -= 20;
}

function wrap(ctx: Ctx, content: unknown, x = 36, width = 112, size = 8, color = rgb(0.1, 0.13, 0.16)) {
  const words = text(content).split(/\s+/);
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > width) { drawText(ctx, current, x, size, false, color); current = word; } else current = `${current} ${word}`.trim();
  }
  if (current) drawText(ctx, current, x, size, false, color);
}

function card(ctx: Ctx, items: Array<[string, unknown]>, columns = 3) {
  const width = 806 / columns;
  const rows = Math.ceil(items.length / columns);
  const height = rows * 54;
  ensure(ctx, height + 20);
  ctx.page.drawRectangle({ x: 18, y: ctx.y - height + 12, width: 806, height, color: gray, borderColor: rgb(0.83, 0.87, 0.89), borderWidth: 0.7 });
  items.forEach(([label, content], index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 36 + column * width;
    const y = ctx.y - row * 54;
    ctx.page.drawText(label, { x, y, size: 8, font: ctx.bold, color: navy });
    ctx.page.drawText(text(content).slice(0, 35), { x, y: y - 17, size: 9, font: ctx.regular, color: rgb(0.12, 0.14, 0.16) });
  });
  ctx.y -= height + 14;
}

function table(ctx: Ctx, columns: Array<[string, number]>, rows: string[][]) {
  const rowHeight = 25;
  const height = rowHeight * (rows.length + 1);
  ensure(ctx, height + 20);
  let x = 18;
  columns.forEach(([label, width]) => { ctx.page.drawRectangle({ x, y: ctx.y - rowHeight, width, height: rowHeight, color: navy }); ctx.page.drawText(label, { x: x + 7, y: ctx.y - 16, size: 7, font: ctx.bold, color: rgb(1, 1, 1) }); x += width; });
  rows.forEach((row, rowIndex) => { let cellX = 18; const y = ctx.y - rowHeight * (rowIndex + 2); row.forEach((cell, index) => { const width = columns[index][1]; ctx.page.drawRectangle({ x: cellX, y, width, height: rowHeight, color: rowIndex % 2 ? rgb(1, 1, 1) : gray, borderColor: rgb(0.84, 0.87, 0.89), borderWidth: 0.5 }); ctx.page.drawText(text(cell).slice(0, Math.floor(width / 5)), { x: cellX + 7, y: y + 9, size: 7, font: ctx.regular, color: cell.includes("REJECTED") ? red : cell.includes("APPROVED") ? green : rgb(0.1, 0.13, 0.16) }); cellX += width; }); });
  ctx.y -= height + 16;
}

async function downloadImages(imageRows: any[]) {
  const storage = adminClient();
  return Promise.all(imageRows.map(async (image) => ({ ...image, url: (await storage.storage.from("inspection-evidence").createSignedUrl(image.storage_key, 900)).data?.signedUrl })));
}

async function photo(ctx: Ctx, image: any) {
  if (!image.url) return;
  try {
    const source = await fetch(image.url).then((response) => response.arrayBuffer());
    const png = image.mime_type === "image/webp" ? await sharp(source).png().toBuffer() : Buffer.from(source);
    const embedded = image.mime_type === "image/png" || image.mime_type === "image/webp" ? await ctx.pdf.embedPng(png) : await ctx.pdf.embedJpg(png);
    ensure(ctx, 175, "Revision & Audit Trail");
    const scale = Math.min(235 / embedded.width, 120 / embedded.height);
    ctx.page.drawRectangle({ x: 18, y: ctx.y - 138, width: 806, height: 138, color: rgb(1, 1, 1), borderColor: rgb(0.84, 0.87, 0.89), borderWidth: 0.7 });
    ctx.page.drawImage(embedded, { x: 30, y: ctx.y - 128, width: embedded.width * scale, height: embedded.height * scale });
    ctx.page.drawText(`${image.stage} | ${image.original_filename}`, { x: 290, y: ctx.y - 22, size: 8, font: ctx.bold, color: navy });
    ctx.page.drawText(`Uploaded: ${formatIST(image.uploaded_at)}`, { x: 290, y: ctx.y - 38, size: 7, font: ctx.regular, color: muted });
    ctx.y -= 150;
  } catch { drawText(ctx, `${image.stage} | ${image.original_filename} (photo unavailable)`, 36, 8, false, muted); }
}

export async function GET(request: Request) {
  const user = await requireUser();
  const params = new URL(request.url).searchParams;
  const selectedIds = (params.get("ids") || "").split(",").filter(Boolean);
  let query = user.supabase.from("inspections").select("id,inspection_number,location,status,created_at,updated_at,submitted_at,projects(name,code),categories(name),subcategories!inspections_subcategory_id_fkey(name),profiles!inspections_contractor_id_fkey(name,email),inspection_revisions(*),reviews(*,profiles!reviews_reviewer_id_fkey(name)),inspection_events(*)").order("created_at", { ascending: false });
  if (params.get("projectId")) query = query.eq("project_id", params.get("projectId")!);
  if (params.get("from")) query = query.gte("created_at", `${params.get("from")}T00:00:00.000Z`);
  if (params.get("to")) { const end = new Date(`${params.get("to")}T00:00:00.000Z`); end.setUTCDate(end.getUTCDate() + 1); query = query.lt("created_at", end.toISOString()); }
  if (selectedIds.length) query = query.in("id", selectedIds);
  const { data: inspections } = await query;
  const ids = (inspections || []).map((inspection: any) => inspection.id);
  const { data: imageRows } = ids.length ? await user.supabase.from("inspection_images").select("inspection_id,revision_id,storage_key,original_filename,mime_type,stage,uploaded_at").in("inspection_id", ids).order("uploaded_at") : { data: [] };
  const images = await downloadImages(imageRows || []);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const inspection of inspections || []) {
    const project = value(inspection.projects); const category = value(inspection.categories); const subcategory = value(inspection.subcategories); const submitter = value(inspection.profiles);
    const ctx: Ctx = { pdf, page: pdf.addPage([842, 595]), y: 0, regular, bold, inspectionNo: inspection.inspection_number, status: inspection.status };
    header(ctx, "Inspection Report");
    ctx.page.drawText("Clear inspection record, revision trail, evidence and approval workflow", { x: 36, y: 468, size: 9, font: regular, color: muted }); ctx.y = 442;
    card(ctx, [["Inspection No.", inspection.inspection_number], ["Project", `${project?.code || ""} ${project?.name || ""}`], ["Location", inspection.location], ["Category / Item", `${category?.name || "-"} / ${subcategory?.name || "-"}`], ["Submitted by", `${submitter?.name || "-"} (${submitter?.role || "Contractor"})`], ["Current Revision", `Revision ${String((inspection.inspection_revisions || []).length).padStart(2, "0")}`]]);
    ctx.page.drawRectangle({ x: 18, y: ctx.y - 45, width: 806, height: 45, color: rgb(0.9, 0.97, 0.93), borderColor: rgb(0.65, 0.82, 0.72), borderWidth: 0.7 });
    ctx.page.drawText("Final outcome", { x: 36, y: ctx.y - 18, size: 9, font: bold, color: navy });
    ctx.page.drawText(inspection.status === "FINAL_APPROVED" ? "Approved after the complete PMC and Client workflow." : `Current status: ${inspection.status.replaceAll("_", " ")}`, { x: 150, y: ctx.y - 18, size: 8, font: regular });
    ctx.page.drawText(`Updated ${formatIST(inspection.updated_at)}`, { x: 620, y: ctx.y - 18, size: 7, font: regular }); ctx.y -= 62;
    heading(ctx, "1. Inspection Details");
    table(ctx, [["Field", 135], ["Value", 268], ["Field", 135], ["Value", 268]], [["Created", formatIST(inspection.created_at), "Initial submission", formatIST(inspection.submitted_at || inspection.created_at)], ["Last updated", formatIST(inspection.updated_at), "Final status", inspection.status.replaceAll("_", " ")]]);
    heading(ctx, "2. Current Inspection Submission");
    const revisions = [...(inspection.inspection_revisions || [])].sort((a: any, b: any) => a.revision_no - b.revision_no); const current = revisions[revisions.length - 1];
    drawText(ctx, "Contractor observation:", 36, 9, true); wrap(ctx, current?.description || "-", 160, 96, 9);
    for (const image of images.filter((item: any) => item.inspection_id === inspection.id && item.revision_id === current?.id && item.stage === "CONTRACTOR")) await photo(ctx, image);
    heading(ctx, "3. Approval Workflow");
    const workflow: string[][] = [];
    for (const event of [...(inspection.inspection_events || [])].sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))) workflow.push([event.actor_role === "CONTRACTOR" ? "Contractor" : event.actor_role, event.action.replaceAll("_", " "), event.actor_name, formatIST(event.created_at), (event.details?.comments ? `Comments: ${event.details.comments}` : "") + (event.details?.reason ? ` | Reason: ${event.details.reason}` : "")]);
    table(ctx, [["Stage", 100], ["Status", 120], ["By", 100], ["Date & time", 170], ["Comments / reason", 316]], workflow);

    newPage(ctx, "Revision & Audit Trail");
    ctx.page.drawText("Every rejection, correction, resubmission and approval remains visible for auditability.", { x: 36, y: 468, size: 9, font: regular, color: muted }); ctx.y = 440;
    heading(ctx, "4. Revision History");
    for (const revision of revisions) {
      const relatedReviews = (inspection.reviews || []).filter((review: any) => review.revision_id === revision.id);
      ensure(ctx, 100, "Revision & Audit Trail");
      ctx.page.drawRectangle({ x: 18, y: ctx.y - 24, width: 806, height: 24, color: navy }); ctx.page.drawText(`REVISION ${String(revision.revision_no).padStart(2, "0")}`, { x: 36, y: ctx.y - 16, size: 9, font: bold, color: rgb(1, 1, 1) }); ctx.y -= 38;
      drawText(ctx, `${revision.revision_no ? "Resubmitted" : "Submitted"}: ${formatIST(revision.submitted_at)}`, 36, 8, true); wrap(ctx, `Contractor note: ${revision.description}`, 36, 120, 8);
      for (const image of images.filter((item: any) => item.inspection_id === inspection.id && item.revision_id === revision.id && item.stage === "CONTRACTOR")) await photo(ctx, image);
      for (const review of relatedReviews) { const reviewer = value(review.profiles); drawText(ctx, `${review.stage} ${review.decision} | ${reviewer?.name || "-"} | ${formatIST(review.reviewed_at)}`, 36, 8, true); wrap(ctx, `Comments: ${review.comments || "-"}`, 36, 120, 8); if (review.rejection_reason) wrap(ctx, `Reason: ${review.rejection_reason}`, 36, 120, 8); for (const image of images.filter((item: any) => item.inspection_id === inspection.id && item.revision_id === revision.id && item.stage === review.stage)) await photo(ctx, image); }
    }
    heading(ctx, "5. Activity Timeline");
    table(ctx, [["Time", 155], ["Activity", 270], ["User", 180], ["Role", 201]], [...(inspection.inspection_events || [])].sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)).map((event: any) => [formatIST(event.created_at), event.action.replaceAll("_", " "), event.actor_name, event.actor_role]));
    heading(ctx, "6. Final Sign-off");
    ensure(ctx, 105);
    const signoffWidth = 806 / 3;
    const signoffs = [
      ["CONTRACTOR", submitter?.name || "-", "Submitted / Resubmitted"],
      ["PMC", (inspection.reviews || []).filter((review: any) => review.stage === "PMC").at(-1)?.profiles?.name || "-", (inspection.reviews || []).filter((review: any) => review.stage === "PMC").at(-1)?.decision || "-"],
      ["CLIENT", (inspection.reviews || []).filter((review: any) => review.stage === "CLIENT").at(-1)?.profiles?.name || "-", (inspection.reviews || []).filter((review: any) => review.stage === "CLIENT").at(-1)?.decision || "-"],
    ];
    signoffs.forEach(([label, name, decision], index) => { const x = 18 + index * signoffWidth; ctx.page.drawRectangle({ x, y: ctx.y - 84, width: signoffWidth, height: 84, color: index % 2 ? rgb(1, 1, 1) : gray, borderColor: rgb(0.83, 0.87, 0.89), borderWidth: 0.7 }); ctx.page.drawRectangle({ x, y: ctx.y - 24, width: signoffWidth, height: 24, color: navy }); ctx.page.drawText(label, { x: x + 12, y: ctx.y - 16, size: 8, font: bold, color: rgb(1, 1, 1) }); ctx.page.drawText(text(name), { x: x + 12, y: ctx.y - 46, size: 9, font: bold, color: navy }); ctx.page.drawText(text(decision), { x: x + 12, y: ctx.y - 62, size: 8, font: regular }); }); ctx.y -= 100;
    drawText(ctx, `FINAL INSPECTION STATUS: ${inspection.status.replaceAll("_", " ")}`, 36, 10, true, inspection.status === "FINAL_APPROVED" ? green : navy);
  }

  for (const [index, page] of pdf.getPages().entries()) { page.drawLine({ start: { x: 18, y: 34 }, end: { x: 824, y: 34 }, thickness: 0.5, color: rgb(0.82, 0.85, 0.87) }); page.drawText(`Inspectifier by Cubixtop India | Page ${index + 1} of ${pdf.getPageCount()}`, { x: 36, y: 22, size: 7, font: regular, color: muted }); }
  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=inspection-dossier-report.pdf" } });
}
