// Native (Capacitor / Android) glue. On the web every function here is a no-op or falls back to browser APIs.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
export const isNative = Capacitor.isNativePlatform();

/** Haptics: short taps map to native impacts, patterns to a few spaced impacts; browsers use navigator.vibrate. */
export function vibrate(p: number | number[]) {
  if (!isNative) { try { navigator.vibrate?.(p); } catch {} return; }
  const seq = Array.isArray(p) ? p : [p]; let t = 0;
  seq.forEach((ms, i) => { if (i % 2 === 0) { const style = ms >= 40 ? ImpactStyle.Heavy : ms >= 15 ? ImpactStyle.Medium : ImpactStyle.Light; setTimeout(() => { Haptics.impact({ style }).catch(() => {}); }, t); } t += ms; });
}

/** The save lives in localStorage (works in the app's WebView). It is also mirrored to native Preferences so it
 *  survives the WebView ever dropping its storage; on boot an empty localStorage is restored from the mirror. */
export async function restoreSave(key: string) {
  if (!isNative) return; try { if (localStorage.getItem(key)) return; const { value } = await Preferences.get({ key }); if (value) localStorage.setItem(key, value); } catch {}
}
let mirrorT = 0;
export function mirrorSave(key: string, value: string) { if (!isNative) return; const now = Date.now(); if (now - mirrorT < 5000) return; mirrorT = now; Preferences.set({ key, value }).catch(() => {}); }
export function mirrorNow(key: string) { if (!isNative) return; const v = localStorage.getItem(key); if (v) { mirrorT = Date.now(); Preferences.set({ key, value: v }).catch(() => {}); } }
