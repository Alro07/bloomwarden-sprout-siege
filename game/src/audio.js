// BLOOMWARDEN — Sprout Siege: every sound is synthesized with WebAudio —
// no audio files, nothing fetched. Short blips for actions, a soft plucked
// pentatonic loop for music. The engine stays silent until the player
// unlocks it with a first gesture (browsers require that).
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = 0;
    this.musicStep = 0;
    /** A gentle pentatonic walk, one pluck every 0.24 s. */
    this.melody = [523.25, 587.33, 659.25, 783.99, 880.0, 783.99, 659.25, 587.33,
      523.25, 659.25, 783.99, 1046.5, 880.0, 783.99, 659.25, 587.33];
    this.bass = [130.81, 130.81, 174.61, 196.0, 130.81, 196.0, 174.61, 130.81];
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  /** A single oscillator blip with a pitch slide and a fast decay. */
  blip(freqA, freqB, seconds, type, volume) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freqA, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), t + seconds);
    gain.gain.setValueAtTime(volume || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }

  shoot() { this.blip(720, 340, 0.09, 'triangle', 0.12); }
  hit() { this.blip(220, 140, 0.06, 'square', 0.08); }
  kill() { this.blip(520, 940, 0.12, 'sine', 0.16); }
  pickup() { this.blip(880, 1320, 0.1, 'sine', 0.14); }
  sun() { this.blip(1174, 1568, 0.12, 'sine', 0.12); }
  hurt() { this.blip(180, 70, 0.25, 'sawtooth', 0.22); }
  dash() { this.blip(300, 700, 0.12, 'sine', 0.1); }
  plant() { this.blip(392, 784, 0.16, 'triangle', 0.18); }
  wave() {
    this.blip(392, 392, 0.14, 'triangle', 0.18);
    if (this.ctx) setTimeout(() => this.blip(523, 523, 0.2, 'triangle', 0.18), 140);
  }

  levelup() {
    if (!this.ctx || this.muted) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      setTimeout(() => this.blip(f, f, 0.22, 'triangle', 0.18), i * 90);
    });
  }

  bossRoar() {
    this.blip(110, 45, 0.6, 'sawtooth', 0.25);
    this.blip(165, 60, 0.5, 'square', 0.12);
  }

  victory() {
    if (!this.ctx || this.muted) return;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      setTimeout(() => this.blip(f, f, 0.3, 'triangle', 0.18), i * 120);
    });
  }

  gameover() {
    this.blip(392, 392, 0.3, 'triangle', 0.16);
    if (this.ctx) setTimeout(() => this.blip(311, 220, 0.5, 'triangle', 0.16), 280);
  }

  /** Called every frame with dt: steps the music loop when unlocked. */
  update(dt) {
    if (!this.ctx || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.24;
    const note = this.melody[this.musicStep % this.melody.length];
    this.blip(note, note, 0.22, 'sine', 0.05);
    if (this.musicStep % 4 === 0) {
      const bass = this.bass[(this.musicStep / 4) % this.bass.length];
      this.blip(bass, bass, 0.4, 'sine', 0.07);
    }
    this.musicStep += 1;
  }
}
