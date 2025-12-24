// Sound effects using HTML5 Audio API
// Note: Sound files would need to be added to public/sounds/ directory

class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = true;

  constructor() {
    // Only initialize in browser environment
    if (typeof window !== 'undefined') {
      this.loadSounds();
    }
  }

  private loadSounds() {
    // Define sound effects
    const soundFiles = {
      coinFlip: '/sounds/coin-flip.mp3',
      win: '/sounds/win.mp3',
      loss: '/sounds/loss.mp3',
      click: '/sounds/click.mp3',
      success: '/sounds/success.mp3',
      error: '/sounds/error.mp3',
      match: '/sounds/match.mp3',
      countdown: '/sounds/countdown.mp3',
    };

    // Preload sounds
    Object.entries(soundFiles).forEach(([name, path]) => {
      const audio = new Audio(path);
      audio.preload = 'auto';
      this.sounds.set(name, audio);
    });
  }

  play(soundName: string, volume: number = 0.5) {
    if (!this.enabled) return;

    const sound = this.sounds.get(soundName);
    if (sound) {
      sound.volume = volume;
      sound.currentTime = 0;
      sound.play().catch(() => {
        // Silently fail if autoplay is blocked
      });
    }
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
  coinFlip: () => soundManager.play('coinFlip', 0.6),
  win: () => soundManager.play('win', 0.7),
  loss: () => soundManager.play('loss', 0.5),
  click: () => soundManager.play('click', 0.3),
  success: () => soundManager.play('success', 0.5),
  error: () => soundManager.play('error', 0.5),
  match: () => soundManager.play('match', 0.6),
  countdown: () => soundManager.play('countdown', 0.4),
};

// For now, we'll use beep sounds as fallback until actual sound files are added
// You can replace these with actual sound files in public/sounds/
