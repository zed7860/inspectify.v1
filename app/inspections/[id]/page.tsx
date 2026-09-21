import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { ReviewForm } from "@/components/review-form";
import { ResubmitForm } from "@/components/resubmit-form";
import { formatIST } from "@/lib/timezone";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const baseInspectionQuery = user.supabase
    .from("inspections")
    .select("*,projects(name,code),categories(name),subcategories!inspections_subcategory_id_fkey(name),profiles!inspections_contractor_id_fkey(name,email),inspection_revisions(*),reviews(*,profiles!reviews_reviewer_id_fkey(name)),inspection_events(*)")
    .eq("id", id)
    .single();
  const { data: inspection, error: inspectionError } = await baseInspectionQuery;
  if (inspectionError || !inspection) {
    if (inspectionError) console.error("Inspection detail query failed", inspectionError);
    notFound();
  }
  const { data: inspectionSubcategories } = await user.supabase.from("inspection_subcategories").select("subcategory_id,subcategories(name)").eq("inspection_id", id);
  inspection.inspection_subcategories = inspectionSubcategories || [];

  const { data: deliveryLog } = await adminClient().from("audit_logs").select("id,action,new_state").eq("entity_id", id).in("action", ["INSPECTION_EMAIL_SENT", "INSPECTION_EMAIL_FAILED"]).order("created_at", {ascending:false}).limit(1).maybeSingle();
  const { data: images } = await user.supabase.from("inspection_images").select("*").eq("inspection_id", id).order("uploaded_at");
  const storage = adminClient();
  const photos = await Promise.all((images || []).map(async (image: any) => ({ ...image, url: (await storage.storage.from("inspection-evidence").createSignedUrl(image.storage_key, 900)).data?.signedUrl })));
  const revisions = [...(inspection.inspection_revisions || [])].sort((a: any, b: any) => a.revision_no - b.revision_no);
  const events = [...(inspection.inspection_events || [])].sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));
  const canPmcReview = user.profile.role === "PMC" && ["PENDING_PMC", "RESUBMITTED"].includes(inspection.status);
  const canClientReview = user.profile.role === "CLIENT" && inspection.status === "PENDING_CLIENT";
  const canResubmit = user.profile.role === "CONTRACTOR" && inspection.contractor_id === user.user.id && ["PMC_REJECTED", "CLIENT_REJECTED"].includes(inspection.status);
  const latestRevision = revisions[revisions.length - 1];

  return (
    <AppShell user={user.profile}>
      <div className="pagehead"><div><h1>{inspection.inspection_number}</h1><p>{inspection.projects?.name} · {inspection.location}</p></div><StatusBadge status={inspection.status} /></div>
      {deliveryLog?.action === "INSPECTION_EMAIL_FAILED" && <section className="notice delivery-warning" role="alert"><strong>The inspection was saved, but its email notification needs attention.</strong><p>{deliveryLog.new_state?.error || "Email delivery failed."}</p><p>An administrator can retry failed recipients from <a className="text-link" href="/admin/workflow">Workflow delivery</a>.</p></section>}
      <section className="card"><h2>Inspection details</h2><p><b>{inspection.categories?.name}</b></p><p>Subcategories: {(inspection.inspection_subcategories || []).map((row: any) => (Array.isArray(row.subcategories) ? row.subcategories[0]?.name : row.subcategories?.name)).filter(Boolean).join(", ") || inspection.subcategories?.name || "-"}</p><p>Contractor: {inspection.profiles?.name}</p><p>Submitted: {inspection.submitted_at ? formatIST(inspection.submitted_at) : "—"}</p><p>Project: {inspection.projects?.code} · {inspection.projects?.name} · {inspection.location}</p></section>
      {revisions.map((revision: any) => <section className="card" key={revision.id}>
        <h2>Contractor Submission · Revision {revision.revision_no}</h2><p>{revision.description}</p><small>{formatIST(revision.submitted_at)}</small>
        <div className="gallery">{photos.filter((photo: any) => photo.revision_id === revision.id && photo.stage === "CONTRACTOR").map((photo: any) => <a key={photo.id} href={photo.url} target="_blank"><img src={photo.url} alt={photo.original_filename} /></a>)}</div>
        {(inspection.reviews || []).filter((review: any) => review.revision_id === revision.id).map((review: any) => <div className="review" key={review.id}><h3>{review.stage} · {review.decision}</h3><p>{review.comments}</p><small>{review.profiles?.name} · {formatIST(review.reviewed_at)}</small><div className="gallery">{photos.filter((photo: any) => photo.revision_id === revision.id && photo.stage === review.stage).map((photo: any) => <a key={photo.id} href={photo.url} target="_blank"><img src={photo.url} alt={photo.original_filename} /></a>)}</div></div>)}
      </section>)}
      {canResubmit && latestRevision && <ResubmitForm inspectionId={id} description={latestRevision.description} />}
      {(canPmcReview || canClientReview) && <ReviewForm inspectionId={id} version={inspection.lock_version} role={user.profile.role} />}
      <section className="card"><h2>Complete Timeline</h2><div className="timeline">{events.map((event: any) => <div key={event.id}><b>{event.action.replaceAll("_", " ")}</b><p>{event.actor_name} · {event.actor_role}</p><small>{formatIST(event.created_at)}</small></div>)}</div></section>
    </AppShell>
  );
}
