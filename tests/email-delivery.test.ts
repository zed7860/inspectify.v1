import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(), close: vi.fn(), setting: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: mocks.send, close: mocks.close }) } }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.setting }) }) }) }) }));
import { sendConfiguredEmail } from "@/lib/notifications/smtp";
import { parseRecipients } from "@/lib/notifications/recipients";
import { readJsonResponse } from "@/lib/http/response";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.setting.mockResolvedValue({ data: { value: { host: "smtp.example.com", user: "sender", password: "test-only", from: "sender@example.com" } } });
});
it("accepts mixed separators and removes duplicate addresses", () => {
  expect(parseRecipients("A@example.com; b@example.com\na@example.com, c@example.com")).toEqual(["a@example.com","b@example.com","c@example.com"]);
  expect(() => parseRecipients("not-an-email")).toThrow();
});
it("sends a PDF to every requested address", async () => {
  mocks.send.mockResolvedValue({ accepted: ["a@example.com","b@example.com"], messageId: "mail-id" });
  const result = await sendConfiguredEmail({to:["a@example.com","b@example.com"],subject:"Report",text:"Details",attachment:{filename:"report.pdf",content:Buffer.from("pdf")}});
  expect(result.accepted).toHaveLength(2);
  expect(mocks.send.mock.calls[0][0].to).toEqual(["a@example.com","b@example.com"]);
  expect(mocks.send.mock.calls[0][0].attachments[0].filename).toBe("report.pdf");
  expect(mocks.close).toHaveBeenCalled();
});
it("reports partial rejection without losing accepted recipients", async () => {
  mocks.send.mockResolvedValue({accepted:["a@example.com"],rejected:["b@example.com"]});
  await expect(sendConfiguredEmail({to:["a@example.com","b@example.com"],subject:"Report",text:"Details"})).rejects.toMatchObject({accepted:["a@example.com"],rejected:["b@example.com"]});
});
it("reports authentication failure for every undelivered recipient", async () => {
  mocks.send.mockRejectedValue(Object.assign(new Error("login"),{code:"EAUTH"}));
  await expect(sendConfiguredEmail({to:["a@example.com"],subject:"Report",text:"Details"})).rejects.toMatchObject({rejected:["a@example.com"],message:expect.stringContaining("authentication")});
});
it("handles empty and HTML error responses with useful messages", async () => {
  await expect(readJsonResponse(new Response("",{status:504}))).rejects.toThrow("Check delivery status");
  await expect(readJsonResponse(new Response("<html>Too big</html>",{status:413}))).rejects.toThrow("upload limit");
  await expect(readJsonResponse(Response.json({error:"SMTP unavailable"},{status:502}))).resolves.toEqual({error:"SMTP unavailable"});
});
