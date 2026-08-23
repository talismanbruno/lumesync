import { getAudioPreferences } from '@/lib/audioPreferences';

type LumeSound = 'call' | 'message' | 'join' | 'leave';

export function playLumeSound(sound: LumeSound): void {
  if (!getAudioPreferences().callSounds || typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const patterns: Record<LumeSound, number[]> = {
    call: [520, 700, 880],
    message: [740, 940],
    join: [440, 660],
    leave: [660, 390]
  };
  patterns[sound].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * 0.09;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(sound === 'call' ? 0.075 : 0.045, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.12);
  });
  window.setTimeout(() => void context.close(), 650);
}

export function showDesktopNotification(title: string, body: string, tag: string): void {
  const preferences = getAudioPreferences();
  if (!preferences.desktopNotifications || document.visibilityState === 'visible') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const notification = new Notification(title, { body, tag, icon: '/favicon.png' });
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

