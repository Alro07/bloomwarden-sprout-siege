// BLOOMWARDEN — Sprout Siege: every tunable number lives here, so the rest of
// the code reads like rules instead of arithmetic. The arena is a fixed
// 1280x720 garden; the game scales the canvas to the browser window.
export const FIELD = { width: 1280, height: 720 };

/** Fixed simulation step (seconds): the world advances in 1/60 s slices. */
export const STEP = 1 / 60;

/** Waves: clear wave 8's boss, the Blight Queen, to win. */
export const TOTAL_WAVES = 8;

export const PLAYER = {
  radius: 16,
  speed: 275,
  maxHp: 6,
  /** Seed bolts: damage, shots per second, bullet speed, pierce count. */
  damage: 1,
  fireRate: 3.2,
  bulletSpeed: 560,
  bulletRadius: 6,
  multishot: 1,
  pierce: 0,
  critChance: 0.05,
  magnetRadius: 130,
  pickupRadius: 30,
  dashCooldown: 2.2,
  dashSpeed: 760,
  dashSeconds: 0.15,
  invulnerableSeconds: 0.6,
  thorns: 0,
  /** Sun motes are the turret currency; xp sprouts level the warden up. */
  sunGain: 1,
};

/** The Heartbloom at the garden's heart: if it falls, the garden falls. */
export const BLOOM = { x: 640, y: 360, radius: 46, maxHp: 24 };

/** Six soil plots in a ring around the Heartbloom: E plants a sprout-turret. */
export const PLOTS = (() => {
  const plots = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    plots.push({ x: Math.round(640 + Math.cos(a) * 215), y: Math.round(360 + Math.sin(a) * 175) });
  }
  return plots;
})();

export const TURRET = {
  plantCost: 25,
  upgradeCost: 30,
  maxLevel: 3,
  radius: 15,
  range: 250,
  /** shots per second and damage per level (index 0 = level 1). */
  fireRate: [1.6, 2.1, 2.8],
  damage: [1, 2, 3],
  bulletSpeed: 520,
};

/** Enemy kinds. hp and speed scale with the wave (see waveScaling in world.js). */
export const ENEMIES = {
  mite:    { hp: 2,  speed: 96,  radius: 12, score: 20, xp: 1, sun: 2, touch: 1, color: '#ff5d73', dark: '#c22540', behavior: 'chase' },
  flea:    { hp: 2,  speed: 150, radius: 11, score: 30, xp: 1, sun: 2, touch: 1, color: '#ffb020', dark: '#b97a00', behavior: 'zigzag' },
  aphid:   { hp: 3,  speed: 62,  radius: 14, score: 45, xp: 2, sun: 3, touch: 1, color: '#b388ff', dark: '#6d3fd4', behavior: 'shoot', shootEvery: 2.6, orbSpeed: 165, orbRadius: 7 },
  beetle:  { hp: 12, speed: 44,  radius: 21, score: 90, xp: 3, sun: 5, touch: 2, color: '#4d7cfe', dark: '#23409e', behavior: 'chase' },
  splitter:{ hp: 5,  speed: 72,  radius: 16, score: 60, xp: 2, sun: 4, touch: 1, color: '#2fd6a3', dark: '#0f7a58', behavior: 'split' },
  wasp:    { hp: 4,  speed: 120, radius: 13, score: 70, xp: 2, sun: 4, touch: 1, color: '#ff8a3d', dark: '#b34d00', behavior: 'dive' },
  queen:   { hp: 420, speed: 38, radius: 52, score: 1500, xp: 40, sun: 60, touch: 2, color: '#7b2fbe', dark: '#3d1166', behavior: 'boss' },
};

/** Elites: golden, triple HP, faster, worth far more. */
export const ELITE = { hpMul: 3, speedMul: 1.12, scoreMul: 4, xpMul: 3, sunMul: 3 };

/** How many of each kind a wave spawns. Boss wave is wave 8 only. */
export function waveComposition(wave) {
  const mites = 5 + wave * 3;
  const fleas = wave >= 2 ? 2 + wave : 0;
  const aphids = wave >= 2 ? 1 + Math.floor(wave / 2) : 0;
  const beetles = wave >= 3 ? Math.floor((wave - 1) / 2) + 1 : 0;
  const splitters = wave >= 4 ? Math.floor(wave / 2) : 0;
  const wasps = wave >= 5 ? 2 + Math.floor(wave / 2) : 0;
  const queen = wave === TOTAL_WAVES ? 1 : 0;
  const elites = wave >= 3 ? Math.min(3, Math.floor((wave - 1) / 2)) : 0;
  return { mites, fleas, aphids, beetles, splitters, wasps, queen, elites };
}

/** The Blight Queen: summons mites and fires radial orb rings; enrages below 35% HP. */
export const BOSS = { summonEvery: 6, summonCount: 3, ringEvery: 4.2, ringOrbs: 12, enrageAt: 0.35 };

/** Score values. */
export const SCORE = { waveClear: 150, bossKill: 1500, comboStep: 25 };

/**
 * Level-up upgrades. Each has an id, a display name, an icon (drawn glyph),
 * a one-line description, a max stack count and an apply(player, world) effect.
 * The world offers three different ones per level-up.
 */
export const UPGRADES = [
  { id: 'sharp-seeds', name: 'Sharp Seeds', icon: '◆', text: 'Seed bolts deal +1 damage.', max: 3,
    apply: (p) => { p.damage += 1; } },
  { id: 'rapid-bloom', name: 'Rapid Bloom', icon: '≋', text: 'Fire +25% faster.', max: 3,
    apply: (p) => { p.fireRate *= 1.25; } },
  { id: 'twin-shot', name: 'Twin Shot', icon: '⁂', text: 'Fire +1 seed bolt per shot.', max: 2,
    apply: (p) => { p.multishot += 1; } },
  { id: 'piercing-thorn', name: 'Piercing Thorn', icon: '→', text: 'Bolts pierce +1 enemy.', max: 3,
    apply: (p) => { p.pierce += 1; } },
  { id: 'swift-roots', name: 'Swift Roots', icon: '»', text: 'Move +15% faster.', max: 3,
    apply: (p) => { p.speed *= 1.15; } },
  { id: 'deep-heart', name: 'Deep Heart', icon: '♥', text: 'Heal 2 hearts, gain +1 max heart.', max: 3,
    apply: (p) => { p.maxHp += 1; p.hp = Math.min(p.maxHp, p.hp + 2); } },
  { id: 'wide-net', name: 'Wide Net', icon: '◎', text: 'Pickup magnet +80 radius.', max: 3,
    apply: (p) => { p.magnetRadius += 80; } },
  { id: 'quick-dash', name: 'Quick Dash', icon: '↯', text: 'Dash recharges twice as fast.', max: 2,
    apply: (p) => { p.dashCooldown = Math.max(0.7, p.dashCooldown / 2); } },
  { id: 'lucky-dew', name: 'Lucky Dew', icon: '✦', text: '+12% critical chance (crits deal x3).', max: 3,
    apply: (p) => { p.critChance += 0.12; } },
  { id: 'turret-feed', name: 'Turret Feed', icon: '✿', text: 'Sprout-turrets deal +1 damage.', max: 3,
    apply: (p, w) => { p.turretDamage += 1; w.turretDamageBonus += 1; } },
  { id: 'golden-sun', name: 'Golden Sun', icon: '☀', text: 'Enemies drop +1 sun each.', max: 3,
    apply: (p) => { p.sunGain += 1; } },
  { id: 'thorn-skin', name: 'Thorn Skin', icon: '✜', text: 'Attackers take 1 damage on touch.', max: 2,
    apply: (p) => { p.thorns += 1; } },
];

/** Bright garden palette, shared by the renderer. */
export const PALETTE = {
  grassLight: '#7ec850',
  grass: '#5da83c',
  grassDark: '#3f7d2c',
  soil: '#8a5a33',
  soilDark: '#6b4222',
  sun: '#ffd23f',
  sunHot: '#fff3b0',
  leaf: '#2fd6a3',
  bloomPink: '#ff6b9d',
  bloomWhite: '#fff6f0',
  text: '#20301a',
  textLight: '#f4ffe8',
  panel: '#fff8e7',
  danger: '#ff5d73',
  heart: '#ff5d73',
  xp: '#b388ff',
};
