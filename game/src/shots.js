// BLOOMWARDEN — Sprout Siege: deterministic screenshot scenes. Each scene
// stages the world from a fixed seed and a fixed simulated time, so the
// screenshots are real renders of the game's own code and reproducible.
// The main loop calls stageShot once when ?shot=<scene> is present, draws
// one frame, and sets window.__shotReady.
import { STEP } from './config.js';
import { Rng } from './random.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_LEVELUP, SCREEN_VICTORY } from './render.js';

/** A scripted input for simulated play: aims at the nearest enemy, holds fire. */
function fakeInput(world) {
  return {
    mouseX: 640,
    mouseY: 300,
    mouseDown: true,
    moveVector: () => ({ x: 0, y: 0 }),
    pressed: () => false,
  };
}

function simulate(world, seconds, aimAtNearest) {
  const input = fakeInput(world);
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (aimAtNearest && world.enemies.length > 0) {
      let best = null;
      let bestDist = Infinity;
      for (const e of world.enemies) {
        const d = Math.hypot(e.x - world.player.x, e.y - world.player.y);
        if (d < bestDist) { bestDist = d; best = e; }
      }
      if (best) { input.mouseX = best.x; input.mouseY = best.y; }
    }
    world.update(STEP, input);
    if (world.over) break;
  }
}

function stageStart(world) {
  world.time = 3.2;
  // A few blight blobs wander the garden behind the title, for colour.
  const spots = [
    ['mite', 180, 180], ['flea', 1080, 200], ['aphid', 220, 540],
    ['beetle', 1060, 520], ['mite', 950, 130], ['wasp', 330, 120],
  ];
  for (const [kind, x, y] of spots) world.spawnEnemy(kind, false, x, y);
  world.player.x = 200;
  world.player.y = 600;
  return SCREEN_TITLE;
}

function stagePlay(world) {
  world.startWave(4);
  // A mid-run warden, standing clear of the soil plots: stronger bolts,
  // two turrets up, a healthy economy.
  world.player.x = 560;
  world.player.y = 470;
  world.player.damage = 2;
  world.player.multishot = 2;
  world.player.fireRate = 4;
  world.plots[0].turret = { level: 2, cooldown: 0, flash: 0 };
  world.plots[2].turret = { level: 1, cooldown: 0, flash: 0 };
  world.plots[4].turret = { level: 3, cooldown: 0, flash: 0 };
  world.turretsPlanted = 3;
  world.score = 1250;
  world.kills = 34;
  world.sun = 68;
  world.xp = 12;
  world.xpNext = 22;
  world.level = 3;
  world.combo = 7;
  world.comboTimer = 2.5;
  world.bestCombo = 9;
  // Fight for six seconds so the garden fills with enemies, bolts and gems.
  simulate(world, 6, true);
  // Top the scene up: a few more enemies close in, an elite among them.
  world.spawnEnemy('beetle', true, 820, 240);
  world.spawnEnemy('aphid', false, 420, 200);
  world.spawnEnemy('flea', false, 900, 480);
  world.spawnEnemy('mite', false, 380, 480);
  world.spawnEnemy('splitter', false, 760, 560);
  world.spawnEnemy('wasp', false, 520, 160);
  for (let i = 0; i < 4; i += 1) world.gems.push(world.scatterPickup(640, 360, 2, 'xp'));
  for (let i = 0; i < 3; i += 1) world.motes.push(world.scatterPickup(640, 360, 3, 'sun'));
  world.banner = { text: 'WAVE 4 / 8', sub: 'Defend the Heartbloom!', t: 2.6 };
  world.time = 42.5;
  return SCREEN_PLAY;
}

function stageLevelUp(world) {
  world.startWave(2);
  world.wavePhase = 'clear';
  world.clearTimer = 3.2;
  world.enemies = [];
  world.spawnQueue = [];
  world.score = 640;
  world.kills = 21;
  world.sun = 54;
  world.level = 3;
  world.xp = 0;
  world.xpNext = 18;
  world.pendingLevels = 1;
  world.player.hp = 5;
  world.player.damage = 2;
  world.plots[1].turret = { level: 1, cooldown: 0, flash: 0 };
  world.turretsPlanted = 1;
  world.time = 96.0;
  world.offerChoices();
  world.banner = { text: '', sub: '', t: 0 };
  return SCREEN_LEVELUP;
}

function stageVictory(world) {
  world.wave = 8;
  world.score = 8450;
  world.kills = 187;
  world.level = 9;
  world.xp = 8;
  world.xpNext = 42;
  world.time = 482;
  world.bestCombo = 14;
  world.turretsPlanted = 5;
  world.upgradesTaken = 9;
  world.sun = 120;
  world.player.hp = 4;
  world.player.maxHp = 8;
  world.bloom.hp = 15;
  world.plots[0].turret = { level: 3, cooldown: 0, flash: 0 };
  world.plots[2].turret = { level: 2, cooldown: 0, flash: 0 };
  world.plots[4].turret = { level: 3, cooldown: 0, flash: 0 };
  world.burst(640, 300, '#ffd23f', 40, 260);
  world.burst(640, 300, '#ff8fb5', 30, 220);
  world.burst(500, 420, '#2fd6a3', 20, 180);
  world.burst(780, 420, '#b388ff', 20, 180);
  world.won = true;
  world.over = true;
  world.overCause = 'The Blight Queen is gone — the garden blooms again!';
  world.time = 482;
  return SCREEN_VICTORY;
}

/** Stage one named scene; returns the screen the renderer should draw. */
export function stageShot(world, name, seed) {
  world.reset();
  world.rng = new Rng(seed);
  if (name === 'start') return stageStart(world);
  if (name === 'play') return stagePlay(world);
  if (name === 'levelup') return stageLevelUp(world);
  if (name === 'victory') return stageVictory(world);
  return stageStart(world);
}
