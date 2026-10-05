// lib/alertSounds.ts
//
// Kitchen alerts generated in Web Audio — no files to 404. Built to punch
// through a charcoal grill, extractor fan and a Hindley Street Friday.

export type AlertSoundId = "alarm" | "siren" | "triple" | "klaxon" | "double" | "bell" | "chime";

export const ALERT_SOUNDS: { id: AlertSoundId; label: string; note: string }[] = [
  { id: "alarm", label: "Fire alarm", note: "Default. Smoke-alarm pitch, clipped hard. Loudest." },
  { id: "siren", label: "Wake-the-dead siren", note: "Relentless two-tone + noise." },
  { id: "klaxon", label: "Klaxon", note: "Harsh falling buzzer." },
  { id: "triple", label: "Triple pulse", note: "Three hard hits." },
  { id: "double", label: "Double beep", note: "Clear, less aggressive." },
  { id: "bell", label: "Counter bell", note: "Sharp ding." },
  { id: "chime", label: "Rising chime", note: "Quiet rooms only." },
];

export const DEFAULT_SOUND: AlertSoundId = "alarm";

const VOL_KEY = "yiannis_alert_vol";

export function getAlertVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOL_KEY));
    if (Number.isFinite(v)) return Math.min(1, Math.max(0.05, v));
  } catch {}
  return 1;
}

export function setAlertVolume(v: number): void {
  try {
    localStorage.setItem(VOL_KEY, String(Math.min(1, Math.max(0.05, v))));
  } catch {}
}

let shared: AudioContext | null = null;

function ctx(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!shared || shared.state === "closed") shared = new Ctor();
    if (shared.state === "suspended") void shared.resume();
    return shared;
  } catch {
    return null;
  }
}

// Hard-clip curve: square-ish waves pushed past full scale come out as loud
// as the speaker can go — perceived loudness, not just peak level.
let clipCurve: Float32Array | null = null;
function clip(ac: AudioContext): WaveShaperNode {
  if (!clipCurve) {
    clipCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      clipCurve[i] = Math.max(-0.92, Math.min(0.92, x * 3));
    }
  }
  const ws = ac.createWaveShaper();
  ws.curve = clipCurve;
  return ws;
}

function chain(ac: AudioContext, drive = false) {
  const vol = ac.createGain();
  vol.gain.value = Math.min(1, getAlertVolume() * 1.15);
  if (drive) {
    // Volume still sets the level AFTER the clipper, so the slider works.
    const pre = ac.createGain();
    pre.gain.value = 2.5;
    const ws = clip(ac);
    pre.connect(ws);
    ws.connect(vol);
    vol.connect(ac.destination);
    return pre;
  }
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 6;
  comp.ratio.value = 14;
  comp.attack.value = 0.002;
  comp.release.value = 0.08;
  vol.connect(comp);
  comp.connect(ac.destination);
  return vol;
}

function tone(
  ac: AudioContext,
  dest: AudioNode,
  at: number,
  freq: number,
  duration: number,
  type: OscillatorType = "square",
  peak = 0.85
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  osc.connect(gain);
  gain.connect(dest);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.05, peak), at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.start(at);
  osc.stop(at + duration + 0.03);
}

function sweep(ac: AudioContext, dest: AudioNode, at: number, from: number, to: number, duration: number, peak = 0.9) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.linearRampToValueAtTime(to, at + duration);
  osc.connect(gain);
  gain.connect(dest);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.start(at);
  osc.stop(at + duration + 0.03);
}

function noiseBurst(ac: AudioContext, dest: AudioNode, at: number, duration: number, peak = 0.55) {
  const n = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2800;
  bp.Q.value = 0.7;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(peak, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  src.connect(bp);
  bp.connect(gain);
  gain.connect(dest);
  src.start(at);
  src.stop(at + duration + 0.02);
}

/** Play an alert. Safe to call anywhere — failures are swallowed. */
export function playAlert(id: AlertSoundId = DEFAULT_SOUND): void {
  try {
    const ac = ctx();
    if (!ac) return;
    const dest = chain(ac, id === "alarm" || id === "siren" || id === "klaxon");
    const t = ac.currentTime + 0.01;

    switch (id) {
      case "alarm": {
        // Smoke-alarm territory (~3.1kHz, where hearing peaks and kitchen
        // rumble doesn't reach), chopped at 8 beats a second with a dissonant
        // partner tone. Just under 1.5s, so the loop is close to continuous.
        for (let i = 0; i < 12; i++) {
          const at = t + i * 0.12;
          const f = i % 2 ? 3500 : 2900;
          tone(ac, dest, at, f, 0.085, "square", 1);
          tone(ac, dest, at, f * 1.06, 0.085, "sawtooth", 0.6);
        }
        noiseBurst(ac, dest, t, 0.08, 0.6);
        break;
      }
      case "siren": {
        // Four two-tone hits plus a noise slap. Hard to talk over, harder to ignore.
        for (let i = 0; i < 4; i++) {
          const at = t + i * 0.28;
          noiseBurst(ac, dest, at, 0.07, 0.7);
          tone(ac, dest, at, 880, 0.12, "square", 0.95);
          tone(ac, dest, at, 1760, 0.12, "square", 0.55);
          tone(ac, dest, at + 0.13, 1175, 0.13, "square", 0.95);
          tone(ac, dest, at + 0.13, 2349, 0.13, "square", 0.55);
        }
        break;
      }
      case "klaxon":
        sweep(ac, dest, t, 1600, 520, 0.28, 0.95);
        sweep(ac, dest, t + 0.32, 1600, 520, 0.34, 0.95);
        noiseBurst(ac, dest, t, 0.12, 0.45);
        break;
      case "triple":
        tone(ac, dest, t, 2700, 0.12, "square", 0.9);
        tone(ac, dest, t + 0.16, 2700, 0.12, "square", 0.9);
        tone(ac, dest, t + 0.32, 2700, 0.22, "square", 1);
        break;
      case "double":
        tone(ac, dest, t, 1800, 0.14, "square", 0.85);
        tone(ac, dest, t + 0.2, 2400, 0.24, "square", 0.9);
        break;
      case "bell":
        tone(ac, dest, t, 3100, 0.5, "sine", 0.7);
        tone(ac, dest, t + 0.005, 4300, 0.38, "sine", 0.35);
        break;
      case "chime":
        tone(ac, dest, t, 1320, 0.16, "sine", 0.5);
        tone(ac, dest, t + 0.14, 1760, 0.16, "sine", 0.5);
        tone(ac, dest, t + 0.28, 2640, 0.42, "sine", 0.5);
        break;
    }
  } catch {
    // A missing alert should never break the board.
  }
}

/**
 * Repeat an alert until ACK. Returns the stop function.
 */
/** A short, bright "done" for a confirmed tap — the reward, not the alarm. */
export function playConfirm(): void {
  try {
    const ac = ctx();
    if (!ac) return;
    const dest = chain(ac);
    const t = ac.currentTime + 0.01;
    noiseBurst(ac, dest, t, 0.03, 0.25);
    tone(ac, dest, t, 1047, 0.12, "triangle", 0.7);
    tone(ac, dest, t + 0.08, 1568, 0.28, "triangle", 0.75);
    tone(ac, dest, t + 0.08, 2093, 0.22, "sine", 0.3);
  } catch {}
}

export function startUrgentLoop(id: AlertSoundId = DEFAULT_SOUND, everyMs = 1500): () => void {
  let stopped = false;
  const beat = () => {
    if (stopped) return;
    playAlert(id);
    t = window.setTimeout(beat, everyMs);
  };
  let t = 0;
  beat();
  return () => {
    stopped = true;
    window.clearTimeout(t);
  };
}
