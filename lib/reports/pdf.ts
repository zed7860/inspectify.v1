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
  const ink = rgb(.13,.25,.29), muted = rgb(.36,.44,.48), teal = rgb(.07,.5,.46);
  let page: PDFPage, y = 0, number = "";
  const clean = (value: unknown, font: PDFFont = regular) => Array.from(String(value ?? "-").replace(/[\r\t]/g," ")).map((char) => { if(char === "\n") return char; try { font.encodeText(char); return char; } catch { return "?"; } }).join("");
  function newPage() {
    page = pdf.addPage([595,842]); y=748;
    page.drawRectangle({ x:0,y:790,width:595,height:52,color:ink });
    page.drawText("INSPECTIFIER",{x:36,y:812,font:bold,size:13,color:rgb(1,1,1)});
    page.drawText(clean(number),{x:355,y:813,font:regular,size:9,color:rgb(.8,.9,.9)});
    page.drawText("Inspection report | Cubixtop India",{x:36,y:767,font:regular,size:9,color:muted});
  }
  function ensure(height: number) { if (y-height<52) newPage(); }
  function paragraph(value: unknown, options: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}) {
    const font = options.bold ? bold : regular, size=options.size || 10, leading=size*1.5;
    const content=clean(value,font);
    for(const block of content.split("\n")) {
      let line="";
      const drawLine = () => { ensure(leading);page.drawText(line.trimEnd(),{x:36,y,font,size,color:options.color||ink});y-=leading;line=""; };
      for(const word of block.split(/\s+/)) {
        const candidate=line ? line+" "+word : word;
        if(font.widthOfTextAtSize(candidate,size)<=523){line=candidate;continue;}
        if(line)drawLine();
        for(const char of word){
          if(font.widthOfTextAtSize(line+char,size)>523)drawLine();
          line+=char;
        }
      }
      ensure(leading);page.drawText(line,{x:36,y,font,size,color:options.color||ink});y-=leading;
    }
    y-=5;
  }
  function heading(title: string) {ensure(60);y-=10;paragraph(title,{bold:true,size:13,color:teal});}
  for(const inspection of inspections) {
    number=inspection.inspection_number;newPage();
    paragraph(number,{bold:true,size:23});
    paragraph(String(inspection.status).replaceAll("_"," "),{bold:true,size:12,color:teal});
    const project=related(inspection.projects), submitter=related(inspection.profiles);
    paragraph(`Project: ${project?.code || "-"} - ${project?.name || "-"}`);
    paragraph(`Address: ${project?.address || "-"}\nLocation: ${inspection.location || "-"}`);
    paragraph(`Category: ${related(inspection.categories)?.name || "-"}\nSubcategories: ${subcategoryNames(inspection)}`);
    paragraph(`Submitted by: ${submitter?.name || "-"} (${submitter?.email || "-"})\nSubmitted: ${formatIST(inspection.submitted_at || inspection.created_at)}\nUpdated: ${formatIST(inspection.updated_at || inspection.created_at)}`);
    heading("Submission and review history");
    const revisions=[...(inspection.inspection_revisions||[])].sort((a:any,b:any)=>a.revision_no-b.revision_no);
    const photos=inspection.inspection_images||[];
    const drawn=new Set<string>();
    async function photo(image:any) {
      const identity=image.id || image.storage_key;if(drawn.has(identity))return;drawn.add(identity);
      try{
        const compressed=await sharp(await readPhoto(image.storage_key)).rotate().resize({width:1100,height:800,fit:"inside",withoutEnlargement:true}).jpeg({quality:72}).toBuffer();
        const embedded=await pdf.embedJpg(compressed);const scale=Math.min(523/embedded.width,250/embedded.height);
        const height=embedded.height*scale;ensure(height+65);
        page.drawImage(embedded,{x:36,y:y-height,width:embedded.width*scale,height});y-=height+16;
        const selected=(inspection.inspection_subcategories||[]).find((row:any)=>row.subcategory_id===image.subcategory_id);
        paragraph(`${image.stage} evidence${selected ? " | "+related(selected.subcategories)?.name : ""} - ${image.original_filename || "Photo"}\nUploaded: ${formatIST(image.uploaded_at)}`,{size:8,color:muted});
      }catch{paragraph(`Evidence unavailable: ${image.original_filename || image.storage_key}`,{size:9,color:muted});}
    }
    for(const revision of revisions){
      heading(`Revision ${revision.revision_no} | ${formatIST(revision.submitted_at)}`);
      paragraph(revision.description||"No description.");
      for(const image of photos.filter((image:any)=>image.revision_id===revision.id&&image.stage==="CONTRACTOR"))await photo(image);
      for(const review of [...(inspection.reviews||[])].filter((review:any)=>review.revision_id===revision.id).sort((a:any,b:any)=>a.reviewed_at.localeCompare(b.reviewed_at))){
        paragraph(`${review.stage}: ${review.decision} | ${related(review.profiles)?.name||"-"} | ${formatIST(review.reviewed_at)}`,{bold:true});
        paragraph(`Comments: ${review.comments||"-"}${review.rejection_reason ? `\nReason: ${review.rejection_reason}` : ""}`);
        for(const image of photos.filter((image:any)=>image.revision_id===revision.id&&image.stage===review.stage))await photo(image);
      }
    }
    for(const image of photos.filter((image:any)=>!drawn.has(image.id||image.storage_key))){if(!drawn.size)heading("Evidence");await photo(image);}
    heading("Complete activity timeline");
    for(const event of [...(inspection.inspection_events||[])].sort((a:any,b:any)=>a.created_at.localeCompare(b.created_at))){
      paragraph(`${formatIST(event.created_at)} | ${String(event.action).replaceAll("_"," ")}`,{bold:true});
      paragraph(`${event.actor_name} (${event.actor_role})\n${event.previous_status||"START"} -> ${event.new_status||"-"}${event.details?.comments ? `\n${event.details.comments}` : ""}`,{size:9});
    }
    heading("Current outcome");paragraph(String(inspection.status).replaceAll("_"," "),{bold:true});
  }
  pdf.getPages().forEach((current,index)=>{current.drawLine({start:{x:36,y:38},end:{x:559,y:38},color:rgb(.85,.9,.9),thickness:.5});current.drawText(`Inspectifier | Page ${index+1} of ${pdf.getPageCount()}`,{x:36,y:24,font:regular,size:8,color:muted});});
  return Buffer.from(await pdf.save());
}
