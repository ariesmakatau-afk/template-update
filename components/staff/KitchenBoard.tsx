"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ALERT_SOUNDS,
  DEFAULT_SOUND,
  getAlertVolume,
  playAlert,
  setAlertVolume,
  startUrgentLoop,
  type AlertSoundId,
} from "@/lib/alertSounds";
import { formatMoney } from "@/lib/menu";
import { igniteAt } from "@/lib/embers";
import StaffShell from "./StaffShell";
import KitchenPushToggle from "../push/KitchenPushToggle";

type Item = { name: string; detail?: string; quantity: number; unitPrice?: number; notes?: string };
type Order = {
  id: string;
  created_at: string;
  customer_name: string;
  phone: string;
  pickup_time: string;
  email: string | null;
  order_notes: string | null;
  items: Item[];
  total?: number | null;
  status: "new" | "accepted" | "rejected" | "collected";
  wait_minutes: number | null;
};

const WAIT_OPTIONS = [10, 15, 20, 30, 45];
const POLL_MS = 8000;
const BUFFER_CHIPS = [0, 5, 10, 15, 20];
const SOLDOUT_QUICK = ["Pork", "Chicken", "Lamb", "Chips"];
const DEFAULT_WAIT = 15;

function useClock(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

function bump() {
  try {
    navigator.vibrate?.([12, 30, 18]);
  } catch {}
}

export default function KitchenBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [sound, setSound] = useState<AlertSoundId>(DEFAULT_SOUND);
  const [showSounds, setShowSounds] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [volume, setVolume] = useState(1);
  const [loudMode, setLoudMode] = useState(true);
  const [unacked, setUnacked] = useState(0);
  const [paused, setPaused] = useState<boolean | null>(null);
  const [busyMinutes, setBusyMinutes] = useState(0);
  const [soldOutNote, setSoldOutNote] = useState<string | null>(null);
  const [soldOutDraft, setSoldOutDraft] = useState("");
  const [hotIds, setHotIds] = useState<Set<string>>(new Set());
  const knownIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const stopLoop = useRef<(() => void) | null>(null);
  const clock = useClock();
  const wallNow = useWallClock();

  const stopUrgent = useCallback(() => {
    stopLoop.current?.();
    stopLoop.current = null;
  }, []);

  const beep = useCallback(
    (count: number) => {
      if (soundOn) playAlert(sound);
      if (loudMode && !stopLoop.current) stopLoop.current = startUrgentLoop(sound, 1800);
      setUnacked((n) => n + count);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification(`${count} new order${count > 1 ? "s" : ""} at Yianni's`, {
            body: "Accept it on the kitchen board.",
            tag: "yiannis-new-order",
          });
        } catch {}
      }
    },
    [soundOn, sound, loudMode]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/kitchen/orders", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/staff?next=/kitchen";
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load orders.");
      const next: Order[] = body.orders ?? [];
      const incoming = next.filter((o) => o.status === "new" && !knownIds.current.has(o.id));
      if (!firstLoad.current && incoming.length > 0) {
        beep(incoming.length);
        const ids = new Set(incoming.map((o) => o.id));
        setHotIds((prev) => new Set([...prev, ...ids]));
        window.setTimeout(() => {
          setHotIds((prev) => {
            const copy = new Set(prev);
            ids.forEach((id) => copy.delete(id));
            return copy;
          });
        }, 7000);
      }
      next.forEach((o) => knownIds.current.add(o.id));
      firstLoad.current = false;
      setOrders(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, [beep]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("yiannis_alert_sound");
      if (saved && ALERT_SOUNDS.some((s) => s.id === saved)) setSound(saved as AlertSoundId);
      if (localStorage.getItem("yiannis_alert_on") === "0") setSoundOn(false);
      if (localStorage.getItem("yiannis_alert_loud") === "0") setLoudMode(false);
      setVolume(getAlertVolume());
    } catch {}
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!s) return;
        setPaused(Boolean(s.paused));
        setBusyMinutes(Number(s.busyMinutes) || 0);
        setSoldOutNote(typeof s.soldOutNote === "string" && s.soldOutNote ? s.soldOutNote : null);
        setSoldOutDraft(typeof s.soldOutNote === "string" ? s.soldOutNote : "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => () => stopUrgent(), [stopUrgent]);

  function armSound() {
    setAudioReady(true);
    playAlert(sound);
  }

  function chooseSound(id: AlertSoundId) {
    setSound(id);
    try {
      localStorage.setItem("yiannis_alert_sound", id);
    } catch {}
    playAlert(id);
  }
  function toggleSound() {
    setSoundOn((on) => {
      try {
        localStorage.setItem("yiannis_alert_on", on ? "0" : "1");
      } catch {}
      return !on;
    });
  }
  function toggleLoud() {
    setLoudMode((v) => {
      try {
        localStorage.setItem("yiannis_alert_loud", v ? "0" : "1");
      } catch {}
      if (v) stopUrgent();
      return !v;
    });
  }
  function ack() {
    stopUrgent();
    setUnacked(0);
  }
  function changeVolume(v: number) {
    setVolume(v);
    setAlertVolume(v);
  }

  async function saveSettings(patchBody: Record<string, unknown>) {
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    }).catch(() => null);
    if (!res?.ok) setError("A switch didn't save — check the database is configured.");
    return res?.ok ?? false;
  }

  async function togglePause() {
    const next = !paused;
    if (next && !confirm("Pause online orders? Customers will be asked to call instead.")) return;
    setPaused(next);
    if (!(await saveSettings({ paused: next }))) setPaused(!next);
  }
  async function setBuffer(mins: number) {
    setBusyMinutes(mins);
    if (!(await saveSettings({ busyMinutes: mins }))) {
      load();
    }
  }
  async function publishSoldOut(note: string | null) {
    setSoldOutNote(note);
    await saveSettings({ soldOutNote: note });
  }

  async function patch(id: string, patchBody: Record<string, unknown>) {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const items = (patchBody.items as Item[] | undefined) ?? o.items;
        const total =
          patchBody.items && Array.isArray(patchBody.items)
            ? items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.quantity, 0)
            : o.total;
        return {
          ...o,
          ...(patchBody.status ? { status: patchBody.status as Order["status"] } : {}),
          ...(patchBody.waitMinutes !== undefined ? { wait_minutes: patchBody.waitMinutes as number | null } : {}),
          ...(patchBody.items ? { items, total } : {}),
        };
      })
    );
    try {
      const res = await fetch("/api/kitchen/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patchBody }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError("That change didn't save — reloading.");
      load();
    }
  }

  const fresh = orders.filter((o) => o.status === "new");
  const cooking = orders.filter((o) => o.status === "accepted");
  const done = orders.filter((o) => o.status === "collected" || o.status === "rejected");
  const queueMinutes = cooking.length ? Math.max(...cooking.map((o) => Math.floor((clock - new Date(o.created_at).getTime()) / 60000))) : 0;

  const pill = "press-btn rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold text-white/85 hover:border-amber";

  return (
    <StaffShell
      dark
      showAdmin={false}
      right={
        <>
          <span className="mr-1 font-serif text-2xl tabular-nums text-white/90">{wallNow}</span>
          {fresh.length > 0 && (
            <span className="rounded-full bg-ember px-3 py-1.5 text-xs font-extrabold text-white kb-new-flag">{fresh.length} incoming</span>
          )}
          {paused !== null && (
            <button
              type="button"
              onClick={togglePause}
              className={`press-btn rounded-full px-3 py-1.5 text-xs font-extrabold ${
                paused ? "bg-ember text-white" : "border border-white/20 text-white/85 hover:border-amber"
              }`}
            >
              {paused ? "Orders PAUSED — resume" : "Pause orders"}
            </button>
          )}
          <KitchenPushToggle className={pill} />
          <button type="button" onClick={toggleSound} className={pill}>
            {soundOn ? "Sound on" : "Sound off"}
          </button>
          <button type="button" onClick={() => setShowSounds((v) => !v)} className={pill}>
            Alerts
          </button>
        </>
      }
    >
      {unacked > 0 && (
        <div className="kb-urgentbar" role="alert">
          <span>
            {unacked} new order{unacked > 1 ? "s" : ""} — alarm on until you silence it
          </span>
          <button
            type="button"
            onClick={(e) => {
              igniteAt(e.currentTarget, 20, 0.8);
              bump();
              ack();
            }}
            className="press-btn press-btn--light rounded-full px-5 py-2 text-sm font-black"
          >
            Silence alarm
          </button>
        </div>
      )}

      {soundOn && !audioReady && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <button type="button" onClick={armSound} className="press-btn press-btn--accept px-6 py-3.5 text-center text-base font-black shadow-2xl">
            Enable kitchen alarm
          </button>
        </div>
      )}

      {showSounds && (
        <div className="border-b border-white/10 bg-char-800">
          <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">Alert — tap to hear it. Crank the tablet too.</p>
            <div className="mt-3 flex flex-wrap items-start gap-2">
              {ALERT_SOUNDS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => chooseSound(opt.id)}
                  className={`press-btn rounded-2xl border px-4 py-2.5 text-left ${
                    sound === opt.id ? "border-amber bg-amber/15" : "border-white/15 hover:border-white/40"
                  }`}
                >
                  <span className="block text-sm font-bold">{opt.label}</span>
                  <span className="block text-xs text-white/55">{opt.note}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
              <label className="flex items-center gap-3 text-sm font-bold text-white/85">
                Volume
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => changeVolume(Number(e.target.value))}
                  onPointerUp={() => playAlert(sound)}
                  className="h-1.5 w-44 cursor-pointer appearance-none rounded-full bg-white/20 accent-amber"
                  aria-label="Alert volume"
                />
              </label>
              <button
                type="button"
                onClick={toggleLoud}
                role="switch"
                aria-checked={loudMode}
                className={`press-btn rounded-full border px-4 py-2 text-sm font-extrabold ${
                  loudMode ? "border-ember bg-ember text-white shadow-[0_0_24px_rgba(255,90,30,.6)]" : "border-white/25 text-white/80"
                }`}
              >
                {loudMode ? "Repeats until silenced" : "Repeat alarm on new orders"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {error && (
          <p role="alert" className="mb-4 rounded-2xl bg-ember/15 px-4 py-3 text-sm font-semibold text-amber">
            {error}
          </p>
        )}

        <details className="mb-8 rounded-[22px] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <summary className="cursor-pointer text-xs font-extrabold uppercase tracking-[0.18em] text-white/55">
            Shop controls — pacing & sold out
          </summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/50">Adds to every wait</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {BUFFER_CHIPS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={(e) => {
                      igniteAt(e.currentTarget, 14, 0.7);
                      bump();
                      setBuffer(m);
                    }}
                    className={`press-btn rounded-full border px-4 py-2 text-sm font-extrabold ${
                      busyMinutes === m ? "border-amber bg-amber/20 text-amber" : "border-white/15 text-white/75 hover:border-white/40"
                    }`}
                  >
                    {m === 0 ? "On time" : `+${m} min`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/50">Sold out</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {SOLDOUT_QUICK.map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => setSoldOutDraft(`${x} is sold out tonight.`)}
                    className="press-btn rounded-full border border-white/15 px-3 py-1 text-xs font-bold text-white/70 hover:border-amber hover:text-amber"
                  >
                    {x}
                  </button>
                ))}
              </div>
              <div className="mt-2.5 flex gap-2">
                <input
                  value={soldOutDraft}
                  onChange={(e) => setSoldOutDraft(e.target.value.slice(0, 140))}
                  placeholder="e.g. Pork is sold out tonight."
                  className="min-w-0 flex-1 rounded-xl border border-white/15 bg-char-900 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-amber focus:outline-none"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    const note = soldOutDraft.trim();
                    if (!note) return;
                    igniteAt(e.currentTarget, 16, 0.8);
                    bump();
                    publishSoldOut(note);
                  }}
                  className="press-btn press-btn--light rounded-xl px-4 py-2 text-sm font-extrabold"
                >
                  Post
                </button>
                {soldOutNote && (
                  <button
                    type="button"
                    onClick={() => {
                      publishSoldOut(null);
                      setSoldOutDraft("");
                    }}
                    className="press-btn rounded-xl border border-white/20 px-4 py-2 text-sm font-bold text-white/75"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </details>

        {loading ? (
          <p className="py-24 text-center text-white/50">Loading orders…</p>
        ) : (
          <div className="grid gap-8 xl:grid-cols-2">
            <Column title="Incoming" count={fresh.length} tone="new" empty="Nothing waiting. New orders land here with the alarm.">
              {fresh.map((o) => (
                <OrderCard key={o.id} order={o} onPatch={patch} clock={clock} busy={busyMinutes} hot={hotIds.has(o.id)} />
              ))}
            </Column>
            <Column
              title="In progress"
              count={cooking.length}
              tone="cooking"
              empty="Accepted orders wait here until they're collected."
              note={cooking.length ? `oldest ${queueMinutes}m` : undefined}
            >
              {cooking.map((o) => (
                <OrderCard key={o.id} order={o} onPatch={patch} clock={clock} busy={busyMinutes} hot={false} />
              ))}
            </Column>
          </div>
        )}

        {done.length > 0 && (
          <details className="mt-10 rounded-2xl border border-white/10 p-4">
            <summary className="cursor-pointer text-sm font-bold text-white/60">Finished in the last day ({done.length})</summary>
            <ul className="mt-3 space-y-1.5">
              {done.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-3 text-sm text-white/60">
                  <span className={o.status === "rejected" ? "text-ember" : "text-green-400"}>{o.status === "rejected" ? "✕" : "✓"}</span>
                  <span className="font-bold text-white/85">{o.customer_name}</span>
                  <span>{o.pickup_time}</span>
                  {o.total != null && <span className="tabular-nums">{formatMoney(Number(o.total))}</span>}
                  {o.status === "collected" && (
                    <button type="button" className="press-btn text-xs font-bold text-amber underline" onClick={() => patch(o.id, { status: "accepted" })}>
                      undo
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>
    </StaffShell>
  );
}

function useWallClock() {
  const [s, setS] = useState("");
  useEffect(() => {
    const f = () =>
      setS(new Date().toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Adelaide" }));
    f();
    const t = window.setInterval(f, 15000);
    return () => window.clearInterval(t);
  }, []);
  return s;
}

function Column({
  title,
  count,
  tone,
  empty,
  note,
  children,
}: {
  title: string;
  count: number;
  tone: "new" | "cooking";
  empty: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="flex flex-wrap items-center gap-3 font-serif text-3xl">
        {title}
        <span
          key={count}
          className={`kb-count-pulse grid h-8 min-w-8 place-items-center rounded-full px-2 font-sans text-sm font-extrabold ${
            tone === "new" && count ? "bg-ember text-white shadow-[0_0_18px_rgba(255,90,30,.7)]" : "bg-white/10 text-white/70"
          }`}
        >
          {count}
        </span>
        {note && <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/40">{note}</span>}
      </h2>
      <div className="mt-4 grid gap-4">
        {count === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/45">{empty}</p> : children}
      </div>
    </section>
  );
}

function OrderCard({
  order,
  onPatch,
  clock,
  busy,
  hot,
}: {
  order: Order;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  clock: number;
  busy: number;
  hot: boolean;
}) {
  const isNew = order.status === "new";
  const [open, setOpen] = useState(false);
  const [wait, setWait] = useState(order.wait_minutes ?? DEFAULT_WAIT);
  const [lines, setLines] = useState(order.items);

  useEffect(() => {
    setLines(order.items);
    if (order.wait_minutes != null) setWait(order.wait_minutes);
  }, [order.items, order.wait_minutes]);

  const placed = new Date(order.created_at).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Adelaide",
  });
  const waitedMin = Math.max(0, Math.floor((clock - new Date(order.created_at).getTime()) / 60000));
  const told = (order.wait_minutes ?? 0) + busy;
  const etaClass = !isNew && order.wait_minutes != null ? (waitedMin > told + 3 ? "kb-eta is-late" : waitedMin >= told ? "kb-eta is-warm" : "kb-eta") : "kb-eta";
  const draftTotal = lines.reduce((s, i) => s + (i.unitPrice ?? 0) * i.quantity, 0);

  function setQty(index: number, qty: number) {
    const next = lines.map((item, i) => (i === index ? { ...item, quantity: Math.max(1, Math.min(99, qty)) } : item));
    setLines(next);
    if (!isNew) onPatch(order.id, { items: next });
  }

  function accept() {
    bump();
    onPatch(order.id, { status: "accepted", waitMinutes: wait, items: lines });
  }

  function reject() {
    if (confirm(`Cancel ${order.customer_name}'s order? Call them first.`)) {
      bump();
      onPatch(order.id, { status: "rejected" });
    }
  }

  return (
    <article
      className={`kb-card${hot ? " kb-card--new" : ""} rounded-[22px] border p-5 ${
        isNew
          ? "border-ember/60 bg-[linear-gradient(180deg,rgba(255,91,31,.14),rgba(255,91,31,.04))] shadow-[0_0_0_1px_rgba(255,91,31,.3),0_20px_50px_-20px_rgba(255,90,20,.5)]"
          : "border-blue-bright/40 bg-white/[0.04]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-serif text-[1.9rem] leading-none break-words">{order.customer_name}</p>
          <a href={`tel:${order.phone}`} className="mt-1 inline-block text-sm font-bold text-blue-sky">
            {order.phone}
          </a>
        </div>
        <div className="shrink-0 text-right">
          <span className={`rounded-full px-2.5 py-1 text-[0.7rem] font-extrabold uppercase tracking-wide ${isNew ? "bg-ember text-white" : "bg-blue text-white"}`}>
            {isNew ? "Incoming" : "In progress"}
          </span>
          <p className="mt-1.5 text-xs text-white/45">placed {placed}</p>
        </div>
      </div>

      <p className="mt-3 text-base">
        <span className="text-white/50">Pickup</span> <b>{order.pickup_time}</b>
        {!isNew && order.wait_minutes != null && (
          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${etaClass}`}>
            {waitedMin}m waited · told {order.wait_minutes}m{busy > 0 ? ` +${busy}` : ""}
          </span>
        )}
      </p>

      <ul className="mt-4 space-y-2.5 border-t border-white/10 pt-4">
        {lines.map((item, i) => (
          <li key={i} className="text-[1.02rem] leading-snug">
            <b className="text-amber">{item.quantity}×</b> <b>{item.name}</b>
            {(item.detail || item.notes) && (
              <span className={`block text-sm ${/no\s|NO\s/.test(item.detail ?? "") ? "font-bold text-amber" : "text-white/60"}`}>
                {item.detail ?? item.notes}
              </span>
            )}
          </li>
        ))}
      </ul>

      {order.order_notes && (
        <p className="mt-3 rounded-xl bg-amber/15 px-3 py-2 text-sm text-amber">
          <b>Note:</b> {order.order_notes}
        </p>
      )}
      {(order.total != null || draftTotal > 0) && (
        <p className="mt-3 flex justify-between border-t border-white/10 pt-3 text-sm text-white/60">
          <span>Pay at counter</span>
          <b className="font-serif text-xl font-normal text-gold tabular-nums">{formatMoney(Number(draftTotal || order.total || 0))}</b>
        </p>
      )}

      {isNew ? (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              igniteAt(e.currentTarget, 22, 0.9);
              accept();
            }}
            className="press-btn press-btn--accept col-span-1 min-h-[56px] text-lg"
          >
            Accept
          </button>
          <button type="button" onClick={reject} className="press-btn press-btn--reject min-h-[56px] text-lg">
            Reject
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            igniteAt(e.currentTarget, 26, 1);
            bump();
            onPatch(order.id, { status: "collected" });
          }}
          className="press-btn press-btn--accept mt-4 w-full min-h-[56px] text-lg"
        >
          Collected
        </button>
      )}

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="press-btn mt-3 w-full rounded-xl border border-white/15 px-4 py-2.5 text-left text-sm font-extrabold text-white/80"
      >
        {open ? "▾ Close extras" : "▸ Adjust — extra time, amount, cancel"}
      </button>

      {open && (
        <div className="mt-3 space-y-4 rounded-2xl border border-white/10 bg-black/25 p-3.5">
          <div>
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-white/45">
              {isNew ? "Prep time when you accept" : "Wait time"}
              {busy > 0 ? ` (+${busy} tonight)` : ""}
            </p>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {WAIT_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    bump();
                    setWait(mins);
                    if (!isNew) onPatch(order.id, { waitMinutes: mins });
                  }}
                  className={`press-btn rounded-xl border py-2.5 text-sm font-extrabold ${
                    wait === mins ? "border-amber bg-amber/20 text-amber" : "border-white/20 hover:border-amber"
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="press-btn h-11 w-11 rounded-full border border-white/20 text-lg"
                onClick={() => {
                  const next = Math.max(0, wait - 5);
                  setWait(next);
                  if (!isNew) onPatch(order.id, { waitMinutes: next });
                }}
              >
                −
              </button>
              <span className="min-w-[4.5rem] text-center font-bold tabular-nums">{wait} min</span>
              <button
                type="button"
                className="press-btn h-11 w-11 rounded-full border border-white/20 text-lg"
                onClick={() => {
                  const next = Math.min(240, wait + 5);
                  setWait(next);
                  if (!isNew) onPatch(order.id, { waitMinutes: next });
                }}
              >
                +
              </button>
              {[5, 10].map((m) => (
                <button
                  key={m}
                  type="button"
                  className="press-btn rounded-full border border-white/20 px-3 py-2 text-xs font-extrabold"
                  onClick={() => {
                    const next = Math.min(240, wait + m);
                    setWait(next);
                    if (!isNew) onPatch(order.id, { waitMinutes: next });
                  }}
                >
                  +{m}m extra
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-white/45">Amount</p>
            <ul className="mt-2 space-y-2">
              {lines.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{item.name}</span>
                  <button type="button" className="press-btn h-10 w-10 rounded-full border border-white/20" onClick={() => setQty(i, item.quantity - 1)}>
                    −
                  </button>
                  <span className="w-8 text-center font-extrabold tabular-nums">{item.quantity}</span>
                  <button type="button" className="press-btn h-10 w-10 rounded-full border border-white/20" onClick={() => setQty(i, item.quantity + 1)}>
                    +
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {isNew ? (
            <p className="text-xs text-white/45">Prep time and amounts save when you press Accept — nothing else accepts the order.</p>
          ) : (
            <button type="button" onClick={reject} className="press-btn press-btn--reject w-full min-h-[48px]">
              Cancel order
            </button>
          )}
        </div>
      )}
    </article>
  );
}
