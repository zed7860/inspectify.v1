"use client";
import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
type Confirmation = { title: string; description: string; label: string };
export function useConfirmation() {
  const titleId = useId();
  const [options, setOptions] = useState<Confirmation | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const resolve = useRef<((value: boolean) => void) | null>(null);
  useEffect(() => { if (options) dialog.current?.showModal(); }, [options]);
  useEffect(() => () => resolve.current?.(false), []);
  function finish(value: boolean) {
    resolve.current?.(value); resolve.current = null;
    dialog.current?.close(); setOptions(null);
  }
  const confirm = (value: Confirmation) => new Promise<boolean>((done) => { resolve.current = done; setOptions(value); });
  const confirmationDialog = <dialog ref={dialog} className="confirmation-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); finish(false); }} onClose={() => { if (resolve.current) finish(false); }}>
    <div className="confirmation-icon"><AlertTriangle size={24} /></div><h2 id={titleId}>{options?.title}</h2><p>{options?.description}</p>
    <div className="row-actions"><button type="button" className="btn btn-secondary" autoFocus onClick={() => finish(false)}>Cancel</button><button type="button" className="btn btn-danger" onClick={() => finish(true)}>{options?.label}</button></div>
  </dialog>;
  return { confirm, confirmationDialog };
}
