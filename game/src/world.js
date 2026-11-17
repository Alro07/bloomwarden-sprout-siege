// BLOOMWARDEN — Sprout Siege: the simulation. The world owns the player, the
// Heartbloom, the enemies, the bullets, the pickups, the turrets, the waves
// and the score. It draws nothing and hears nothing: the renderer draws it,
// the main loop drains its sound flags into the sound engine. Fixed 1/60 s
// steps; every roll goes through the seeded Rng, never Math.random.
import { FIELD, STEP, PLAYER, BLOOM, PLOTS, TURRET, ENEMIES, ELITE, TOTAL_WAVES, BOSS, SCORE, UPGRADES, waveComposition } from './config.js';
import { Rng } from './random.js';

export const EVENT_NONE = 0;

export class World {
  constructor(seed) {
    this.rng = new Rng(seed);
    this.reset();
  }

  reset() {
    this.time = 0;
    this.score = 0;
    this.kills = 0;
    this.sun = 20;
    this.xp = 0;
    this.level = 1;
    this.xpNext = 6;
    this.wave = 0;
    this.wavePhase = 'idle';
    this.clearTimer = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.over = false;
    this.won = false;
    this.overCause = '';
    this.boss = null;
    this.turretsPlanted = 0;
    this.upgradesTaken = 0;
    this.turretDamageBonus = 0;
    this.pendingLevels = 0;
    this.levelChoices = [];
    this.takenUpgrades = {};
    this.banner = { text: '', sub: '', t: 0 };
    this.shake = 0;
    this.bloomFlash = 0;
    this.enemies = [];
    this.bullets = [];
    this.orbs = [];
    this.gems = [];
    this.motes = [];
    this.particles = [];
    this.floats = [];
    this.sounds = {
      shoot: false, hit: false, kill: false, pickup: false, sun: false,
      hurt: false, dash: false, plant: false, wave: false, levelup: false,
      boss: false, victory: false, gameover: false,
    };
    this.player = {
      x: 640, y: 540, vx: 0, vy: 0, hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
      radius: PLAYER.radius, speed: PLAYER.speed, damage: PLAYER.damage,
      fireRate: PLAYER.fireRate, bulletSpeed: PLAYER.bulletSpeed,
      multishot: PLAYER.multishot, pierce: PLAYER.pierce,
      critChance: PLAYER.critChance, magnetRadius: PLAYER.magnetRadius,
      dashCooldown: PLAYER.dashCooldown, dashSpeed: PLAYER.dashSpeed,
      thorns: PLAYER.thorns, sunGain: PLAYER.sunGain,
      fireTimer: 0, dashTimer: 0, dashCdTimer: 0, dashDirX: 0, dashDirY: 1,
      invulnTimer: 0, aimX: 0, aimY: -1, walkPhase: 0, moving: false,
    };
    this.bloom = { x: BLOOM.x, y: BLOOM.y, radius: BLOOM.radius, hp: BLOOM.maxHp, maxHp: BLOOM.maxHp };
    this.plots = PLOTS.map((p) => ({ x: p.x, y: p.y, turret: null }));
  }

  // ---- waves ---------------------------------------------------------------

  startWave(n) {
    this.wave = n;
    this.wavePhase = 'fighting';
    const comp = waveComposition(n);
    const queue = [];
    const kinds = [
      ['mite', comp.mites], ['flea', comp.fleas], ['aphid', comp.aphids],
      ['beetle', comp.beetles], ['splitter', comp.splitters], ['wasp', comp.wasps],
    ];
    for (const [kind, count] of kinds) {
      for (let i = 0; i < count; i += 1) queue.push({ kind, elite: false });
    }
    // Elites: upgrade a few random spawns (never the boss).
    for (let i = 0; i < comp.elites && queue.length > 0; i += 1) {
      const idx = this.rng.int(0, queue.length - 1);
      queue[idx].elite = true;
    }
    // Shuffle the queue, then stagger spawns across the wave.
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = this.rng.int(0, i);
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    const total = queue.length;
    const gap = total > 0 ? Math.min(1.1, Math.max(0.28, 26 / total)) : 1;
    queue.forEach((entry, i) => { entry.at = 0.6 + i * gap; });
    if (comp.queen) queue.unshift({ kind: 'queen', elite: false, at: 1.2 });
    this.spawnQueue = queue;
    this.spawnTimer = 0;
    this.banner = {
      text: n === TOTAL_WAVES ? 'FINAL WAVE — THE BLIGHT QUEEN' : `WAVE ${n} / ${TOTAL_WAVES}`,
      sub: n === TOTAL_WAVES ? 'Defeat her and the garden blooms again!' : 'Defend the Heartbloom!',
      t: 2.6,
    };
    this.sounds.wave = true;
    if (n === TOTAL_WAVES) this.sounds.boss = true;
  }

  spawnEnemy(kind, elite, x, y) {
    const def = ENEMIES[kind];
    const scale = 1 + (this.wave - 1) * 0.09;
    const hp = Math.round(def.hp * scale * (elite ? ELITE.hpMul : 1));
    const enemy = {
      kind, def, x, y, vx: 0, vy: 0,
      hp, maxHp: hp,
      radius: def.radius * (kind === 'queen' ? 1 : elite ? 1.25 : 1),
      speed: def.speed * (elite ? ELITE.speedMul : 1) * (kind === 'queen' ? 1 : 1 + (this.wave - 1) * 0.02),
      elite, touch: def.touch, flash: 0, wobble: this.rng.range(0, Math.PI * 2),
      shootTimer: this.rng.range(1, def.shootEvery || 2),
      attackTimer: 0, summonTimer: BOSS.summonEvery, ringTimer: BOSS.ringEvery,
      target: 'bloom', hitBy: new Set(),
    };
    this.enemies.push(enemy);
    if (kind === 'queen') this.boss = enemy;
    this.burst(x, y, elite ? '#ffd23f' : def.color, elite ? 14 : 8, 120);
    return enemy;
  }

  edgePoint() {
    const side = this.rng.int(0, 3);
    const m = 30;
    if (side === 0) return { x: this.rng.range(m, FIELD.width - m), y: m };
    if (side === 1) return { x: this.rng.range(m, FIELD.width - m), y: FIELD.height - m };
    if (side === 2) return { x: m, y: this.rng.range(m, FIELD.height - m) };
    return { x: FIELD.width - m, y: this.rng.range(m, FIELD.height - m) };
  }

  // ---- per-frame update ----------------------------------------------------

  update(dt, input) {
    if (this.over) return;
    this.time += dt;
    if (this.banner.t > 0) this.banner.t -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    if (this.bloomFlash > 0) this.bloomFlash -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    if (this.wavePhase === 'idle') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) this.startWave(this.wave + 1);
    } else if (this.wavePhase === 'clear') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0 && this.pendingLevels === 0) this.startWave(this.wave + 1);
    }

    // Spawn from the queue on schedule.
    if (this.wavePhase === 'fighting') {
      this.spawnTimer += dt;
      while (this.spawnQueue.length > 0 && this.spawnQueue[0].at <= this.spawnTimer) {
        const entry = this.spawnQueue.shift();
        const at = this.edgePoint();
        this.spawnEnemy(entry.kind, entry.elite, at.x, at.y);
      }
    }

    this.updatePlayer(dt, input);
    this.updateTurrets(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateOrbs(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);

    // Wave cleared: queue empty, no enemies left, boss gone.
    if (this.wavePhase === 'fighting' && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.wavePhase = 'clear';
      this.clearTimer = 3.2;
      const bonus = SCORE.waveClear + this.wave * 25;
      this.score += bonus;
      this.sun += 15 + this.wave * 3;
      this.banner = {
        text: this.wave === TOTAL_WAVES ? '' : `WAVE ${this.wave} CLEARED!`,
        sub: this.wave === TOTAL_WAVES ? '' : `+${bonus} score  ·  +${15 + this.wave * 3} sun`,
        t: 2.8,
      };
      if (this.wave === TOTAL_WAVES) {
        this.winGame();
      } else {
        this.sounds.wave = true;
      }
    }
  }

  updatePlayer(dt, input) {
    const p = this.player;
    const move = input.moveVector();
    p.moving = move.x !== 0 || move.y !== 0;
    if (p.moving) p.walkPhase += dt * 11;

    // Aim follows the mouse.
    const aimDx = input.mouseX - p.x;
    const aimDy = input.mouseY - p.y;
    const aimLen = Math.hypot(aimDx, aimDy) || 1;
    p.aimX = aimDx / aimLen;
    p.aimY = aimDy / aimLen;

    // Dash: a short burst with invulnerability.
    if (p.dashCdTimer > 0) p.dashCdTimer -= dt;
    if (p.invulnTimer > 0) p.invulnTimer -= dt;
    if (input.pressed('Space') && p.dashCdTimer <= 0 && p.dashTimer <= 0) {
      p.dashTimer = PLAYER.dashSeconds;
      p.dashCdTimer = p.dashCooldown;
      p.invulnTimer = Math.max(p.invulnTimer, PLAYER.dashSeconds + 0.1);
      if (p.moving) { p.dashDirX = move.x; p.dashDirY = move.y; }
      else { p.dashDirX = p.aimX; p.dashDirY = p.aimY; }
      this.sounds.dash = true;
      this.burst(p.x, p.y, '#bff5a0', 10, 140);
    }
    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.vx = p.dashDirX * p.dashSpeed;
      p.vy = p.dashDirY * p.dashSpeed;
    } else {
      p.vx = move.x * p.speed;
      p.vy = move.y * p.speed;
    }
    p.x = Math.max(p.radius, Math.min(FIELD.width - p.radius, p.x + p.vx * dt));
    p.y = Math.max(p.radius, Math.min(FIELD.height - p.radius, p.y + p.vy * dt));

    // Keep the warden out of the Heartbloom's petals.
    const bdx = p.x - this.bloom.x;
    const bdy = p.y - this.bloom.y;
    const bdist = Math.hypot(bdx, bdy);
    const minDist = this.bloom.radius + p.radius + 4;
    if (bdist < minDist && bdist > 0.01) {
      p.x = this.bloom.x + (bdx / bdist) * minDist;
      p.y = this.bloom.y + (bdy / bdist) * minDist;
    }

    // Fire seed bolts while the mouse is held.
    p.fireTimer -= dt;
    if (input.mouseDown && p.fireTimer <= 0) {
      p.fireTimer = 1 / p.fireRate;
      this.fireBolts();
    }
  }

  fireBolts() {
    const p = this.player;
    const n = p.multishot;
    const spread = 0.16;
    for (let i = 0; i < n; i += 1) {
      const off = (i - (n - 1) / 2) * spread;
      const cos = Math.cos(off);
      const sin = Math.sin(off);
      const dx = p.aimX * cos - p.aimY * sin;
      const dy = p.aimX * sin + p.aimY * cos;
      this.bullets.push({
        x: p.x + dx * (p.radius + 8), y: p.y + dy * (p.radius + 8),
        vx: dx * p.bulletSpeed, vy: dy * p.bulletSpeed,
        radius: PLAYER.bulletRadius, damage: p.damage, pierce: p.pierce,
        from: 'player', life: 1.4, hit: new Set(),
      });
    }
    this.sounds.shoot = true;
  }

  updateTurrets(dt) {
    for (const plot of this.plots) {
      const t = plot.turret;
      if (!t) continue;
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;
      // Nearest enemy in range.
      let best = null;
      let bestDist = TURRET.range;
      for (const e of this.enemies) {
        const d = Math.hypot(e.x - plot.x, e.y - plot.y);
        if (d < bestDist) { bestDist = d; best = e; }
      }
      if (!best) continue;
      const lvl = t.level - 1;
      t.cooldown = 1 / TURRET.fireRate[lvl];
      const dx = (best.x - plot.x) / (bestDist || 1);
      const dy = (best.y - plot.y) / (bestDist || 1);
      this.bullets.push({
        x: plot.x + dx * 20, y: plot.y + dy * 20,
        vx: dx * TURRET.bulletSpeed, vy: dy * TURRET.bulletSpeed,
        radius: 5, damage: TURRET.damage[lvl] + this.turretDamageBonus, pierce: 0,
        from: 'turret', life: 1.2, hit: new Set(),
      });
      t.flash = 0.08;
    }
    for (const plot of this.plots) {
      if (plot.turret && plot.turret.flash > 0) plot.turret.flash -= dt;
    }
  }

  updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.flash > 0) e.flash -= dt;
      if (e.attackTimer > 0) e.attackTimer -= dt;
      const toPlayer = Math.hypot(p.x - e.x, p.y - e.y);
      const toBloom = Math.hypot(this.bloom.x - e.x, this.bloom.y - e.y);
      const enraged = e.kind === 'queen' && e.hp < e.maxHp * BOSS.enrageAt;
      const speed = e.speed * (enraged ? 1.45 : 1);

      if (e.kind === 'queen') {
        // The Blight Queen drifts toward the bloom, summons mites and fires rings.
        const dx = (this.bloom.x - e.x) / (toBloom || 1);
        const dy = (this.bloom.y - e.y) / (toBloom || 1);
        const stopDist = this.bloom.radius + e.radius + 60;
        if (toBloom > stopDist) { e.x += dx * speed * dt; e.y += dy * speed * dt; }
        e.summonTimer -= dt * (enraged ? 1.6 : 1);
        if (e.summonTimer <= 0) {
          e.summonTimer = BOSS.summonEvery;
          for (let i = 0; i < BOSS.summonCount; i += 1) {
            const a = this.rng.angle();
            this.spawnEnemy('mite', false, e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70);
          }
          this.sounds.boss = true;
        }
        e.ringTimer -= dt * (enraged ? 1.6 : 1);
        if (e.ringTimer <= 0) {
          e.ringTimer = BOSS.ringEvery;
          for (let i = 0; i < BOSS.ringOrbs; i += 1) {
            const a = (i / BOSS.ringOrbs) * Math.PI * 2;
            this.orbs.push({
              x: e.x + Math.cos(a) * e.radius, y: e.y + Math.sin(a) * e.radius,
              vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, radius: 8, damage: 1, life: 6,
            });
          }
          this.sounds.boss = true;
        }
      } else if (e.def.behavior === 'shoot') {
        // Aphids keep their distance and spit orbs at the player or the bloom.
        const target = toPlayer < toBloom ? p : this.bloom;
        const dx = target.x - e.x;
        const dy = target.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist > 260) { e.x += (dx / dist) * speed * dt; e.y += (dy / dist) * speed * dt; }
        else if (dist < 170) { e.x -= (dx / dist) * speed * 0.7 * dt; e.y -= (dy / dist) * speed * 0.7 * dt; }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.def.shootEvery;
          this.orbs.push({
            x: e.x, y: e.y,
            vx: (dx / dist) * e.def.orbSpeed, vy: (dy / dist) * e.def.orbSpeed,
            radius: e.def.orbRadius, damage: 1, life: 5,
          });
        }
      } else {
        // Chasers, zigzaggers, divers and splitters all hunt the nearer prize.
        const target = toPlayer < toBloom ? p : this.bloom;
        const dx = target.x - e.x;
        const dy = target.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        let mx = dx / dist;
        let my = dy / dist;
        if (e.def.behavior === 'zigzag') {
          const wob = Math.sin(this.time * 6 + e.wobble) * 0.7;
          const px = -my * wob;
          const py = mx * wob;
          mx += px;
          my += py;
          const ml = Math.hypot(mx, my) || 1;
          mx /= ml; my /= ml;
        }
        if (e.def.behavior === 'dive') {
          // Wasps lunge in bursts: fast, then a slow drift.
          const lunging = Math.sin(this.time * 1.8 + e.wobble) > 0.2;
          const s = lunging ? speed * 1.9 : speed * 0.45;
          e.x += mx * s * dt;
          e.y += my * s * dt;
        } else {
          e.x += mx * speed * dt;
          e.y += my * speed * dt;
        }
      }

      // Touching the bloom: chew it. Touching the warden: sting them.
      const bloomDist = Math.hypot(this.bloom.x - e.x, this.bloom.y - e.y);
      if (bloomDist < this.bloom.radius + e.radius - 4 && e.attackTimer <= 0) {
        e.attackTimer = 0.8;
        this.damageBloom(e.touch);
      }
      const playerDist = Math.hypot(p.x - e.x, p.y - e.y);
      if (playerDist < p.radius + e.radius - 2 && e.attackTimer <= 0) {
        e.attackTimer = 0.7;
        this.damagePlayer(e.touch);
        if (p.thorns > 0) this.damageEnemy(e, p.thorns, false);
        // Knock the enemy back off the warden so it cannot stick.
        const kx = (e.x - p.x) / (playerDist || 1);
        const ky = (e.y - p.y) / (playerDist || 1);
        e.x += kx * 26;
        e.y += ky * 26;
      }
      // Keep enemies inside the garden.
      e.x = Math.max(e.radius, Math.min(FIELD.width - e.radius, e.x));
      e.y = Math.max(e.radius, Math.min(FIELD.height - e.radius, e.y));
    }
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      for (const e of this.enemies) {
        if (b.hit.has(e) || e.hp <= 0) continue;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        if (d < e.radius + b.radius) {
          b.hit.add(e);
          const crit = b.from === 'player' && this.rng.chance(this.player.critChance);
          this.damageEnemy(e, b.damage * (crit ? 3 : 1), crit);
          if (b.pierce > 0) { b.pierce -= 1; } else { b.life = 0; }
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > -20 && b.x < FIELD.width + 20 && b.y > -20 && b.y < FIELD.height + 20);
    this.enemies = this.enemies.filter((e) => e.hp > 0);
  }

  updateOrbs(dt) {
    const p = this.player;
    for (const o of this.orbs) {
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.life -= dt;
      if (Math.hypot(p.x - o.x, p.y - o.y) < p.radius + o.radius - 2) {
        o.life = 0;
        this.damagePlayer(o.damage);
      } else if (Math.hypot(this.bloom.x - o.x, this.bloom.y - o.y) < this.bloom.radius + o.radius - 4) {
        o.life = 0;
        this.damageBloom(o.damage);
      }
    }
    this.orbs = this.orbs.filter((o) => o.life > 0 && o.x > -20 && o.x < FIELD.width + 20 && o.y > -20 && o.y < FIELD.height + 20);
  }

  updatePickups(dt) {
    const p = this.player;
    const collect = (list, radius, onTake) => {
      for (const g of list) {
        const dx = p.x - g.x;
        const dy = p.y - g.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < p.magnetRadius) {
          const pull = 340 * (1 - d / (p.magnetRadius + 40));
          g.x += (dx / d) * pull * dt;
          g.y += (dy / d) * pull * dt;
        }
        g.t += dt;
        if (d < p.radius + radius) {
          g.taken = true;
          onTake(g);
        }
      }
      return list.filter((g) => !g.taken);
    };
    this.gems = collect(this.gems, 14, (g) => {
      this.addXp(g.value);
      this.sounds.pickup = true;
      this.burst(g.x, g.y, '#b388ff', 5, 90);
    });
    this.motes = collect(this.motes, 14, (g) => {
      this.sun += g.value;
      this.sounds.sun = true;
      this.burst(g.x, g.y, '#ffd23f', 5, 90);
    });
  }

  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += (pt.grav || 0) * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const f of this.floats) {
      f.y -= 34 * dt;
      f.life -= dt;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
  }

  // ---- damage, death, rewards ------------------------------------------------

  damageEnemy(e, amount, crit) {
    e.hp -= amount;
    e.flash = 0.09;
    this.sounds.hit = true;
    this.burst(e.x, e.y, e.def.color, 3, 110);
    if (crit) this.floats.push({ x: e.x, y: e.y - e.radius - 6, text: 'CRIT!', life: 0.8, color: '#ffd23f', size: 17 });
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    this.kills += 1;
    const mult = e.elite ? ELITE.scoreMul : 1;
    const gained = e.def.score * mult;
    this.score += gained;
    this.combo += 1;
    this.comboTimer = 2.5;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    if (this.combo > 0 && this.combo % 5 === 0) {
      const bonus = SCORE.comboStep * Math.floor(this.combo / 5);
      this.score += bonus;
      this.floats.push({ x: e.x, y: e.y - 24, text: `COMBO x${this.combo}  +${bonus}`, life: 1, color: '#ffd23f', size: 18 });
    }
    this.sounds.kill = true;
    this.burst(e.x, e.y, e.def.color, e.elite ? 18 : 10, 190);
    this.burst(e.x, e.y, '#ffffff', 4, 120);
    // Drops: xp sprouts and sun motes, split into a few pickups.
    const xpTotal = e.def.xp * (e.elite ? ELITE.xpMul : 1);
    const sunTotal = (e.def.sun + this.player.sunGain - 1) * (e.elite ? ELITE.sunMul : 1);
    const xpParts = Math.min(3, xpTotal);
    for (let i = 0; i < xpParts; i += 1) {
      this.gems.push(this.scatterPickup(e.x, e.y, Math.max(1, Math.round(xpTotal / xpParts)), 'xp'));
    }
    const sunParts = Math.min(3, sunTotal);
    for (let i = 0; i < sunParts; i += 1) {
      this.motes.push(this.scatterPickup(e.x, e.y, Math.max(1, Math.round(sunTotal / sunParts)), 'sun'));
    }
    if (e.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const a = this.rng.angle();
        this.spawnEnemy('mite', false, e.x + Math.cos(a) * 22, e.y + Math.sin(a) * 22);
      }
    }
    if (e.kind === 'queen') {
      this.boss = null;
      this.score += SCORE.bossKill;
      this.burst(e.x, e.y, '#ffd23f', 40, 320);
      this.burst(e.x, e.y, '#ff6b9d', 30, 260);
    }
  }

  scatterPickup(x, y, value, kind) {
    const a = this.rng.angle();
    const d = this.rng.range(8, 34);
    return {
      x: Math.max(16, Math.min(FIELD.width - 16, x + Math.cos(a) * d)),
      y: Math.max(16, Math.min(FIELD.height - 16, y + Math.sin(a) * d)),
      value, kind, t: this.rng.range(0, 6), taken: false,
    };
  }

  damagePlayer(amount) {
    const p = this.player;
    if (p.invulnTimer > 0 || this.over) return;
    p.hp -= amount;
    p.invulnTimer = PLAYER.invulnerableSeconds;
    this.shake = 9;
    this.sounds.hurt = true;
    this.burst(p.x, p.y, '#ff5d73', 12, 200);
    if (p.hp <= 0) {
      p.hp = 0;
      this.loseGame('The blight overran Wren.');
    }
  }

  damageBloom(amount) {
    if (this.over) return;
    this.bloom.hp -= amount;
    this.bloomFlash = 0.25;
    this.shake = Math.max(this.shake, 5);
    this.sounds.hurt = true;
    this.burst(this.bloom.x, this.bloom.y, '#ff6b9d', 8, 150);
    if (this.bloom.hp <= 0) {
      this.bloom.hp = 0;
      this.loseGame('The Heartbloom withered.');
    }
  }

  addXp(amount) {
    this.xp += amount;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level += 1;
      this.xpNext = 6 + this.level * 4;
      this.pendingLevels += 1;
      this.sounds.levelup = true;
    }
  }

  // ---- level-ups and turrets ---------------------------------------------------

  offerChoices() {
    const available = UPGRADES.filter((u) => (this.takenUpgrades[u.id] || 0) < u.max);
    const picks = [];
    while (picks.length < 3 && available.length > 0) {
      const idx = this.rng.int(0, available.length - 1);
      picks.push(available.splice(idx, 1)[0]);
    }
    this.levelChoices = picks;
    return picks;
  }

  applyUpgrade(id) {
    const up = UPGRADES.find((u) => u.id === id);
    if (!up || this.pendingLevels <= 0) return false;
    if ((this.takenUpgrades[id] || 0) >= up.max) return false;
    up.apply(this.player, this);
    this.takenUpgrades[id] = (this.takenUpgrades[id] || 0) + 1;
    this.upgradesTaken += 1;
    this.pendingLevels -= 1;
    this.levelChoices = [];
    this.sounds.levelup = true;
    this.burst(this.player.x, this.player.y, '#b388ff', 16, 180);
    return true;
  }

  /** E near a plot: plant a sprout-turret, or upgrade the one already there. */
  plantOrUpgrade() {
    const p = this.player;
    let best = null;
    let bestDist = 78;
    for (const plot of this.plots) {
      const d = Math.hypot(p.x - plot.x, p.y - plot.y);
      if (d < bestDist) { bestDist = d; best = plot; }
    }
    if (!best) return 'none';
    if (!best.turret) {
      if (this.sun < TURRET.plantCost) return 'poor';
      this.sun -= TURRET.plantCost;
      best.turret = { level: 1, cooldown: 0, flash: 0 };
      this.turretsPlanted += 1;
      this.sounds.plant = true;
      this.burst(best.x, best.y, '#2fd6a3', 14, 160);
      return 'planted';
    }
    if (best.turret.level >= TURRET.maxLevel) return 'maxed';
    if (this.sun < TURRET.upgradeCost) return 'poor';
    this.sun -= TURRET.upgradeCost;
    best.turret.level += 1;
    this.sounds.plant = true;
    this.burst(best.x, best.y, '#ffd23f', 16, 180);
    return 'upgraded';
  }

  // ---- endings -----------------------------------------------------------------

  winGame() {
    this.won = true;
    this.over = true;
    this.overCause = 'The Blight Queen is gone — the garden blooms again!';
    this.sounds.victory = true;
  }

  loseGame(cause) {
    this.over = true;
    this.won = false;
    this.overCause = cause;
    this.sounds.gameover = true;
  }

  // ---- particles -----------------------------------------------------------------

  burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = this.rng.angle();
      const s = this.rng.range(speed * 0.3, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: this.rng.range(0.25, 0.6), maxLife: 0.6,
        size: this.rng.range(2, 5), color, grav: 60,
      });
    }
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
  }

  /** Summary for the victory / game-over screens. */
  stats() {
    return {
      score: this.score, kills: this.kills, wave: this.wave, level: this.level,
      time: this.time, bestCombo: this.bestCombo, turrets: this.turretsPlanted,
      upgrades: this.upgradesTaken, sun: this.sun,
    };
  }
}
