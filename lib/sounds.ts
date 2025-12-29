// Sound effects using Web Audio API (no external files needed)
// Generates synthesized sounds for game feedback

class SoundManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;
  private initialized: boolean = false;

  // Initialize audio context on first user interaction
  private init() {
    if (this.initialized || typeof window === 'undefined') return;

    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.initialized = true;
    } catch {
      // Web Audio API not supported
      this.initialized = true;
    }
  }

  // Play a synthesized tone
  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
    this.init();
    if (!this.audioContext || !this.enabled) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

      // Envelope: quick attack, sustain, fade out
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(volume * 0.7, this.audioContext.currentTime + duration * 0.5);
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch {
      // Silently fail
    }
  }

  // Play a sequence of tones
  private playSequence(notes: Array<{ freq: number; dur: number; delay: number }>, type: OscillatorType = 'sine', volume: number = 0.3) {
    notes.forEach(note => {
      setTimeout(() => this.playTone(note.freq, note.dur, type, volume), note.delay * 1000);
    });
  }

  // Coin flip sound - metallic spinning
  coinFlip() {
    if (!this.enabled) return;
    this.init();

    // Quick ascending tones simulating coin spin
    const notes = [
      { freq: 800, dur: 0.05, delay: 0 },
      { freq: 1000, dur: 0.05, delay: 0.08 },
      { freq: 1200, dur: 0.05, delay: 0.16 },
      { freq: 1400, dur: 0.05, delay: 0.24 },
      { freq: 1600, dur: 0.08, delay: 0.32 },
    ];
    this.playSequence(notes, 'triangle', 0.2);
  }

  // Win sound - triumphant ascending arpeggio
  win() {
    if (!this.enabled) return;
    this.init();

    const notes = [
      { freq: 523, dur: 0.15, delay: 0 },      // C5
      { freq: 659, dur: 0.15, delay: 0.1 },    // E5
      { freq: 784, dur: 0.15, delay: 0.2 },    // G5
      { freq: 1047, dur: 0.3, delay: 0.3 },    // C6
    ];
    this.playSequence(notes, 'sine', 0.4);
  }

  // Loss sound - descending minor
  loss() {
    if (!this.enabled) return;
    this.init();

    const notes = [
      { freq: 440, dur: 0.2, delay: 0 },       // A4
      { freq: 349, dur: 0.3, delay: 0.15 },    // F4
    ];
    this.playSequence(notes, 'sine', 0.25);
  }

  // Click sound - short blip
  click() {
    if (!this.enabled) return;
    this.playTone(1000, 0.05, 'sine', 0.15);
  }

  // Success sound - pleasant confirmation
  success() {
    if (!this.enabled) return;
    this.init();

    const notes = [
      { freq: 880, dur: 0.1, delay: 0 },
      { freq: 1100, dur: 0.15, delay: 0.08 },
    ];
    this.playSequence(notes, 'sine', 0.3);
  }

  // Error sound - low buzz
  error() {
    if (!this.enabled) return;
    this.init();

    const notes = [
      { freq: 200, dur: 0.15, delay: 0 },
      { freq: 180, dur: 0.2, delay: 0.1 },
    ];
    this.playSequence(notes, 'sawtooth', 0.2);
  }

  // Match sound - opponent found
  match() {
    if (!this.enabled) return;
    this.init();

    const notes = [
      { freq: 660, dur: 0.1, delay: 0 },
      { freq: 880, dur: 0.1, delay: 0.1 },
      { freq: 1100, dur: 0.15, delay: 0.2 },
    ];
    this.playSequence(notes, 'sine', 0.35);
  }

  // Countdown sound - tick
  countdown() {
    if (!this.enabled) return;
    this.playTone(800, 0.08, 'sine', 0.2);
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled() {
    return this.enabled;
  }
}

// Export singleton instance
export const soundManager = new SoundManager();

// Convenience functions
export const playSound = {
  coinFlip: () => soundManager.coinFlip(),
  win: () => soundManager.win(),
  loss: () => soundManager.loss(),
  click: () => soundManager.click(),
  success: () => soundManager.success(),
  error: () => soundManager.error(),
  match: () => soundManager.match(),
  countdown: () => soundManager.countdown(),
};
