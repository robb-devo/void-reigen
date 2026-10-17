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
