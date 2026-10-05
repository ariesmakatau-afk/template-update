"use client";

import { useRef, useState } from "react";

type Photo = { id: string; url: string; caption: string; name?: string };

/** Upload / remove photos for one wall: staff ("team") or customers. */
export default function PhotoWall({ kind, initial, limit }: { kind: "team" | "customers"; initial: Photo[]; limit: number }) {
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [caption, setCaption] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const team = kind === "team";

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    const room = Math.max(0, limit - photos.length);
    if (room === 0) {
      setMsg({ ok: false, text: `That wall holds ${limit} photos — remove one first.` });
      return;
    }
    const batch = list.slice(0, room);
    setBusy(true);
    setMsg(null);
    try {
      let next = photos;
      for (let i = 0; i < batch.length; i++) {
        const form = new FormData();
        form.append("kind", kind);
        form.append("photo", batch[i]);
        form.append("caption", caption.trim());
        if (name.trim()) form.append("name", name.trim());
        const res = await fetch("/api/admin/photos", { method: "POST", body: form });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Upload failed.");
        next = body.photos;
        setPhotos(next);
      }
      setCaption("");
      setName("");
      setMsg({
        ok: true,
        text:
          batch.length === 1
            ? "Added — it's live. Empty slots are never shown on the site."
            : `Added ${batch.length} photos. Only these show on the site — no empty placeholders.`,
      });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(id: string) {
    if (!confirm("Take this photo off the site?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/photos?kind=${kind}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not remove it.");
      setPhotos(body.photos);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not remove it." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>{team ? <>Name <em>optional</em></> : <>Name <em>optional</em></>}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={team ? "Yianni" : "Kosta"} />
        </label>
        <label className="field">
          <span>{team ? <>Role / a line about them <em>optional</em></> : <>Caption <em>optional</em></>}</span>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={140}
            placeholder={team ? "On the spit since 2002" : "Every Friday since the nineties. Lamb, extra garlic."}
          />
        </label>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) uploadFiles(e.target.files);
        }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || photos.length >= limit} onClick={() => input.current?.click()} className="btn btn-fire btn-sm">
          {busy ? "Working…" : photos.length >= limit ? "Wall is full" : "Add photos"}
        </button>
        <span className="text-xs text-muted">
          {photos.length === 0
            ? `None on the site yet — add 1 or 2, or as many as you like (up to ${limit}).`
            : `${photos.length} on the site${photos.length === 1 ? "" : ""} · JPG, PNG or WEBP up to 8MB`}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted">The website only shows photos you actually upload. It will never pad the wall with empty boxes.</p>
      {msg && (
        <p role="status" className={`mt-3 text-sm font-semibold ${msg.ok ? "text-green-700" : "text-ember-deep"}`}>
          {msg.text}
        </p>
      )}

      {photos.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
          No photos yet — the public pages stay empty here until you add one.
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-2xl border border-line bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption} className={`w-full object-cover ${team ? "aspect-[4/5]" : "aspect-square"}`} />
              <div className="p-3">
                {p.name && <p className="text-sm font-bold text-blue-navy">{p.name}</p>}
                <p className="text-xs leading-snug text-muted">{p.caption}</p>
                <button type="button" disabled={busy} onClick={() => remove(p.id)} className="press-btn mt-2 text-xs font-bold text-ember-deep">
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
