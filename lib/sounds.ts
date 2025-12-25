// Sound effects using HTML5 Audio API
// Note: Sound files would need to be added to public/sounds/ directory
// Sounds are lazy-loaded on first play to avoid 404 errors if files don't exist

class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private failedSounds: Set<string> = new Set();
  private enabled: boolean = true;

  // Sound file paths
  private readonly soundFiles: Record<string, string> = {
    coinFlip: '/sounds/coin-flip.mp3',
    win: '/sounds/win.mp3',
    loss: '/sounds/loss.mp3',
    click: '/sounds/click.mp3',
    success: '/sounds/success.mp3',
    error: '/sounds/error.mp3',
    match: '/sounds/match.mp3',
    countdown: '/sounds/countdown.mp3',
  };

  // Lazy load a sound on first play
  private getOrLoadSound(name: string): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (this.failedSounds.has(name)) return null;

    let sound = this.sounds.get(name);
    if (sound) return sound;

    const path = this.soundFiles[name];
    if (!path) return null;

    try {
      sound = new Audio(path);
      sound.preload = 'auto';

      // Handle loading errors
      sound.addEventListener('error', () => {
        this.sounds.delete(name);
        this.failedSounds.add(name);
      });

      this.sounds.set(name, sound);
      return sound;
    } catch {
      this.failedSounds.add(name);
      return null;
    }
  }

  play(soundName: string, volume: number = 0.5) {
    if (!this.enabled) return;

    const sound = this.getOrLoadSound(soundName);
    if (!sound) return;

    try {
      sound.volume = volume;
      sound.currentTime = 0;
      sound.play().catch((err) => {
        // Silently fail if autoplay is blocked or sound unavailable
        if (err.name !== 'NotAllowedError' && err.name !== 'NotSupportedError') {
          // Sound file doesn't exist or failed to load - silently ignore
        }
      });
    } catch {
      // Silently ignore errors
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
