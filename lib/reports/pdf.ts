import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import sharp from "sharp";
import { formatIST } from "@/lib/timezone";
export const related = (value: any) => Array.isArray(value) ? value[0] : value;
export const subcategoryNames = (inspection: any) => (inspection.inspection_subcategories || []).map((row: any) => related(row.subcategories)?.name).filter(Boolean).join(", ") || related(inspection.subcategories)?.name || "-";

export async function buildInspectionPdf(inspections: any[], readPhoto: (key: string) => Promise<Buffer>) {
  if (!inspections.length) throw new Error("No inspections available for the report.");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(.08,.19,.28), ink = rgb(.08,.12,.15), muted = rgb(.35,.42,.5);
  const pale = rgb(.93,.95,.97), border = rgb(.85,.89,.92), white = rgb(1,1,1);
  const green = rgb(.06,.51,.31), red = rgb(.75,.16,.2), amber = rgb(.65,.4,.08);
  const width = 806, bottom = 40;
  let page!: PDFPage;
  let y = 0, current: any, audit = false;
  const pageNumbers: string[] = [];
  const clean = (value: unknown, font: PDFFont = regular) => Array.from(String(value ?? "-").replace(/[\r\t]/g," ")).map(char => { if (char === "\n") return char; try { font.encodeText(char); return char; } catch { return "?"; } }).join("");
  const human = (value: unknown) => String(value || "-").replaceAll("_", " ");
  const statusColor = (value: unknown) => /REJECT/.test(String(value)) ? red : /APPROVED/.test(String(value)) ? green : amber;
  function lines(value: unknown, maxWidth: number, size = 8, font = regular) {
    const result: string[] = [];
    for (const block of clean(value, font).split("\n")) {
      let line = "";
      for (const word of block.split(/\s+/)) {
        if (line && font.widthOfTextAtSize(`${line} ${word}`, size) > maxWidth) { result.push(line); line = ""; }
        for (const char of (line ? " " : "") + word) {
          if (font.widthOfTextAtSize(line + char, size) > maxWidth) { result.push(line); line = ""; }
          line += char;
        }
      }
      result.push(line);
    }
    return result;
  }
  function text(value: unknown, x: number, top: number, size = 8, font = regular, color = ink) {
    page.drawText(clean(value, font), { x, y: top - size, size, font, color });
  }
  function box(x: number, top: number, w: number, h: number, color = white) {
    page.drawRectangle({ x, y: top-h, width:w, height:h, color, borderColor:border, borderWidth:.6 });
  }
  function newPage() {
    page = pdf.addPage([842,595]); pageNumbers.push(String(current.inspection_number || "-"));
    page.drawRectangle({x:18,y:535,width:586,height:44,color:navy});
    page.drawRectangle({x:604,y:535,width:220,height:44,color:statusColor(current.status)});
    text("INSPECTIFIER",38,558,10,bold,white);
    lines(human(current.status),190,9,bold).forEach((line,i)=>text(line,620,559-i*11,9,bold,white));
    text(audit ? "Revision & Audit Trail" : "Inspection Report",36,516,25,bold,navy);
    text(`Inspectifier by Cubixtop India | Inspection ${current.inspection_number || "-"}`,36,482,8,regular,muted);
    y = 457;
  }
  function ensure(height: number) { if (y-height < bottom) newPage(); }
  function paragraph(value: unknown, strong = false, size = 8, color = ink, x = 36, w = 770) {
    for (const line of lines(value,w,size,strong ? bold : regular)) {
      ensure(size+2); text(line,x,y,size,strong ? bold : regular,color); y -= size+2;
    }
    y -= 3;
  }
  function heading(value: string, following = 51) { ensure(28+following); text(value,36,y,12,bold,navy); y -= 29; }
  function table(headers: string[], rows: unknown[][], widths: number[]) {
    function header() {
      page.drawRectangle({x:18,y:y-25,width,height:25,color:navy});
      let x=18; headers.forEach((label,i)=>{text(label,x+7,y-8,7,bold,white);x+=widths[i];}); y-=25;
    }
    ensure(51); header();
    rows.forEach((row,index)=>{
      const cells=row.map((value,i)=>lines(value,widths[i]-14,7));
      let offset=0; const count=Math.max(...cells.map(cell=>cell.length));
      while(offset<count) {
        if(y-bottom<25){newPage();header();}
        const take=Math.min(count-offset,Math.max(1,Math.floor((y-bottom-14)/10)));
        const height=Math.max(25,take*10+14); let x=18;
        cells.forEach((cell,i)=>{
          box(x,y,widths[i],height,index%2===0?pale:white);
          cell.slice(offset,offset+take).forEach((line,j)=>text(line,x+7,y-7-j*10,7,regular,/APPROVED|REJECTED/.test(line)?statusColor(line):ink));
          x+=widths[i];
        }); y-=height;offset+=take;
      }
    });y-=10;
  }
  for (const inspection of inspections) {
    current=inspection;audit=false;newPage();
    const revisions=[...(inspection.inspection_revisions||[])].sort((a:any,b:any)=>a.revision_no-b.revision_no);
    const reviews=[...(inspection.reviews||[])].sort((a:any,b:any)=>String(a.reviewed_at).localeCompare(String(b.reviewed_at)));
    const events=[...(inspection.inspection_events||[])].sort((a:any,b:any)=>String(a.created_at).localeCompare(String(b.created_at)));
    const photos=inspection.inspection_images||[], project=related(inspection.projects), submitter=related(inspection.profiles);
    const latest=revisions.at(-1), seen=new Set<string>();
    paragraph("Clear inspection record, revision trail, evidence and approval workflow",false,8,muted);
    const fields=[["Inspection No.",inspection.inspection_number],["Project",`${project?.code||"-"} ${project?.name||"-"}`],["Location",inspection.location],["Category / Item",`${related(inspection.categories)?.name||"-"} / ${subcategoryNames(inspection)}`],["Submitted by",`${submitter?.name||"-"} (${human(submitter?.role||"Contractor")})`],["Current Revision",`Revision ${String(latest?.revision_no??0).padStart(2,"0")}`]];
    for(let row=0;row<2;row++) {
      const group=fields.slice(row*3,row*3+3);const cellLines=group.map(field=>lines(field[1],244,8));
      const h=Math.max(54,30+Math.max(...cellLines.map(cell=>cell.length))*12);ensure(h);box(18,y,width,h,pale);
      group.forEach((field,i)=>{text(field[0],36+i*width/3,y-8,8,bold,navy);cellLines[i].forEach((line,j)=>text(line,36+i*width/3,y-25-j*12));});y-=h;
    }
    y-=18;
    const outcome=inspection.status==="FINAL_APPROVED"?"Approved after the complete PMC and Client workflow.":`Current inspection status: ${human(inspection.status)}.`;
    ensure(48);box(18,y,width,44,rgb(.89,.96,.93));text("Final outcome",36,y-12,8,bold,navy);text(outcome,150,y-12,8);text(`Updated ${formatIST(inspection.updated_at||inspection.created_at)}`,600,y-13,7);y-=53;
    heading("1. Inspection Details");
    table(["Field","Value","Field","Value"],[["Created",formatIST(inspection.created_at),"Initial submission",formatIST(inspection.submitted_at||inspection.created_at)],["Last updated",formatIST(inspection.updated_at||inspection.created_at),"Final status",human(inspection.status)]],[134,269,134,269]);
    heading("2. Current Inspection Submission",30);paragraph("Contractor observation:",true);paragraph(latest?.description||inspection.description||"-");
    async function photo(image: any) {
      seen.add(image.id||image.storage_key);
      const selected=(inspection.inspection_subcategories||[]).find((row:any)=>row.subcategory_id===image.subcategory_id);
      const caption=`${human(image.stage)} | ${image.original_filename||"Photo"}${selected?` | ${related(selected.subcategories)?.name||"-"}`:""}`;
      const captionLines=lines(caption,515,8,bold);const h=Math.max(138,captionLines.length*12+50);
      let embedded;
      try { const data=await sharp(await readPhoto(image.storage_key)).rotate().resize({width:1100,height:800,fit:"inside",withoutEnlargement:true}).jpeg({quality:80}).toBuffer();embedded=await pdf.embedJpg(data); } catch { /* Keep a visible record when evidence cannot be loaded. */ }
      ensure(h+8);box(18,y,width,h);
      if(embedded){const scale=Math.min(235/embedded.width,118/embedded.height);page.drawImage(embedded,{x:30,y:y-10-embedded.height*scale,width:embedded.width*scale,height:embedded.height*scale});}
      else text("Evidence unavailable",30,y-25,9,regular,muted);
      captionLines.forEach((line,i)=>text(line,290,y-16-i*12,8,bold,navy));
      text(`Uploaded: ${formatIST(image.uploaded_at)}`,290,y-25-captionLines.length*12,7,regular,muted);y-=h+8;
    }
    for(const image of photos.filter((image:any)=>latest&&image.revision_id===latest.id&&image.stage==="CONTRACTOR"))await photo(image);
    heading("3. Approval Workflow");
    const workflow=events.length?events.map((event:any)=>[human(event.actor_role),human(event.action),event.actor_name||"-",formatIST(event.created_at),[event.details?.comments&&`Comments: ${event.details.comments}`,event.details?.rejection_reason&&`Reason: ${event.details.rejection_reason}`].filter(Boolean).join("\n")||"-"]):reviews.map((review:any)=>[review.stage,human(review.decision),related(review.profiles)?.name||"-",formatIST(review.reviewed_at),[review.comments,review.rejection_reason].filter(Boolean).join("\n")||"-"]);
    table(["Stage","Status","By","Date & time","Comments / reason"],workflow.length?workflow:[["-","No workflow recorded","-","-","-"]],[85,150,125,165,281]);
    audit=true;newPage();paragraph("Every rejection, correction, resubmission and approval remains visible for auditability.",false,8,muted);heading("4. Revision History");
    for(const revision of revisions){
      ensure(85);page.drawRectangle({x:18,y:y-24,width,height:24,color:navy});text(`REVISION ${String(revision.revision_no).padStart(2,"0")}`,36,y-7,9,bold,white);y-=32;
      paragraph(`${revision.revision_no===0?"Submitted":"Resubmitted"}: ${formatIST(revision.submitted_at)}`,true);
      paragraph(`Contractor note: ${revision.description||"-"}`);
      for(const image of photos.filter((image:any)=>image.revision_id===revision.id&&image.stage==="CONTRACTOR"))await photo(image);
      for(const review of reviews.filter((review:any)=>review.revision_id===revision.id)){
        ensure(44);paragraph(`${review.stage} ${human(review.decision)} | ${related(review.profiles)?.name||"-"} | ${formatIST(review.reviewed_at)}`,true);
        paragraph(`Comments: ${review.comments||"-"}${review.rejection_reason?`\nReason: ${review.rejection_reason}`:""}`);
        for(const image of photos.filter((image:any)=>image.revision_id===revision.id&&image.stage===review.stage&&!seen.has(image.id||image.storage_key)))await photo(image);
      }
      y-=8;
    }
    if(!revisions.length)paragraph("No revisions recorded.");
    for(const review of reviews.filter((review:any)=>!revisions.some((revision:any)=>revision.id===review.revision_id))){paragraph(`${review.stage} ${human(review.decision)} | ${related(review.profiles)?.name||"-"} | ${formatIST(review.reviewed_at)}`,true);paragraph(`Comments: ${review.comments||"-"}\nReason: ${review.rejection_reason||"-"}`);}
    for(const image of photos.filter((image:any)=>!seen.has(image.id||image.storage_key)))await photo(image);
    audit=false;heading("5. Activity Timeline");
    table(["Time","Activity","User","Role"],events.length?events.map((event:any)=>[formatIST(event.created_at),human(event.action),event.actor_name||"-",event.actor_role||"-"]):[["-","No activity recorded","-","-"]],[155,270,180,201]);
    heading("6. Final Sign-off",90);
    const stageSignoff=(stage:string)=>{const review=reviews.filter((review:any)=>review.stage===stage).at(-1);return review?`${related(review.profiles)?.name||"-"}\n${human(review.decision)}`:"-\nPending";};
    table(["CONTRACTOR","PMC","CLIENT"],[[`${related(latest?.profiles)?.name||submitter?.name||"-"}\nSubmitted / Resubmitted`,stageSignoff("PMC"),stageSignoff("CLIENT")]],[width/3,width/3,width/3]);
    paragraph(`FINAL INSPECTION STATUS: ${human(inspection.status)}`,true,10,statusColor(inspection.status));
  }
  pdf.getPages().forEach((currentPage,index)=>{
    currentPage.drawLine({start:{x:18,y:34},end:{x:824,y:34},color:border,thickness:.5});
    currentPage.drawText(`Inspectifier by Cubixtop India | Page ${index+1} of ${pdf.getPageCount()}`,{x:36,y:21,font:regular,size:7,color:muted});
    const label=clean(pageNumbers[index]);currentPage.drawText(label,{x:806-regular.widthOfTextAtSize(label,7),y:21,font:regular,size:7,color:muted});
  });
  return Buffer.from(await pdf.save());
}
