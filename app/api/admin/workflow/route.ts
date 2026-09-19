import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { adminClient } from "@/lib/supabase/admin";
import { sendConfiguredEmail } from "@/lib/notifications/email";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const user = await requireUser(["ADMIN"]);
  const form = await request.formData();
  const action = String(form.get("action") || "");
  const admin = adminClient();

  if (action === "test") {
    const recipient = String(form.get("recipient") || "").trim().toLowerCase();
    if (!emailPattern.test(recipient)) return NextResponse.json({ error: "Enter a valid test email address." }, { status: 400 });
    try {
      await sendConfiguredEmail({ to: [recipient], subject: "Inspectifier SMTP test email", text: "This test confirms that Inspectifier workflow email delivery is configured correctly." });
      return NextResponse.json({ message: "Test email sent successfully." });
    } catch (error: any) {
      const message = error?.code === "EHOSTUNREACH"
        ? "SMTP host is unreachable from this server. IPv4 is enabled; verify the SMTP host, port, firewall, and network access."
        : error?.message || "Test email delivery failed.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (action === "save") {
    const { data: current } = await admin.from("app_settings").select("value").eq("key", "smtp").maybeSingle();
    const currentSmtp = (current?.value || {}) as Record<string, any>;
    const value = {
      host: String(form.get("host") || "").trim(),
      port: String(form.get("port") || "587").trim(),
      secure: form.get("secure") === "on",
      user: String(form.get("user") || "").trim(),
      password: String(form.get("password") || "") || currentSmtp.password || "",
      from: String(form.get("from") || "").trim()
    };
    const port = Number(value.port);
    if (![465, 587].includes(port)) return NextResponse.json({ error: "Use SMTP port 587 with Secure connection off, or port 465 with Secure connection on." }, { status: 400 });
    if ((port === 587 && value.secure) || (port === 465 && !value.secure)) return NextResponse.json({ error: "Port 587 requires Secure connection off. Port 465 requires Secure connection on." }, { status: 400 });
    if (!value.host || !value.user || !value.password || !emailPattern.test(value.from)) return NextResponse.json({ error: "Complete all SMTP fields with a valid sender email." }, { status: 400 });
    const { error } = await admin.from("app_settings").upsert({ key: "smtp", value, updated_by: user.user.id, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    try {
      await sendConfiguredEmail({ to: [value.from], subject: "Inspectifier SMTP test email", text: "SMTP is configured correctly. This is the automatic test email sent after saving Workflow Delivery settings." });
      return NextResponse.redirect(new URL("/admin/workflow?smtp=saved&test=sent", request.url), 303);
    } catch (testError: any) {
      const target = new URL("/admin/workflow?smtp=saved&test=failed", request.url);
      if (testError?.code === "EHOSTUNREACH") target.searchParams.set("reason", "unreachable");
      else if (testError?.code === "EAUTH" || testError?.responseCode === 535) target.searchParams.set("reason", "auth");
      else target.searchParams.set("reason", "delivery");
      return NextResponse.redirect(target, 303);
    }
  }

  return NextResponse.json({ error: "Invalid workflow action." }, { status: 400 });
}
