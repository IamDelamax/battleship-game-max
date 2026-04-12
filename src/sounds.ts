let audioCtx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(val: boolean) {
  muted = val;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  if (muted) return;
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export function playHitSound() {
  playTone(880, 0.15, 'square', 0.1);
  setTimeout(() => playTone(1100, 0.1, 'square', 0.08), 60);
}

export function playMissSound() {
  playTone(200, 0.25, 'sine', 0.08);
}

export function playSunkSound() {
  if (muted) return;
  playTone(800, 0.12, 'square', 0.1);
  setTimeout(() => playTone(600, 0.12, 'square', 0.09), 100);
  setTimeout(() => playTone(400, 0.12, 'square', 0.08), 200);
  setTimeout(() => playTone(300, 0.3, 'sawtooth', 0.07), 300);
}

export function playPlaceSound() {
  playTone(440, 0.08, 'sine', 0.06);
}

export function playStartSound() {
  if (muted) return;
  playTone(523, 0.1, 'square', 0.08);
  setTimeout(() => playTone(659, 0.1, 'square', 0.08), 100);
  setTimeout(() => playTone(784, 0.15, 'square', 0.1), 200);
}

export function playGameOverSound(won: boolean) {
  if (muted) return;
  if (won) {
    playTone(523, 0.15, 'square', 0.1);
    setTimeout(() => playTone(659, 0.15, 'square', 0.1), 150);
    setTimeout(() => playTone(784, 0.15, 'square', 0.1), 300);
    setTimeout(() => playTone(1047, 0.3, 'square', 0.12), 450);
  } else {
    playTone(400, 0.2, 'sawtooth', 0.08);
    setTimeout(() => playTone(350, 0.2, 'sawtooth', 0.07), 200);
    setTimeout(() => playTone(300, 0.3, 'sawtooth', 0.06), 400);
    setTimeout(() => playTone(200, 0.5, 'sawtooth', 0.05), 600);
  }
}
