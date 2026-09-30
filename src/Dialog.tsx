import { useEffect, useRef, useState } from 'react';

/** The browser's own modal: focus trap, Escape and the backdrop come with it. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}>
      <div className="dialog-body">
        <h2>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

/** A 200-character idea editor, shared by New idea, Edit text and Make an idea. */
export function IdeaForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial: string;
  submitLabel: string;
  onSubmit: (text: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { textRef.current?.focus(); }, []);
  return (
    <form
      className="idea-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const text = textRef.current!.value.trim();
        const err = e.currentTarget.querySelector('.error') as HTMLElement;
        if (busy) return;
        setBusy(true);
        err.textContent = '';
        try { await onSubmit(text); } catch (x) { err.textContent = messageOf(x); } finally { setBusy(false); }
      }}
    >
      <fieldset className="plain-set" disabled={busy}>
      <label className="field">
        <span>Idea</span>
        <textarea
          ref={textRef}
          defaultValue={initial.slice(0, 200)}
          maxLength={200}
          minLength={5}
          rows={4}
          required
          onInput={(e) => { (e.currentTarget.nextElementSibling as HTMLElement).textContent = `${e.currentTarget.value.length} / 200`; }}
        />
        <span className="counter">{Math.min(initial.length, 200)} / 200</span>
      </label>
      <p className="error" role="alert" />
      <div className="actions">
        <button className="primary">{submitLabel}</button>
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
      </div>
      </fieldset>
    </form>
  );
}

/** A server refusal's own words when it has some, otherwise a plain retry. */
export function messageOf(e: unknown) {
  const data = (e as { data?: unknown })?.data;
  return typeof data === 'string' ? data : 'That didn’t go through. Try again.';
}
