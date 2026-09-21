import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({send:vi.fn(),log:vi.fn(),pdf:vi.fn(),load:vi.fn()}));
vi.mock("@/lib/notifications/smtp",()=>({sendConfiguredEmail:mocks.send,EmailDeliveryError:class extends Error {}}));
vi.mock("@/lib/notifications/delivery",()=>({recordEmailDelivery:mocks.log,deliveryFailure:(error:Error)=>({status:"failed",error:error.message,accepted:[],rejected:[]})}));
vi.mock("@/lib/reports/data",()=>({loadReportData:mocks.load}));
vi.mock("@/lib/reports/pdf",()=>({buildInspectionPdf:mocks.pdf}));
vi.mock("@/lib/reports/storage",()=>({reportPhotoReader:()=>vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({adminClient:()=>({from:(table:string)=>({
  select:()=>({eq:()=> table==="project_users" ? Promise.resolve({data:[
    {profiles:{id:"contractor",email:"contractor@example.com",is_active:true}},
    {profiles:{id:"pmc",email:"pmc@example.com",is_active:true}},
    {profiles:{id:"client",email:"client@example.com",is_active:true}},
    {profiles:{id:"disabled",email:"disabled@example.com",is_active:false}}
  ]}) : {single:async()=>({data:{id:"contractor",email:"contractor@example.com",is_active:true}}),maybeSingle:async()=>({data:null})}}),
  insert:async()=>({error:null})
})})}));
import { notifyInspectionUsers } from "@/lib/notifications/email";
beforeEach(()=>{
 vi.clearAllMocks();delete process.env.NEXT_PUBLIC_APP_URL;delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
 mocks.load.mockResolvedValue([{id:"inspection",project_id:"project",contractor_id:"contractor",inspection_number:"INS-001",status:"PENDING_PMC",inspection_images:[]}]);
 mocks.pdf.mockResolvedValue(Buffer.from("pdf"));
 mocks.send.mockResolvedValue({accepted:["contractor@example.com","pmc@example.com","client@example.com"],rejected:[]});
});
it("delivers every assigned active role with PDF even without public URL",async()=>{
 expect((await notifyInspectionUsers({inspectionId:"inspection",title:"Submitted",message:"Awaiting review"})).status).toBe("sent");
 const mail=mocks.send.mock.calls[0][0];
 expect(mail.to).toEqual(["contractor@example.com","pmc@example.com","client@example.com"]);
 expect(mail.attachments[0].filename).toBe("INS-001-report.pdf");
 expect(mail.html).not.toContain("localhost");
 expect(mocks.log).toHaveBeenCalled();
});
it("retries only failed recipients",async()=>{
 await notifyInspectionUsers({inspectionId:"inspection",title:"Submitted",message:"Review",recipientFilter:["client@example.com"]});
 expect(mocks.send.mock.calls[0][0].to).toEqual(["client@example.com"]);
});
it("returns delivery failure instead of throwing after inspection commit",async()=>{
 mocks.send.mockRejectedValue(new Error("SMTP unavailable"));
 await expect(notifyInspectionUsers({inspectionId:"inspection",title:"Submitted",message:"Review"})).resolves.toMatchObject({status:"failed",error:"SMTP unavailable"});
});
it.each(["PENDING_PMC","RESUBMITTED","PENDING_CLIENT","PMC_REJECTED","CLIENT_REJECTED","FINAL_APPROVED"])("sends the reference email sections and PDF at %s",async(status)=>{
 process.env.NEXT_PUBLIC_APP_URL="https://inspectifier.cubixtop.com";
 const date="2026-09-21T10:00:00Z";
 mocks.load.mockResolvedValue([{id:"inspection",project_id:"project",contractor_id:"contractor",inspection_number:"INS-001",status,
  inspection_images:[],inspection_revisions:[{revision_no:0,description:"Check the wall finish"}],
  reviews:[{stage:"PMC",decision:"APPROVED",comments:"Checked and approved",reviewed_at:date,profiles:{name:"Reviewer"}}],
  inspection_events:[{created_at:date,action:"PMC_APPROVED",actor_name:"Reviewer",actor_role:"PMC"}]}]);
 await notifyInspectionUsers({inspectionId:"inspection",title:"Workflow update",message:"Current inspection status"});
 const mail=mocks.send.mock.calls[0][0];
 for(const section of ["Inspection details","Latest description","Approval steps","Review decisions","PDF report attached"])expect(mail.html).toContain(section);
 expect(mail.html).toContain(status.replaceAll("_"," "));
 expect(mail.html).toContain("https://inspectifier.cubixtop.com/inspections/inspection");
 expect(mail.attachments[0]).toMatchObject({filename:"INS-001-report.pdf",content:Buffer.from("pdf")});
 expect(mail.to).toHaveLength(3);
 if(status.includes("REJECTED"))expect(mail.text).toContain("Pending with: CONTRACTOR");
 if(status==="FINAL_APPROVED")expect(mail.text).toContain("Pending with: Complete");
});
