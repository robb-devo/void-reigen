// Commander progression: XP from goals/trophies/conquests/warps → levels → skill points.
// Skills persist through warps (they belong to the Commander, not the sector).
export type Skill = { id: string; br: number; tier: number; name: string; art: string; desc: string };
export const BRANCHES = [
  { name: 'Mining', color: '#ff9f43', art: 'drill' },
  { name: 'Industry', color: '#5cf2ff', art: 'smelter' },
  { name: 'Fleet', color: '#ff7bd5', art: 'cruiser' },
  { name: 'Logistics', color: '#5cff9d', art: 'p1' },
];
export const LEVEL_GATE = [2, 4, 7, 10];
export const SKILLS: Skill[] = [
  { id: 'mHand', br: 0, tier: 0, name: 'Hand Crank', art: 'drill', desc: 'Tapping a running mine shoves it 35% closer to payout' },
  { id: 'mVein', br: 0, tier: 1, name: 'Rich Veins', art: 'iron', desc: 'Mines dig double ore' },
  { id: 'mAuto', br: 0, tier: 2, name: 'Self-Starters', art: 'crystal', desc: 'Every mine restarts itself – no foreman needed' },
  { id: 'mLode', br: 0, tier: 3, name: 'Motherlode', art: 'star', desc: '1 in 25 mine payouts strikes a ×10 motherlode' },
  { id: 'iOver', br: 1, tier: 0, name: 'Overclock', art: 'smelter', desc: 'Factories run 50% faster' },
  { id: 'iNight', br: 1, tier: 1, name: 'Night Shift', art: 'gen', desc: 'Factories run double speed after dark' },
  { id: 'iLean', br: 1, tier: 2, name: 'Lean Recipes', art: 'press', desc: 'Recipes need 25% fewer inputs' },
  { id: 'iGrid', br: 1, tier: 3, name: 'Grid Sync', art: 'fab', desc: 'Power shortages never drop factories below 75%' },
  { id: 'fEsc', br: 2, tier: 0, name: 'Escorts', art: 'scout', desc: '+10% mission success chance' },
  { id: 'fLife', br: 2, tier: 1, name: 'Lifeboats', art: 'barge', desc: 'Half of all ship losses make it home' },
  { id: 'fBurn', br: 2, tier: 2, name: 'Afterburners', art: 'cruiser', desc: 'Missions fly 25% faster' },
  { id: 'fDock', br: 2, tier: 3, name: 'Extra Dock', art: 'dread', desc: '+1 simultaneous mission' },
  { id: 'lTrade', br: 3, tier: 0, name: 'Trade Contacts', art: 'chip', desc: 'Exports sell for 50% more' },
  { id: 'lAuto', br: 3, tier: 1, name: 'Auto-Export', art: 'alloy', desc: 'Unlock auto-selling of surplus goods at HQ' },
  { id: 'lCold', br: 3, tier: 2, name: 'Cold Storage', art: 'ice', desc: 'Offline earnings cap +8 hours' },
  { id: 'lDrop', br: 3, tier: 3, name: 'Supply Drops', art: 'p1', desc: 'Every finished mission also brings back 2 min of income' },
];
export const xpFor = (lv: number) => Math.round(40 * Math.pow(lv, 1.5)); // xp needed to go lv → lv+1
export function levelOf(xp: number) { let lv = 1; while (xp >= xpFor(lv)) { xp -= xpFor(lv); lv++; } return { lv, into: xp, need: xpFor(lv) }; }
export const XP = { goal: (i: number) => 15 + 3 * Math.min(i, 60), ach: 10, conquer: 40, warp: 150 };
