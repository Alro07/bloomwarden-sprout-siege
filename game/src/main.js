// BLOOMWARDEN — Sprout Siege: the entry point. Owns the game loop, the screen
// state machine (title -> play -> levelup -> ... -> victory / game over), the
// best score in localStorage, and the ?shot= scene mode the screenshots use.
// The world simulates; the renderer draws; this file wires them together.
import { FIELD, STEP } from './config.js';
import { World } from './world.js';
import { Renderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_LEVELUP, SCREEN_PAUSE, SCREEN_VICTORY, SCREEN_OVER } from './render.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = FIELD.width;
canvas.height = FIELD.height;

const BEST_KEY = 'bloomwarden-best-score';
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '1') || 1;

const world = new World(shotName ? seed : (Date.now() % 2147483647));
const renderer = new Renderer(canvas);
const input = new Input(canvas);
const sound = new SoundEngine();

let screen = SCREEN_TITLE;
let best = 0;
try { best = Number(window.localStorage.getItem(BEST_KEY) || '0') || 0; } catch { best = 0; }
let ui = { best, muted: false, levelChoices: [], hoverCard: -1 };
const statusEl = document.getElementById('status');

/** Test and screenshot hook: the live world, for scripted play-tests. */
window.__game = { world, get screen() { return screen; } };

function saveBest() {
  if (world.stats().score > best) {
    best = world.stats().score;
    ui.best = best;
    try { window.localStorage.setItem(BEST_KEY, String(best)); } catch { /* private mode */ }
  }
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

/** Drain the world's one-frame sound flags into the sound engine. */
function playWorldSounds() {
  const s = world.sounds;
  if (s.shoot) { sound.shoot(); s.shoot = false; }
  if (s.hit) { sound.hit(); s.hit = false; }
  if (s.kill) { sound.kill(); s.kill = false; }
  if (s.pickup) { sound.pickup(); s.pickup = false; }
  if (s.sun) { sound.sun(); s.sun = false; }
  if (s.hurt) { sound.hurt(); s.hurt = false; }
  if (s.dash) { sound.dash(); s.dash = false; }
  if (s.plant) { sound.plant(); s.plant = false; }
  if (s.wave) { sound.wave(); s.wave = false; }
  if (s.levelup) { sound.levelup(); s.levelup = false; }
  if (s.boss) { sound.bossRoar(); s.boss = false; }
  if (s.victory) { sound.victory(); s.victory = false; }
  if (s.gameover) { sound.gameover(); s.gameover = false; }
}

function startGame() {
  sound.unlock();
  world.reset();
  screen = SCREEN_PLAY;
  setStatus('Wave 1: defend the Heartbloom, gather sun, plant turrets, beat 8 waves.');
}

function restart() {
  startGame();
}

function openLevelUp() {
  ui.levelChoices = world.offerChoices();
  ui.hoverCard = -1;
  screen = SCREEN_LEVELUP;
  setStatus(`Level ${world.level}! Choose a boon.`);
}

function pickBoon(index) {
  const choice = ui.levelChoices[index];
  if (!choice) return;
  world.applyUpgrade(choice.id);
  if (world.pendingLevels > 0) {
    ui.levelChoices = world.offerChoices();
  } else {
    ui.levelChoices = [];
    screen = SCREEN_PLAY;
    setStatus(`Wave ${world.wave}: defend the Heartbloom!`);
  }
}

/** Where the level-up cards sit, for click / hover hit-testing. */
function levelCardRect(index) {
  const choices = ui.levelChoices.length || 3;
  const cardW = 300;
  const cardH = 250;
  const gap = 28;
  const totalW = choices * cardW + (choices - 1) * gap;
  const x = FIELD.width / 2 - totalW / 2 + index * (cardW + gap);
  return { x, y: 220, w: cardW, h: cardH };
}

function hoverLevelCard() {
  for (let i = 0; i < ui.levelChoices.length; i += 1) {
    const r = levelCardRect(i);
    if (input.mouseX >= r.x && input.mouseX <= r.x + r.w && input.mouseY >= r.y && input.mouseY <= r.y + r.h) return i;
  }
  return -1;
}

function inside(x, y, w, h, px, py) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

function handleClick() {
  if (!input.clicked) return;
  const px = input.clickX;
  const py = input.clickY;
  if (screen === SCREEN_TITLE && inside(490, 522, 300, 60, px, py)) startGame();
  else if (screen === SCREEN_LEVELUP) {
    const card = hoverLevelCard();
    if (card >= 0) pickBoon(card);
  } else if ((screen === SCREEN_VICTORY || screen === SCREEN_OVER) && inside(470, 492, 340, 60, px, py)) {
    restart();
  }
}

function handleKeys() {
  if (input.pressed('KeyM')) ui.muted = sound.toggleMute();
  if (screen === SCREEN_TITLE && (input.pressed('Enter') || input.pressed('Space'))) startGame();
  else if (screen === SCREEN_PLAY) {
    if (input.pressed('KeyP') || input.pressed('Escape')) screen = SCREEN_PAUSE;
    else if (input.pressed('KeyE')) {
      const result = world.plantOrUpgrade();
      if (result === 'planted') setStatus('Sprout-turret planted! It fires on its own.');
      else if (result === 'upgraded') setStatus('Turret upgraded!');
      else if (result === 'poor') setStatus('Not enough sun — slay blight to gather sun.');
      else if (result === 'maxed') setStatus('That turret is already at max level.');
    } else if (input.pressed('KeyR')) restart();
  } else if (screen === SCREEN_PAUSE) {
    if (input.pressed('KeyP') || input.pressed('Enter') || input.pressed('Escape')) screen = SCREEN_PLAY;
    else if (input.pressed('KeyR')) restart();
  } else if (screen === SCREEN_LEVELUP) {
    if (input.pressed('Digit1')) pickBoon(0);
    else if (input.pressed('Digit2')) pickBoon(1);
    else if (input.pressed('Digit3')) pickBoon(2);
  } else if ((screen === SCREEN_VICTORY || screen === SCREEN_OVER) && (input.pressed('Enter') || input.pressed('Space'))) {
    restart();
  }
}

// ---- screenshot scene mode: stage once, draw once, signal readiness. --------
if (shotName) {
  screen = stageShot(world, shotName, seed);
  if (screen === SCREEN_LEVELUP) ui.levelChoices = world.levelChoices;
  ui.hoverCard = screen === SCREEN_LEVELUP ? 0 : -1;
  renderer.draw(world, screen, ui);
  window.__shotReady = true;
} else {
  // ---- live game: fixed-step loop -------------------------------------------
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    sound.update(dt);
    handleKeys();
    handleClick();
    if (screen === SCREEN_LEVELUP) ui.hoverCard = hoverLevelCard();
    // Safety net: the world can only end while playing, but if it ever ends
    // on another screen (a test hook, a late sound flag), show the end screen.
    if (world.over && screen !== SCREEN_VICTORY && screen !== SCREEN_OVER) {
      saveBest();
      screen = world.won ? SCREEN_VICTORY : SCREEN_OVER;
      setStatus(world.won ? 'Victory! The garden blooms again.' : world.overCause);
    }
    if (screen === SCREEN_PLAY) {
      accumulator += dt;
      let steps = 0;
      while (accumulator >= STEP && steps < 5) {
        world.update(STEP, input);
        accumulator -= STEP;
        steps += 1;
      }
      if (steps === 5) accumulator = 0;
      playWorldSounds();
      if (world.over) {
        saveBest();
        screen = world.won ? SCREEN_VICTORY : SCREEN_OVER;
        setStatus(world.won ? 'Victory! The garden blooms again.' : world.overCause);
      } else if (world.pendingLevels > 0) {
        openLevelUp();
      }
    }
    renderer.draw(world, screen, ui);
    input.endFrame();
  }
  requestAnimationFrame(frame);
}
