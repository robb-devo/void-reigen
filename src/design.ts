// Void Reigen design tokens — the single source of truth for canvas art AND the DOM (see design.css).
// Chunky rounded shapes · thick ink outlines · bevel + inner highlight · saturated palette · outlined display type.
export const T = {
  ink: '#24163a', inkDeep: '#120a24',
  gold: '#ffd23f', goldHi: '#fff1a8', goldLo: '#e8941a',
  mint: '#5cff9d', cyan: '#5cf2ff', pink: '#ff7bd5', red: '#ff5b5b', violet: '#b06bff', orange: '#ff9f43',
  panel: '#3a2c6c', panelLo: '#24183f', panelHi: '#5a4a9a',
  outline: 3, radius: { s: 10, m: 14, l: 18, xl: 24 },
  font: 'Fredoka, Nunito, sans-serif',
};
/** Draw outlined display text on canvas — same look as the DOM `.tx` style. */
export function outlinedText(c: CanvasRenderingContext2D, txt: string, x: number, y: number, size: number, fill = '#fff', stroke = T.ink) {
  c.font = `700 ${size}px ${T.font}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.lineWidth = Math.max(3, size * .28); c.strokeStyle = stroke; c.strokeText(txt, x, y + size * .08); c.strokeText(txt, x, y); c.fillStyle = fill; c.fillText(txt, x, y);
}
const sv = (b: string) => `<svg class="ic" viewBox="0 0 24 24">${b}</svg>`;
const K = 'stroke="#24163a" stroke-width="2" stroke-linejoin="round"';
/** Inline icon set — replaces every emoji in the UI. Same outline weight as the art. */
export const I = {
  bolt: sv(`<path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#ffd23f" ${K}/>`),
  sword: sv(`<path d="M14 3h7v7L10 21l-3-3z" fill="#dfe6ff" ${K}/><path d="M4 15l5 5M3 21l3-3" fill="none" ${K} stroke-linecap="round"/>`),
  flag: sv(`<path d="M5 21V3" ${K} stroke-linecap="round"/><path d="M6 4h12l-3 4 3 4H6z" fill="#5cff9d" ${K}/>`),
  lock: sv(`<rect x="5" y="10" width="14" height="11" rx="3" fill="#8b84b0" ${K}/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" ${K}/>`),
  bot: sv(`<rect x="5" y="7" width="14" height="12" rx="4" fill="#5cf2ff" ${K}/><circle cx="9.5" cy="13" r="1.6" fill="#24163a"/><circle cx="14.5" cy="13" r="1.6" fill="#24163a"/><path d="M12 7V3" ${K}/><circle cx="12" cy="3" r="1.5" fill="#ff5b5b"/>`),
  coin: sv(`<circle cx="12" cy="12" r="9" fill="#ffd23f" ${K}/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" fill="none" stroke="#b86a10" stroke-width="1.8"/>`),
  flask: sv(`<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" fill="#7affd1" ${K}/>`),
  boom: sv(`<path d="M12 2l2 6 6-3-3 6 5 2-6 2 2 6-6-4-6 4 2-6-6-2 5-2-3-6 6 3z" fill="#ff9f43" ${K}/>`),
  warp: sv(`<circle cx="12" cy="12" r="9" fill="#b06bff" ${K}/><path d="M12 6a6 6 0 1 1-6 6 3 3 0 1 1 6 0" fill="none" stroke="#fff" stroke-width="2"/>`),
  trash: sv(`<path d="M5 7h14l-1 14H6z" fill="#ff5b5b" ${K}/><path d="M3 7h18M9 7V4h6v3" fill="none" ${K}/>`),
  trophy: sv(`<path d="M7 3h10v4a5 5 0 0 1-10 0z" fill="#ffd23f" ${K}/><path d="M10 12h4v4h-4zM8 17h8v3H8z" fill="#ff9f43" ${K}/>`),
  check: sv(`<path d="M4 13l5 5L20 6" fill="none" stroke="#5cff9d" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`),
};
