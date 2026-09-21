import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({load:vi.fn(),send:vi.fn(),auth:vi.fn(),pdf:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{getUser:mocks.auth},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{is_active:true}})})})})})}));
vi.mock("@/lib/notifications/smtp",()=>({sendConfiguredEmail:mocks.send}));
vi.mock("@/lib/notifications/delivery",()=>({recordEmailDelivery:async()=>{},deliveryFailure:(e:Error)=>({error:e.message,accepted:[],rejected:[]})}));
vi.mock("@/lib/reports/data",()=>({loadReportData:mocks.load}));
vi.mock("@/lib/reports/pdf",()=>({buildInspectionPdf:mocks.pdf}));
vi.mock("@/lib/reports/storage",()=>({reportPhotoReader:()=>vi.fn()}));
import { POST } from "@/app/api/reports/email/route";
const request=()=>new Request("https://example.com/api/reports/email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:["11111111-1111-4111-8111-111111111111"],recipients:"a@example.com; b@example.com"})});
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({data:{user:{id:"user"}}});mocks.load.mockResolvedValue([{inspection_number:"INS-001"}]);mocks.pdf.mockResolvedValue(Buffer.from("pdf"));mocks.send.mockResolvedValue({accepted:["a@example.com","b@example.com"],rejected:[]});});
it("generates the attachment server-side from selected IDs and returns JSON",async()=>{
 const response=await POST(request());expect(response.status).toBe(200);
 expect((await response.json()).accepted).toHaveLength(2);
 expect(mocks.pdf).toHaveBeenCalled();expect(mocks.send.mock.calls[0][0].to).toEqual(["a@example.com","b@example.com"]);
});
it("rejects expired sessions with JSON before generating reports",async()=>{
 mocks.auth.mockResolvedValue({data:{user:null}});
 const response=await POST(request());expect(response.status).toBe(401);expect((await response.json()).error).toContain("expired");expect(mocks.send).not.toHaveBeenCalled();
});
it("does not send when authorized report loading rejects access",async()=>{
 mocks.load.mockRejectedValue(new Error("Inspection unavailable or access denied"));
 const response=await POST(request());expect(response.ok).toBe(false);expect((await response.json()).error).toContain("access denied");expect(mocks.send).not.toHaveBeenCalled();
});
