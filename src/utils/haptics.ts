/**
 * iOS-style Haptic feedback and subtle physical tactile clicks.
 * Uses Web Audio API oscillator impulses + navigator.vibrate.
 */
class HapticEngine {
  private audioCtx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    // AudioContext will be lazily initialized on first user interaction
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public trigger(type: 'selection' | 'impactLight' | 'impactMedium' | 'impactHeavy' | 'success' | 'warning') {
    if (!this.enabled) return;

    // 1. Hardware vibration if supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        switch (type) {
          case 'selection':
            navigator.vibrate(8);
            break;
          case 'impactLight':
            navigator.vibrate(12);
            break;
          case 'impactMedium':
            navigator.vibrate(20);
            break;
          case 'impactHeavy':
            navigator.vibrate([25, 30, 25]);
            break;
          case 'success':
            navigator.vibrate([15, 40, 30]);
            break;
          case 'warning':
            navigator.vibrate([30, 30, 30]);
            break;
        }
      } catch (e) {
        // Ignored if permissions not granted
      }
    }

    // 2. iOS Taptic acoustic synthesis (clean micro-click impulses)
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'selection') {
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.015);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
        osc.start(now);
        osc.stop(now + 0.02);
      } else if (type === 'impactLight') {
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.03);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.start(now);
        osc.stop(now + 0.035);
      } else if (type === 'impactMedium' || type === 'impactHeavy') {
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.05);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.055);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.085);
      } else if (type === 'warning') {
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.06);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.065);
      }
    } catch (e) {
      // Audio might be blocked until user interacts
    }
  }
}

export const haptic = new HapticEngine();
