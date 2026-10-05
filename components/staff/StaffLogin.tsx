"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { startTab } from "./staffTab";

export default function StaffLogin({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not sign in.");
      }
      startTab();
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <div className="tile w-full max-w-sm p-8 hover:!translate-y-0">
      <span className="relative block h-14 w-14 overflow-hidden rounded-full shadow-[0_0_0_2px_var(--blue)]">
        <Image src="/images/medallion-192.png" alt="" fill sizes="56px" />
      </span>
      <p className="eyebrow mt-6">Staff only</p>
      <h1 className="h-md mt-2 text-blue-navy">Sign in</h1>
      <p className="mt-2 text-sm text-muted">Kitchen board, admin and photo uploads.</p>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <label className="field">
          <span>Password</span>
          <input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && (
          <p role="alert" className="text-sm font-semibold text-ember-deep">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn btn-fire w-full">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
