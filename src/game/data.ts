// Pure game data. New content = new entries here; logic reads it generically.
export type Res = 'ore' | 'quartz' | 'ingot' | 'glass' | 'part' | 'alloy' | 'chip' | 'hull';
export const RES_ORDER: Res[] = ['ore', 'quartz', 'ingot', 'glass', 'part', 'alloy', 'chip', 'hull'];
export const RES: Record<Res, { name: string; e: string; color: string; price: number }> = {
  ore: { name: 'Iron Ore', e: '🟠', color: '#ff9f43', price: 0.5 },
  quartz: { name: 'Quartz', e: '🔷', color: '#5cc8ff', price: 0.8 },
  ingot: { name: 'Ingots', e: '🟨', color: '#ffd84a', price: 3 },
  glass: { name: 'Glass', e: '🧪', color: '#8affd8', price: 4.5 },
  part: { name: 'Parts', e: '⚙️', color: '#c6d4ff', price: 25 },
  alloy: { name: 'Alloy', e: '🟪', color: '#c78bff', price: 32 },
  chip: { name: 'Chips', e: '💠', color: '#7ee8ff', price: 320 },
  hull: { name: 'Hull Plates', e: '🛡️', color: '#ff7a9c', price: 950 },
};

export type MineDef = { id: string; name: string; e: string; hue: number; cost: number; g: number; rev: number; t: number; ore: number; res: Res; mgr: number; mname: string };
export const MINES: MineDef[] = [
  { id: 'drill', name: 'Pebble Drill', e: '⛏️', hue: 30, cost: 4, g: 1.12, rev: 1, t: 0.6, ore: 0.25, res: 'ore', mgr: 1e3, mname: 'Rusty the Bot' },
  { id: 'ice', name: 'Quartz Comet Harvester', e: '🧊', hue: 195, cost: 60, g: 1.18, rev: 60, t: 4, ore: 1, res: 'quartz', mgr: 25e3, mname: 'Frosty Vega' },
  { id: 'iron', name: 'Iron Asteroid Rig', e: '🪨', hue: 15, cost: 720, g: 1.18, rev: 540, t: 10, ore: 5, res: 'ore', mgr: 3e5, mname: 'Ferro Max' },
  { id: 'crystal', name: 'Crystal Laser Array', e: '💎', hue: 280, cost: 8640, g: 1.175, rev: 4320, t: 30, ore: 18, res: 'quartz', mgr: 3e6, mname: 'Dr. Prism' },
  { id: 'plasma', name: 'Plasma Excavator', e: '🔥', hue: 340, cost: 103680, g: 1.17, rev: 51840, t: 75, ore: 70, res: 'ore', mgr: 4e7, mname: 'Blaze Kowalski' },
  { id: 'moon', name: 'Moon Cracker', e: '🌕', hue: 50, cost: 1244160, g: 1.165, rev: 622080, t: 240, ore: 300, res: 'quartz', mgr: 5e8, mname: 'Luna Ortiz' },
  { id: 'planet', name: 'Planet Stripper', e: '🪐', hue: 25, cost: 14929920, g: 1.16, rev: 7464960, t: 900, ore: 1200, res: 'ore', mgr: 6e9, mname: 'Admiral Grind' },
  { id: 'star', name: 'Star Siphon', e: '☀️', hue: 45, cost: 179159040, g: 1.155, rev: 89579520, t: 3000, ore: 6000, res: 'quartz', mgr: 8e10, mname: 'The Architect' },
];
export const MILESTONES = [25, 50, 100, 150, 200, 300, 400, 500, 600, 800, 1000];

// Production chain. Multi-input recipes create real branches (ingots feed both Press and Forge).
export type MachineDef = { id: string; name: string; e: string; inp: Partial<Record<Res, number>>; out: Res; rate: number; power: number; cost: number; g: number; unlock: number };
export const MACHINES: MachineDef[] = [
  { id: 'smelter', name: 'Smelter', e: '🏭', inp: { ore: 3 }, out: 'ingot', rate: 1, power: 1, cost: 20, g: 1.28, unlock: 0 },
  { id: 'kiln', name: 'Glass Kiln', e: '🔥', inp: { quartz: 3 }, out: 'glass', rate: 1, power: 1, cost: 250, g: 1.28, unlock: 150 },
  { id: 'press', name: 'Parts Press', e: '🔩', inp: { ingot: 4 }, out: 'part', rate: 0.5, power: 2, cost: 2500, g: 1.3, unlock: 1500 },
  { id: 'forge', name: 'Alloy Forge', e: '⚗️', inp: { ingot: 2, glass: 2 }, out: 'alloy', rate: 0.4, power: 3, cost: 3e4, g: 1.3, unlock: 2e4 },
  { id: 'fab', name: 'Chip Fab', e: '🖥️', inp: { part: 3, glass: 2 }, out: 'chip', rate: 0.2, power: 5, cost: 1.5e6, g: 1.32, unlock: 6e5 },
  { id: 'hull', name: 'Hull Works', e: '🛠️', inp: { alloy: 2, part: 3 }, out: 'hull', rate: 0.1, power: 8, cost: 4e7, g: 1.33, unlock: 2e7 },
];
export const GEN = { name: 'Fusion Generator', e: '⚡', cost: 15, g: 1.32, power: 4 };

// Research: cash + goods. Early tiers use early goods, so the chain matters from minute one.
export type TechDef = { id: string; name: string; cash: number; res: Res; amt: number; tgt: number; x: number };
export const TECH: TechDef[] = (() => {
  const out: TechDef[] = [];
  const tiers: [number, Res, number, number, string][] = [[150, 'ingot', 6, 2, 'Reinforced'], [5e4, 'glass', 40, 2, 'Glass-lensed'], [1.5e6, 'ingot', 500, 2, 'Tempered'], [2e7, 'part', 80, 3, 'Precision'], [6e8, 'glass', 4000, 2, 'Prismatic'], [2e10, 'alloy', 300, 3, 'Alloy-framed'], [8e11, 'part', 6000, 2, 'Turbo'], [5e13, 'chip', 200, 3, 'Overclocked'], [1e17, 'hull', 150, 5, 'Armored'], [1e21, 'chip', 2e4, 7, 'Quantum']];
  tiers.forEach(([c, r, a, x, n], ti) => MINES.forEach((m, i) => out.push({ id: `t${ti}_${i}`, name: `${n} ${m.name}`, cash: c * Math.pow(4, i), res: r, amt: Math.round(a * Math.pow(1.5, i)), tgt: i, x })));
  ([[2e6, 'ingot', 600, 2, 'Fusion Core'], [5e9, 'part', 3000, 2, 'Gravity Lens'], [5e12, 'alloy', 8000, 3, 'Dyson Mesh'], [5e15, 'chip', 8000, 3, 'Singularity Tap']] as [number, Res, number, number, string][]).forEach(([c, r, a, x, n], k) => out.push({ id: `all${k}`, name: `${n} – ALL mines`, cash: c, res: r, amt: a, tgt: -1, x }));
  return out.sort((a, b) => a.cash - b.cash);
})();

// Fleet: ships are built from goods, assigned to missions, can be lost.
export type ShipDef = { id: string; name: string; e: string; power: number; cost: Partial<Record<Res, number>> };
export const SHIPS: ShipDef[] = [
  { id: 'scout', name: 'Scout', e: '🛸', power: 1, cost: { ingot: 40, glass: 20 } },
  { id: 'barge', name: 'Mining Barge', e: '🚀', power: 6, cost: { part: 30, alloy: 10 } },
  { id: 'cruiser', name: 'Cruiser', e: '🛰️', power: 40, cost: { alloy: 120, chip: 15 } },
  { id: 'dread', name: 'Dreadnought', e: '🌠', power: 300, cost: { chip: 200, hull: 40 } },
];
export type PlanetDef = { id: string; name: string; e: string; need: number; time: number; bonus: number; desc: string };
export const PLANETS: PlanetDef[] = [
  { id: 'p1', name: 'Rockbit IV', e: '🌑', need: 4, time: 45, bonus: 1.5, desc: 'Dusty and defenceless.' },
  { id: 'p2', name: 'Glacia', e: '🧊', need: 15, time: 120, bonus: 1.75, desc: 'Ice colony, grumpy penguins.' },
  { id: 'p3', name: 'Ferrox Prime', e: '🔴', need: 50, time: 300, bonus: 2, desc: 'Iron world, iron will.' },
  { id: 'p4', name: 'Verdantis', e: '🌍', need: 180, time: 600, bonus: 2.25, desc: 'Jungle with crystal veins.' },
  { id: 'p5', name: 'Gaseous Rex', e: '🪐', need: 700, time: 1200, bonus: 2.5, desc: 'Ring-mining heaven.' },
  { id: 'p6', name: 'Nyx Throne', e: '🌌', need: 3000, time: 2400, bonus: 3, desc: 'Seat of the old empire.' },
];
// Repeatable salvage runs: goods rewards, risk scales with greed.
export type RunDef = { id: string; name: string; e: string; need: number; time: number; loot: Partial<Record<Res, number>> };
export const RUNS: RunDef[] = [
  { id: 'r1', name: 'Debris Field', e: '🪨', need: 2, time: 20, loot: { ore: 400, quartz: 300 } },
  { id: 'r2', name: 'Derelict Freighter', e: '🛳️', need: 10, time: 60, loot: { ingot: 300, glass: 200 } },
  { id: 'r3', name: 'Pirate Depot', e: '🏴‍☠️', need: 60, time: 180, loot: { part: 400, alloy: 150 } },
  { id: 'r4', name: 'Ancient Vault', e: '🗝️', need: 400, time: 480, loot: { chip: 300, hull: 40 } },
];
export const FLEET_UPG = [
  { id: 'engines', name: 'Ion Engines', e: '🔥', desc: '−15% mission time', max: 5, res: 'alloy' as Res, base: 40 },
  { id: 'armor', name: 'Ablative Armor', e: '🛡️', desc: '−20% ship losses', max: 4, res: 'part' as Res, base: 80 },
  { id: 'docks', name: 'Launch Docks', e: '🛫', desc: '+1 simultaneous mission', max: 3, res: 'alloy' as Res, base: 100 },
];
export const GATES = { fleetMach: 'fab', fleetLvl: 1, warp: 1e14 };
