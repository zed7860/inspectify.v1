import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { sendConfiguredEmail } from "@/lib/notifications/email";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  await requireUser();
  const form = await request.formData();
  const recipients = [...new Set(String(form.get("recipients") || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean))];
  const report = form.get("report");
  if (!recipients.length || recipients.length > 50 || recipients.some((email) => !emailPattern.test(email))) {
    return NextResponse.json({ error: "Enter up to 50 valid comma-separated email addresses." }, { status: 400 });
  }
  if (!(report instanceof File) || report.size < 1 || report.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "A valid report PDF is required." }, { status: 400 });
  }

  try {
    await sendConfiguredEmail({
      to: recipients,
      subject: "Inspectifier inspection report",
      text: "Please find the requested inspection report attached.",
      attachment: { filename: "inspection-dossier-report.pdf", content: Buffer.from(await report.arrayBuffer()) },
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unable to send the report." }, { status: 502 });
  }
}
