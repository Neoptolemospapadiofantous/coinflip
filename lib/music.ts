// Background music manager using Web Audio API
// Generates ambient synthwave/cyberpunk music

class MusicManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying: boolean = false;
  private enabled: boolean = false;
  private volume: number = 0.3;
  private oscillators: OscillatorNode[] = [];
  private intervalIds: NodeJS.Timeout[] = [];

  private init() {
    if (this.audioContext || typeof window === 'undefined') return;

    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = this.volume;
    } catch {
      // Web Audio API not supported
    }
  }

  private createOscillator(frequency: number, type: OscillatorType, gainValue: number): OscillatorNode | null {
    if (!this.audioContext || !this.masterGain) return null;

    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = gainValue;

    oscillator.connect(gain);
    gain.connect(this.masterGain);

    return oscillator;
  }

  private startAmbientLoop() {
    if (!this.audioContext || !this.masterGain) return;

    // Clear any existing loops first to prevent duplicates
    this.stopAllSounds();

    // Bass drone - low frequency pad
    const bassFreqs = [55, 65.41, 73.42, 82.41]; // A1, C2, D2, E2
    let bassIndex = 0;

    const playBass = () => {
      if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.value = bassFreqs[bassIndex];
      bassIndex = (bassIndex + 1) % bassFreqs.length;

      filter.type = 'lowpass';
      filter.frequency.value = 200;

      gain.gain.setValueAtTime(0, this.audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, this.audioContext.currentTime + 0.5);
      gain.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 3);
      gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.audioContext.currentTime + 4);
    };

    // Arpeggio pattern
    const arpNotes = [261.63, 329.63, 392, 523.25, 392, 329.63]; // C4, E4, G4, C5, G4, E4
    let arpIndex = 0;

    const playArp = () => {
      if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'triangle';
      osc.frequency.value = arpNotes[arpIndex];
      arpIndex = (arpIndex + 1) % arpNotes.length;

      gain.gain.setValueAtTime(0, this.audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, this.audioContext.currentTime + 0.02);
      gain.gain.linearRampToValueAtTime(0.04, this.audioContext.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.audioContext.currentTime + 0.3);
    };

    // Pad/atmosphere
    const playPad = () => {
      if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

      const frequencies = [130.81, 164.81, 196]; // C3, E3, G3 chord

      frequencies.forEach((freq, i) => {
        const osc = this.audioContext!.createOscillator();
        const gain = this.audioContext!.createGain();
        const filter = this.audioContext!.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.value = freq;

        filter.type = 'lowpass';
        filter.frequency.value = 800;

        const startTime = this.audioContext!.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.05, startTime + 1);
        gain.gain.linearRampToValueAtTime(0.03, startTime + 4);
        gain.gain.linearRampToValueAtTime(0, startTime + 6);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(startTime);
        osc.stop(startTime + 6);
      });
    };

    // Start loops
    playBass();
    playPad();

    this.intervalIds.push(setInterval(playBass, 4000));
    this.intervalIds.push(setInterval(playArp, 300));
    this.intervalIds.push(setInterval(playPad, 8000));
  }

  private stopAllSounds() {
    // Clear all intervals
    this.intervalIds.forEach(id => clearInterval(id));
    this.intervalIds = [];

    // Stop all oscillators
    this.oscillators.forEach(osc => {
      try {
        osc.stop();
      } catch {
        // Already stopped
      }
    });
    this.oscillators = [];
  }

  play() {
    if (this.isPlaying || !this.enabled) return;

    this.init();
    if (!this.audioContext) return;

    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.isPlaying = true;
    this.startAmbientLoop();
  }

  pause() {
    this.isPlaying = false;
    this.stopAllSounds();
  }

  toggle(): boolean {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
    return this.isPlaying;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled && !this.isPlaying) {
      this.play();
    } else if (!enabled && this.isPlaying) {
      this.pause();
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  isEnabled() {
    return this.enabled;
  }

  getIsPlaying() {
    return this.isPlaying;
  }
}

// Export singleton instance
export const musicManager = new MusicManager();
