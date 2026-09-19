import { requireUser } from "@/lib/auth/guard";
import { AppShell } from "@/components/app-shell";
import { WorkflowDeliveryForm } from "@/components/workflow-delivery-form";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(["ADMIN"]);
  const params = await searchParams;
  const { data } = await user.supabase.from("app_settings").select("value").eq("key", "smtp").maybeSingle();
  return <AppShell user={user.profile}><div className="pagehead"><div><p className="eyebrow">Administration</p><h1>Workflow delivery</h1><p className="muted">Manage status emails and verify the SMTP connection.</p></div></div><WorkflowDeliveryForm smtp={(data?.value || {}) as Record<string, any>} saveStatus={typeof params.test === "string" ? params.test : ""} saveReason={typeof params.reason === "string" ? params.reason : ""} /></AppShell>;
}
