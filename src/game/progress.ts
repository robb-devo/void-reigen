import { S, perSec, fleetOpen, setGoalSector } from './state';
import type { State } from './state';
const mach = (id: string) => S.mach[['smelter', 'kiln', 'press', 'forge', 'fab', 'hull', 'quantum'].indexOf(id)];
const mine = (i: number) => S.mines[i].n;
const ships = () => Object.values(S.ships).reduce((a, b) => a + b, 0);
// Guided goal chain = tutorial + "always a next goal". tab = where the player should go, focus = CSS selector to spotlight.
export type Goal = { text: string; done: () => boolean; prog?: () => [number, number]; reward: number; tab: string; focus?: string };
export const GOALS: Goal[] = [
  { text: 'Tap the Pebble Drill to mine', done: () => S.taps >= 1, reward: 0, tab: 'mine', focus: '.biz:nth-of-type(1) .ico' },
  { text: 'Own 5 Pebble Drills', done: () => mine(0) >= 5, prog: () => [mine(0), 5], reward: 10, tab: 'mine', focus: '.biz:nth-of-type(1) .buy' },
  { text: 'Build a Smelter in the Factory', done: () => mach('smelter') >= 1, reward: 15, tab: 'fac', focus: '.mach[data-j="0"] .btn' },
  { text: 'Smelt 6 Ingots', done: () => S.made.ingot >= 6, prog: () => [S.made.ingot, 6], reward: 20, tab: 'fac' },
  { text: 'Research Reinforced Pebble Drill', done: () => S.tech.includes('t0_0'), reward: 40, tab: 'fac', focus: '[data-u="t0_0"]' },
  { text: 'Build a Quartz Comet Harvester', done: () => mine(1) >= 1, reward: 60, tab: 'mine', focus: '.biz:nth-of-type(2) .buy' },
  { text: 'Build a Glass Kiln', done: () => mach('kiln') >= 1, reward: 120, tab: 'fac', focus: '.mach[data-j="1"] .btn' },
  { text: 'Sell goods at the Market', done: () => S.sold >= 1, reward: 150, tab: 'fac', focus: '.market' },
  { text: 'Hire Rusty to automate the Drill', done: () => S.mines[0].m, reward: 500, tab: 'crew', focus: '[data-m="0"]' },
  { text: 'Upgrade the Fusion Generator to Lv 3', done: () => S.gen >= 3, reward: 600, tab: 'fac', focus: '.gen .btn' },
  { text: 'Build an Iron Asteroid Rig', done: () => mine(2) >= 1, reward: 900, tab: 'mine', focus: '.biz:nth-of-type(3) .buy' },
  { text: 'Build a Parts Press', done: () => mach('press') >= 1, reward: 2000, tab: 'fac', focus: '.mach[data-j="2"] .btn' },
  { text: 'Pebble Drill reaches 50', done: () => mine(0) >= 50, prog: () => [mine(0), 50], reward: 3000, tab: 'mine' },
  { text: 'Hire Frosty for the Harvester', done: () => S.mines[1].m, reward: 5000, tab: 'crew', focus: '[data-m="1"]' },
  { text: 'Build a Crystal Laser Array', done: () => mine(3) >= 1, reward: 1e4, tab: 'mine' },
  { text: 'Build the Alloy Forge', done: () => mach('forge') >= 1, reward: 2e4, tab: 'fac', focus: '.mach[data-j="3"] .btn' },
  { text: 'Parts Press reaches Lv 10', done: () => mach('press') >= 10, prog: () => [mach('press'), 10], reward: 3e4, tab: 'fac' },
  { text: 'Build a Plasma Excavator', done: () => mine(4) >= 1, reward: 2e5, tab: 'mine' },
  { text: 'Build the Chip Fab – unlocks the Shipyard', done: () => fleetOpen(), reward: 1e6, tab: 'fac' },
  { text: 'Build 4 Scouts', done: () => ships() >= 4, prog: () => [ships(), 4], reward: 4e4, tab: 'fleet' },
  { text: 'Run a salvage mission', done: () => S.wins >= 1, reward: 5e4, tab: 'fleet' },
  { text: 'Conquer Rockbit IV', done: () => S.conquered.includes('p1'), reward: 1e5, tab: 'fleet' },
  { text: 'Conquer Glacia', done: () => S.conquered.includes('p2'), reward: 3e6, tab: 'fleet' },
  { text: 'Build a Moon Cracker', done: () => mine(5) >= 1, reward: 1e7, tab: 'mine' },
  { text: 'Build Hull Works', done: () => mach('hull') >= 1, reward: 5e7, tab: 'fac' },
  { text: 'Build a Planet Stripper', done: () => mine(6) >= 1, reward: 2e8, tab: 'mine' },
  { text: 'Conquer Ferrox Prime', done: () => S.conquered.includes('p3'), reward: 5e8, tab: 'fleet' },
  { text: 'Plasma Excavator reaches 50', done: () => mine(4) >= 50, prog: () => [mine(4), 50], reward: 1e9, tab: 'mine' },
  { text: 'Upgrade Launch Docks', done: () => (S.fupg.docks || 0) >= 1, reward: 2e9, tab: 'fleet' },
  { text: 'Build a Star Siphon', done: () => mine(7) >= 1, reward: 3e9, tab: 'mine' },
  { text: 'Conquer Verdantis', done: () => S.conquered.includes('p4'), reward: 1e10, tab: 'fleet' },
  { text: 'Planet Stripper reaches 50', done: () => mine(6) >= 50, prog: () => [mine(6), 50], reward: 5e10, tab: 'mine' },
  { text: 'Earn $1T lifetime', done: () => S.total + S.life >= 1e12, reward: 1e11, tab: 'mine' },
  { text: 'Conquer Gaseous Rex', done: () => S.conquered.includes('p5'), reward: 5e11, tab: 'fleet' },
  { text: 'Charge the Warp Drive ($100T lifetime)', done: () => S.total + S.life >= 1e14, reward: 0, tab: 'warp' },
  { text: 'Engage Warp', done: () => S.warps >= 1, reward: 0, tab: 'warp' },
  // ---- Sector 2+ goals (start here after a warp) ----
  { text: 'New sector! Own 100 Pebble Drills', done: () => mine(0) >= 100, prog: () => [mine(0), 100], reward: 5e4, tab: 'mine' },
  { text: 'Rebuild the Chip Fab', done: () => mach('fab') >= 1, reward: 1e6, tab: 'fac' },
  { text: 'Build a Star Siphon', done: () => mine(7) >= 1, reward: 3e9, tab: 'mine' },
  { text: 'Build the Black Hole Tap', done: () => mine(8) >= 1, reward: 2e10, tab: 'mine' },
  { text: 'Build the Quantum Refinery', done: () => mach('quantum') >= 1, reward: 5e10, tab: 'fac' },
  { text: 'Refine 50 Exotic Matter', done: () => S.made.exotic >= 50, prog: () => [S.made.exotic, 50], reward: 1e11, tab: 'fac' },
  { text: 'Build a Void Titan', done: () => (S.ships.titan || 0) >= 1, reward: 1e12, tab: 'fleet' },
  { text: 'Conquer Nyx Throne', done: () => S.conquered.includes('p6'), reward: 5e12, tab: 'fleet' },
  { text: 'Conquer Abyssal Reach', done: () => S.conquered.includes('p7'), reward: 2e13, tab: 'fleet' },
  { text: 'Conquer Chronos Belt', done: () => S.conquered.includes('p8'), reward: 1e14, tab: 'fleet' },
  { text: 'Warp again for more Dark Matter', done: () => false, reward: 0, tab: 'warp' },
];
export const SECTOR_GOAL_START = GOALS.findIndex(g => g.text.startsWith('New sector'));
export const goalReward = (g: Goal) => g.reward ? Math.max(g.reward, perSec() * 10) : 0;

export type Ach = { id: string; name: string; e: string; desc: string; check: (s: State) => boolean };
const A = (id: string, e: string, name: string, desc: string, check: (s: State) => boolean): Ach => ({ id, e, name, desc, check });
export const ACHS: Ach[] = [
  A('tap100', '👆', 'Busy Fingers', 'Tap 100 times', s => s.taps >= 100),
  A('tap1k', '🖐️', 'Carpal Commander', 'Tap 1,000 times', s => s.taps >= 1000),
  A('c1k', '💵', 'Pocket Money', 'Earn $1K', s => s.total + s.life >= 1e3),
  A('c1m', '💰', 'Millionaire Miner', 'Earn $1M', s => s.total + s.life >= 1e6),
  A('c1b', '🏦', 'Billionaire Baron', 'Earn $1B', s => s.total + s.life >= 1e9),
  A('c1t', '👑', 'Trillionaire Tycoon', 'Earn $1T', s => s.total + s.life >= 1e12),
  A('d100', '⛏️', 'Drill Sergeant', '100 Pebble Drills', s => s.mines[0].n >= 100),
  A('allm', '🗺️', 'Full Survey', 'Build every mine type', s => s.mines.every(m => m.n > 0)),
  A('mgr3', '🤖', 'Middle Management', 'Hire 3 foremen', s => s.mines.filter(m => m.m).length >= 3),
  A('mgrall', '🏢', 'Corporate Empire', 'Hire every foreman', s => s.mines.every(m => m.m)),
  A('ing100', '🟨', 'Ingot Hoarder', 'Make 100 Ingots', s => s.made.ingot >= 100),
  A('glass1k', '🧪', 'Glassworks', 'Make 1,000 Glass', s => s.made.glass >= 1000),
  A('alloy', '🟪', 'Metallurgist', 'Make your first Alloy', s => s.made.alloy >= 1),
  A('chip', '💠', 'Silicon Valley', 'Make 100 Chips', s => s.made.chip >= 100),
  A('hull', '🛡️', 'Shipwright', 'Make a Hull Plate', s => s.made.hull >= 1),
  A('allmach', '🏭', 'Full Chain', 'Build every machine', s => s.mach.every(n => n > 0)),
  A('gen10', '⚡', 'Power Hungry', 'Generator Lv 10', s => s.gen >= 10),
  A('sell25', '🛒', 'Trader', 'Sell at the market 25 times', s => s.sold >= 25),
  A('fleet10', '🚀', 'Armada', 'Own 10 ships', s => Object.values(s.ships).reduce((a, b) => a + b, 0) >= 10),
  A('win10', '🎖️', 'Veteran', 'Win 10 missions', s => s.wins >= 10),
  A('lost', '🪦', 'Acceptable Losses', 'Lose a ship', s => s.lost >= 1),
  A('p1', '🏳️', 'First Flag', 'Conquer a planet', s => s.conquered.length >= 1),
  A('p6', '🌌', 'Emperor', 'Conquer every planet', s => s.conquered.length >= 6),
  A('tech10', '🔬', 'Lab Rat', 'Complete 10 research', s => s.tech.length >= 10),
  A('warp', '🌀', 'Into the Void', 'Warp once', s => s.warps >= 1),
  A('warp3', '♾️', 'Serial Warper', 'Warp 3 times', s => s.warps >= 3),
  A('exotic', '🌀', 'Strange Matter', 'Refine Exotic Matter', s => s.made.exotic >= 1),
  A('hole', '🕳️', 'Event Horizon', 'Build a Black Hole Tap', s => (s.mines[8]?.n || 0) >= 1),
  A('titan', '🛸', 'Titanomachy', 'Build a Void Titan', s => (s.ships.titan || 0) >= 1),
  A('p9', '✴️', 'Keeper of the Last Star', 'Conquer The Last Star', s => s.conquered.includes('p9')),
  A('c1e21', '🌌', 'Sextillionaire', 'Earn $1Sx', s => s.total + s.life >= 1e21),
];

setGoalSector(SECTOR_GOAL_START);
