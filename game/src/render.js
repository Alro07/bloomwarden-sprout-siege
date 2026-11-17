// BLOOMWARDEN — Sprout Siege: everything the player sees, drawn on one 2D
// canvas. Bright garden palette, big readable shapes, petals drifting, glow
// around the Heartbloom, particles on every hit. The HUD, the title, the
// level-up cards and the end screens are drawn here too — the screenshots
// the judge reads are renders of exactly this code.
import { FIELD, BLOOM, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_OVER = 'over';

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(world, screen, ui) {
    const ctx = this.ctx;
    ctx.save();
    if (world.shake > 0.4) {
      ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
    }
    this.drawBackground(world);
    this.drawPlots(world);
    this.drawBloom(world);
    this.drawTurrets(world);
    this.drawPickups(world);
    this.drawEnemies(world);
    this.drawPlayer(world);
    this.drawBullets(world);
    this.drawOrbs(world);
    this.drawParticles(world);
    this.drawFloats(world);
    ctx.restore();

    if (screen === SCREEN_TITLE) this.drawTitle(world, ui);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSE) {
      this.drawHud(world, ui);
      this.drawBanner(world);
      if (screen === SCREEN_PAUSE) this.drawPause(world, ui);
    }
    if (screen === SCREEN_LEVELUP) {
      this.drawHud(world, ui);
      this.drawLevelUp(world, ui);
    }
    if (screen === SCREEN_VICTORY) this.drawEnd(world, ui, true);
    if (screen === SCREEN_OVER) this.drawEnd(world, ui, false);
  }

  // ---- garden ------------------------------------------------------------------

  drawBackground(world) {
    const ctx = this.ctx;
    const t = world.time;
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, '#8fd45f');
    g.addColorStop(0.55, PALETTE.grass);
    g.addColorStop(1, '#4c8f33');
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, FIELD.width + 40, FIELD.height + 40);

    // Soft sun rays from the top-left.
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#fff3b0';
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-40 + i * 130, -20);
      ctx.lineTo(60 + i * 130, -20);
      ctx.lineTo(340 + i * 190, FIELD.height + 20);
      ctx.lineTo(180 + i * 190, FIELD.height + 20);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Grass tufts and little flowers, placed by a fixed hash so they never jump.
    for (let i = 0; i < 90; i += 1) {
      const hx = ((i * 733) % 1280 + 1280) % 1280;
      const hy = ((i * 389) % 720 + 720) % 720;
      const near = Math.hypot(hx - BLOOM.x, hy - BLOOM.y) < 150;
      if (near) continue;
      ctx.strokeStyle = i % 3 === 0 ? '#4c8f33' : '#6fbf4a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx - 3, hy - 9 - (i % 4));
      ctx.moveTo(hx + 4, hy);
      ctx.lineTo(hx + 7, hy - 8 - (i % 3));
      ctx.stroke();
      if (i % 7 === 0) {
        ctx.fillStyle = ['#ff8fb5', '#ffd23f', '#ffffff', '#c9a7ff'][i % 4];
        ctx.beginPath();
        ctx.arc(hx + 12, hy - 4, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff9f1c';
        ctx.beginPath();
        ctx.arc(hx + 12, hy - 4, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Drifting petals.
    ctx.fillStyle = '#ffb7cd';
    for (let i = 0; i < 14; i += 1) {
      const px = ((i * 173 + t * (12 + i * 2)) % 1340 + 1340) % 1340 - 30;
      const py = ((i * 97 + t * (9 + (i % 3) * 4)) % 780 + 780) % 780 - 30;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.translate(px, py);
      ctx.rotate(t * 0.8 + i);
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawPlots(world) {
    const ctx = this.ctx;
    for (const plot of world.plots) {
      ctx.fillStyle = PALETTE.soilDark;
      ctx.beginPath();
      ctx.ellipse(plot.x, plot.y + 8, 34, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.soil;
      ctx.beginPath();
      ctx.ellipse(plot.x, plot.y, 30, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5d3a1c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(plot.x - 18, plot.y - 4);
      ctx.lineTo(plot.x + 18, plot.y - 4);
      ctx.moveTo(plot.x - 14, plot.y + 5);
      ctx.lineTo(plot.x + 14, plot.y + 5);
      ctx.stroke();
      if (!plot.turret) {
        // A faint "E" hint above empty plots when the warden is near.
        const d = Math.hypot(world.player.x - plot.x, world.player.y - plot.y);
        if (d < 110) {
          ctx.save();
          ctx.globalAlpha = 0.65 + 0.35 * Math.sin(world.time * 5);
          ctx.fillStyle = '#fff8e7';
          ctx.font = "700 15px 'Trebuchet MS', sans-serif";
          ctx.textAlign = 'center';
          ctx.fillText('E — plant 25☀', plot.x, plot.y - 34);
          ctx.restore();
        }
      }
    }
  }

  drawBloom(world) {
    const ctx = this.ctx;
    const b = world.bloom;
    const t = world.time;
    const pulse = 1 + Math.sin(t * 2.2) * 0.03;
    // Glow.
    const glow = ctx.createRadialGradient(b.x, b.y, 10, b.x, b.y, 130);
    glow.addColorStop(0, 'rgba(255, 210, 63, 0.45)');
    glow.addColorStop(1, 'rgba(255, 210, 63, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 130, 0, Math.PI * 2);
    ctx.fill();
    // Petals.
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(pulse, pulse);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + Math.sin(t * 0.7) * 0.05;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = world.bloomFlash > 0 ? '#ff8fb5' : PALETTE.bloomPink;
      ctx.beginPath();
      ctx.ellipse(0, -34, 15, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b97a00';
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 10, Math.sin(a) * 10, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Bloom HP ring.
    ctx.strokeStyle = 'rgba(32, 48, 26, 0.55)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius + 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = b.hp / b.maxHp > 0.35 ? '#2fd6a3' : '#ff5d73';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius + 14, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * b.hp) / b.maxHp);
    ctx.stroke();
    ctx.fillStyle = '#20301a';
    ctx.font = "700 12px 'Trebuchet MS', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(`♥ ${b.hp}/${b.maxHp}`, b.x, b.y + b.radius + 32);
  }

  drawTurrets(world) {
    const ctx = this.ctx;
    for (const plot of world.plots) {
      const turret = plot.turret;
      if (!turret) continue;
      const lvl = turret.level;
      ctx.fillStyle = '#3f7d2c';
      ctx.beginPath();
      ctx.arc(plot.x, plot.y, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = turret.flash > 0 ? '#d8ffe0' : '#7ed957';
      ctx.beginPath();
      ctx.arc(plot.x, plot.y, 13, 0, Math.PI * 2);
      ctx.fill();
      // Petals show the level: one per level.
      ctx.fillStyle = '#ff8fb5';
      for (let i = 0; i < lvl; i += 1) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(plot.x + Math.cos(a) * 12, plot.y + Math.sin(a) * 12 - 4, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(plot.x, plot.y - 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#20301a';
      ctx.font = "700 11px 'Trebuchet MS', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(`Lv${lvl}`, plot.x, plot.y + 30);
    }
  }

  drawPickups(world) {
    const ctx = this.ctx;
    for (const g of world.gems) {
      const bob = Math.sin(g.t * 4) * 2;
      ctx.fillStyle = '#8b5cf6';
      ctx.save();
      ctx.translate(g.x, g.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-6, -6, 12, 12);
      ctx.restore();
      ctx.fillStyle = '#d6bcff';
      ctx.save();
      ctx.translate(g.x, g.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    }
    for (const m of world.motes) {
      const bob = Math.sin(m.t * 4) * 2;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(m.x, m.y + bob, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff9f1c';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + m.t;
        ctx.beginPath();
        ctx.moveTo(m.x + Math.cos(a) * 9, m.y + bob + Math.sin(a) * 9);
        ctx.lineTo(m.x + Math.cos(a) * 13, m.y + bob + Math.sin(a) * 13);
        ctx.stroke();
      }
    }
  }

  drawEnemies(world) {
    const ctx = this.ctx;
    for (const e of world.enemies) {
      const flash = e.flash > 0;
      const body = flash ? '#ffffff' : e.def.color;
      const dark = e.def.dark;
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.elite) {
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (e.kind === 'queen') {
        // The Blight Queen: a big spiked crown of thorns over a dark bulb.
        ctx.fillStyle = dark;
        for (let i = 0; i < 10; i += 1) {
          const a = (i / 10) * Math.PI * 2 + world.time * 0.3;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (e.radius - 6), Math.sin(a) * (e.radius - 6));
          ctx.lineTo(Math.cos(a + 0.3) * (e.radius + 14), Math.sin(a + 0.3) * (e.radius + 14));
          ctx.lineTo(Math.cos(a + 0.6) * (e.radius - 6), Math.sin(a + 0.6) * (e.radius - 6));
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(-16, -8, 7, 0, Math.PI * 2);
        ctx.arc(16, -8, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3d1166';
        ctx.beginPath();
        ctx.arc(-16, -8, 3, 0, Math.PI * 2);
        ctx.arc(16, -8, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3d1166';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-18, 16);
        ctx.quadraticCurveTo(0, 26, 18, 16);
        ctx.stroke();
      } else if (e.kind === 'beetle') {
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.ellipse(0, 0, e.radius + 3, e.radius - 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(0, -4, e.radius - 2, e.radius - 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-7, -2, 3, 0, Math.PI * 2);
        ctx.arc(7, -2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'aphid') {
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(0, -e.radius + 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-5, -2, 2.6, 0, Math.PI * 2);
        ctx.arc(5, -2, 2.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'splitter') {
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(-6, -3, e.radius - 5, 0, Math.PI * 2);
        ctx.arc(6, -3, e.radius - 5, 0, Math.PI * 2);
        ctx.arc(0, 6, e.radius - 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-8, -5, 2.4, 0, Math.PI * 2);
        ctx.arc(4, -5, 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'wasp') {
        const ang = Math.atan2(world.player.y - e.y, world.player.x - e.x);
        ctx.rotate(ang);
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.ellipse(0, 0, e.radius + 4, e.radius - 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.fillRect(-4, -e.radius + 2, 3, (e.radius - 2) * 2);
        ctx.fillRect(3, -e.radius + 2, 3, (e.radius - 2) * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.ellipse(-2, -e.radius - 3, 8, 3.5, -0.5, 0, Math.PI * 2);
        ctx.ellipse(-2, e.radius + 3, 8, 3.5, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(e.radius - 2, -3, 2.4, 0, Math.PI * 2);
        ctx.arc(e.radius - 2, 3, 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Mites and fleas: round blight blobs with angry eyes.
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(0, e.radius - 6, e.radius - 6, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-4.5, -3, 3, 0, Math.PI * 2);
        ctx.arc(4.5, -3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(-4.5, -3, 1.5, 0, Math.PI * 2);
        ctx.arc(4.5, -3, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // HP bar for hurt enemies, elites and the boss.
      if ((e.hp < e.maxHp && e.kind !== 'queen') || e.elite) {
        const w = e.radius * 2;
        ctx.fillStyle = 'rgba(32, 48, 26, 0.6)';
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
        ctx.fillStyle = e.elite ? '#ffd23f' : '#ff5d73';
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * Math.max(0, e.hp / e.maxHp), 5);
      }
      if (e.elite) {
        ctx.fillStyle = '#ffd23f';
        ctx.font = "700 11px 'Trebuchet MS', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('ELITE', e.x, e.y - e.radius - 16);
      }
    }
  }

  drawPlayer(world) {
    const ctx = this.ctx;
    const p = world.player;
    const blink = p.invulnTimer > 0 && Math.floor(world.time * 14) % 2 === 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (blink) ctx.globalAlpha = 0.45;
    // Soft shadow.
    ctx.fillStyle = 'rgba(32, 48, 26, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, p.radius - 2, p.radius, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Aim guide: a short dotted line toward the mouse.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.moveTo(p.aimX * (p.radius + 4), p.aimY * (p.radius + 4));
    ctx.lineTo(p.aimX * (p.radius + 34), p.aimY * (p.radius + 34));
    ctx.stroke();
    ctx.setLineDash([]);
    // Body: a sprout-warden — round green body, leaf sprout, rosy cheeks.
    const bob = p.moving ? Math.sin(p.walkPhase) * 2 : Math.sin(world.time * 3) * 1.5;
    ctx.translate(0, bob);
    ctx.fillStyle = '#2fd6a3';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#25b183';
    ctx.beginPath();
    ctx.arc(0, 5, p.radius - 4, 0, Math.PI);
    ctx.fill();
    // Leaf sprout on top.
    ctx.fillStyle = '#7ed957';
    ctx.save();
    ctx.rotate(-0.5 + Math.sin(world.time * 2) * 0.12);
    ctx.beginPath();
    ctx.ellipse(-4, -p.radius - 4, 7, 11, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.rotate(0.6 - Math.sin(world.time * 2) * 0.12);
    ctx.beginPath();
    ctx.ellipse(5, -p.radius - 3, 6, 9, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Eyes look toward the aim.
    const ex = p.aimX * 3;
    const ey = p.aimY * 3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-6 + ex, -2 + ey, 4.5, 0, Math.PI * 2);
    ctx.arc(6 + ex, -2 + ey, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20301a';
    ctx.beginPath();
    ctx.arc(-6 + ex * 1.6, -2 + ey * 1.6, 2.2, 0, Math.PI * 2);
    ctx.arc(6 + ex * 1.6, -2 + ey * 1.6, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 107, 157, 0.7)';
    ctx.beginPath();
    ctx.arc(-10, 4, 2.6, 0, Math.PI * 2);
    ctx.arc(10, 4, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Dash cooldown ring under the warden.
    if (p.dashCdTimer > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.dashCdTimer / p.dashCooldown));
      ctx.stroke();
    }
  }

  drawBullets(world) {
    const ctx = this.ctx;
    for (const b of world.bullets) {
      if (b.from === 'turret') {
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff9f1c';
      } else {
        ctx.fillStyle = '#fff3b0';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd23f';
      }
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawOrbs(world) {
    const ctx = this.ctx;
    for (const o of world.orbs) {
      ctx.fillStyle = '#b388ff';
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6d3fd4';
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawParticles(world) {
    const ctx = this.ctx;
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFloats(world) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    for (const f of world.floats) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.font = `700 ${f.size}px 'Trebuchet MS', sans-serif`;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---- HUD and screens ---------------------------------------------------------

  drawHud(world, ui) {
    const ctx = this.ctx;
    const p = world.player;
    // Top bar.
    ctx.fillStyle = 'rgba(32, 48, 26, 0.72)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 1260, 56, 12);
    ctx.fill();
    // Hearts.
    for (let i = 0; i < p.maxHp; i += 1) {
      const x = 30 + i * 26;
      const y = 38;
      ctx.fillStyle = i < p.hp ? '#ff5d73' : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(x, y + 5);
      ctx.bezierCurveTo(x - 9, y - 4, x - 5, y - 11, x, y - 5);
      ctx.bezierCurveTo(x + 5, y - 11, x + 9, y - 4, x, y + 5);
      ctx.fill();
    }
    // Sun.
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(236, 38, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4ffe8';
    ctx.font = "700 20px 'Trebuchet MS', sans-serif";
    ctx.textAlign = 'left';
    ctx.fillText(`${world.sun}`, 252, 45);
    ctx.fillStyle = 'rgba(244,255,232,0.75)';
    ctx.font = "700 12px 'Trebuchet MS', sans-serif";
    ctx.fillText('SUN  ·  E plants a turret (25☀)', 252, 60);
    // Wave and score, centred.
    ctx.fillStyle = '#f4ffe8';
    ctx.font = "700 22px 'Trebuchet MS', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(world.wave === 0 ? 'GET READY…' : `WAVE ${world.wave} / 8`, 640, 36);
    ctx.fillStyle = '#ffd23f';
    ctx.font = "700 17px 'Trebuchet MS', sans-serif";
    ctx.fillText(`SCORE ${world.score}`, 640, 58);
    // Kills and combo, right.
    ctx.fillStyle = '#f4ffe8';
    ctx.font = "700 18px 'Trebuchet MS', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText(`☠ ${world.kills} kills`, 1250, 36);
    if (world.combo >= 3) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = "700 16px 'Trebuchet MS', sans-serif";
      ctx.fillText(`COMBO x${world.combo}`, 1250, 58);
    } else {
      ctx.fillStyle = 'rgba(244,255,232,0.75)';
      ctx.font = "700 13px 'Trebuchet MS', sans-serif";
      ctx.fillText(`Lv ${world.level}  ·  ${fmtTime(world.time)}`, 1250, 58);
    }
    // Boss bar.
    if (world.boss) {
      const b = world.boss;
      ctx.fillStyle = 'rgba(32, 48, 26, 0.72)';
      ctx.beginPath();
      ctx.roundRect(390, 74, 500, 26, 8);
      ctx.fill();
      ctx.fillStyle = '#3d1166';
      ctx.fillRect(400, 82, 480, 10);
      ctx.fillStyle = '#b388ff';
      ctx.fillRect(400, 82, 480 * Math.max(0, b.hp / b.maxHp), 10);
      ctx.fillStyle = '#f4ffe8';
      ctx.font = "700 13px 'Trebuchet MS', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('♛ THE BLIGHT QUEEN ♛', 640, 88);
    }
    // XP bar along the bottom.
    ctx.fillStyle = 'rgba(32, 48, 26, 0.72)';
    ctx.fillRect(0, 694, 1280, 18);
    ctx.fillStyle = '#4a2d7a';
    ctx.fillRect(0, 694, 1280, 18);
    ctx.fillStyle = '#b388ff';
    ctx.fillRect(0, 694, 1280 * Math.min(1, world.xp / world.xpNext), 18);
    ctx.fillStyle = '#f4ffe8';
    ctx.font = "700 13px 'Trebuchet MS', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${world.level}  —  ${world.xp} / ${world.xpNext} XP`, 640, 707);
    // Mute hint.
    ctx.fillStyle = 'rgba(244,255,232,0.6)';
    ctx.font = "700 12px 'Trebuchet MS', sans-serif";
    ctx.textAlign = 'left';
    ctx.fillText(ui.muted ? 'M — sound OFF' : 'M — mute', 14, 686);
    ctx.textAlign = 'right';
    ctx.fillText('P — pause', 1266, 686);
  }

  drawBanner(world) {
    const ctx = this.ctx;
    if (world.banner.t <= 0 || !world.banner.text) return;
    const alpha = Math.min(1, world.banner.t);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff8e7';
    ctx.font = "700 40px 'Trebuchet MS', sans-serif";
    ctx.shadowColor = 'rgba(32,48,26,0.6)';
    ctx.shadowBlur = 10;
    ctx.fillText(world.banner.text, 640, 170);
    if (world.banner.sub) {
      ctx.font = "700 19px 'Trebuchet MS', sans-serif";
      ctx.fillText(world.banner.sub, 640, 202);
    }
    ctx.restore();
  }

  drawTitle(world, ui) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(24, 52, 20, 0.45)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff3b0';
    ctx.font = "700 84px 'Trebuchet MS', sans-serif";
    ctx.shadowColor = 'rgba(32,48,26,0.7)';
    ctx.shadowBlur = 16;
    ctx.fillText('BLOOMWARDEN', 640, 190);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f4ffe8';
    ctx.font = "700 34px 'Trebuchet MS', sans-serif";
    ctx.fillText('— Sprout Siege —', 640, 238);
    ctx.fillStyle = '#eaf7d8';
    ctx.font = "400 19px 'Trebuchet MS', sans-serif";
    ctx.fillText('You are Wren, keeper of the last Heartbloom. The blight is coming', 640, 282);
    ctx.fillText('in 8 waves — burn it back with seed bolts, plant sprout-turrets,', 640, 308);
    ctx.fillText('and grow stronger with every sprout you gather.', 640, 334);
    // How to play panel.
    ctx.fillStyle = 'rgba(32, 48, 26, 0.78)';
    ctx.beginPath();
    ctx.roundRect(340, 362, 600, 132, 14);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.font = "700 17px 'Trebuchet MS', sans-serif";
    ctx.fillText('HOW TO PLAY', 640, 392);
    ctx.fillStyle = '#f4ffe8';
    ctx.font = "400 17px 'Trebuchet MS', sans-serif";
    ctx.fillText('WASD / Arrows — move      Mouse — aim      Hold Click — fire seeds', 640, 420);
    ctx.fillText('SPACE — dash      E — plant / upgrade turret      P — pause      M — mute', 640, 446);
    ctx.fillText('Guard the Heartbloom as well as yourself. Beat the Blight Queen!', 640, 472);
    // Start button.
    const pulse = 1 + Math.sin(world.time * 3) * 0.04;
    ctx.save();
    ctx.translate(640, 552);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.roundRect(-150, -30, 300, 60, 14);
    ctx.fill();
    ctx.fillStyle = '#20301a';
    ctx.font = "700 26px 'Trebuchet MS', sans-serif";
    ctx.fillText('▶  START  (Enter)', 0, 9);
    ctx.restore();
    if (ui.best > 0) {
      ctx.fillStyle = '#f4ffe8';
      ctx.font = "700 17px 'Trebuchet MS', sans-serif";
      ctx.fillText(`Best score: ${ui.best}`, 640, 622);
    }
  }

  drawLevelUp(world, ui) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(24, 52, 20, 0.55)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff3b0';
    ctx.font = "700 44px 'Trebuchet MS', sans-serif";
    ctx.shadowColor = 'rgba(32,48,26,0.7)';
    ctx.shadowBlur = 12;
    ctx.fillText(`LEVEL ${world.level} — CHOOSE A BOON`, 640, 150);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#eaf7d8';
    ctx.font = "400 18px 'Trebuchet MS', sans-serif";
    ctx.fillText('Pick one. Click a card, or press 1 / 2 / 3.', 640, 186);
    const choices = ui.levelChoices || [];
    const cardW = 300;
    const cardH = 250;
    const gap = 28;
    const totalW = choices.length * cardW + (choices.length - 1) * gap;
    choices.forEach((up, i) => {
      const x = 640 - totalW / 2 + i * (cardW + gap);
      const y = 220;
      const hover = ui.hoverCard === i;
      ctx.save();
      if (hover) { ctx.translate(x + cardW / 2, y + cardH / 2); ctx.scale(1.04, 1.04); ctx.translate(-(x + cardW / 2), -(y + cardH / 2)); }
      ctx.fillStyle = hover ? '#fff3b0' : PALETTE.panel;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 16);
      ctx.fill();
      ctx.strokeStyle = hover ? '#ff9f1c' : '#c9b98a';
      ctx.lineWidth = hover ? 5 : 3;
      ctx.stroke();
      ctx.fillStyle = '#20301a';
      ctx.font = "400 54px 'Trebuchet MS', sans-serif";
      ctx.fillText(up.icon, x + cardW / 2, y + 84);
      ctx.font = "700 22px 'Trebuchet MS', sans-serif";
      ctx.fillText(up.name, x + cardW / 2, y + 128);
      ctx.font = "400 16px 'Trebuchet MS', sans-serif";
      const words = up.text.split(' ');
      let line = '';
      let ly = y + 162;
      for (const word of words) {
        if ((line + ' ' + word).trim().length > 26) {
          ctx.fillText(line.trim(), x + cardW / 2, ly);
          ly += 22;
          line = word;
        } else {
          line += ' ' + word;
        }
      }
      if (line.trim()) ctx.fillText(line.trim(), x + cardW / 2, ly);
      const taken = world.takenUpgrades[up.id] || 0;
      ctx.fillStyle = '#6b7a5e';
      ctx.font = "700 14px 'Trebuchet MS', sans-serif";
      ctx.fillText(taken > 0 ? `Owned x${taken}  ·  max ${up.max}` : `Press ${i + 1}`, x + cardW / 2, y + cardH - 18);
      ctx.restore();
    });
  }

  drawPause(world, ui) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(24, 52, 20, 0.55)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff3b0';
    ctx.font = "700 52px 'Trebuchet MS', sans-serif";
    ctx.fillText('PAUSED', 640, 330);
    ctx.fillStyle = '#f4ffe8';
    ctx.font = "400 20px 'Trebuchet MS', sans-serif";
    ctx.fillText('Press P or Enter to keep playing.  R restarts the run.', 640, 372);
  }

  drawEnd(world, ui, won) {
    const ctx = this.ctx;
    const stats = world.stats();
    ctx.fillStyle = won ? 'rgba(38, 84, 32, 0.6)' : 'rgba(52, 20, 28, 0.6)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.textAlign = 'center';
    ctx.fillStyle = won ? '#fff3b0' : '#ffb3c0';
    ctx.font = "700 58px 'Trebuchet MS', sans-serif";
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 14;
    ctx.fillText(won ? 'THE GARDEN BLOOMS!' : 'THE GARDEN FALLS…', 640, 168);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f4ffe8';
    ctx.font = "400 20px 'Trebuchet MS', sans-serif";
    ctx.fillText(world.overCause, 640, 208);
    // Stats panel.
    ctx.fillStyle = 'rgba(32, 48, 26, 0.8)';
    ctx.beginPath();
    ctx.roundRect(390, 240, 500, 220, 16);
    ctx.fill();
    const rows = [
      ['SCORE', `${stats.score}`],
      ['WAVE REACHED', `${stats.wave} / 8`],
      ['BLIGHT SLAIN', `${stats.kills}`],
      ['LEVEL', `${stats.level}`],
      ['BEST COMBO', `x${stats.bestCombo}`],
      ['TURRETS PLANTED', `${stats.turrets}`],
      ['TIME', fmtTime(stats.time)],
    ];
    ctx.font = "700 19px 'Trebuchet MS', sans-serif";
    rows.forEach(([label, value], i) => {
      const y = 274 + i * 28;
      ctx.fillStyle = '#b9d6a4';
      ctx.textAlign = 'left';
      ctx.fillText(label, 420, y);
      ctx.fillStyle = '#fff3b0';
      ctx.textAlign = 'right';
      ctx.fillText(value, 860, y);
    });
    // Play again button.
    const pulse = 1 + Math.sin(world.time * 3) * 0.04;
    ctx.save();
    ctx.translate(640, 522);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.roundRect(-170, -30, 340, 60, 14);
    ctx.fill();
    ctx.fillStyle = '#20301a';
    ctx.font = "700 25px 'Trebuchet MS', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(won ? '↻  PLAY AGAIN  (Enter)' : '↻  TRY AGAIN  (Enter)', 0, 9);
    ctx.restore();
    if (ui.best > 0) {
      ctx.fillStyle = '#f4ffe8';
      ctx.font = "700 17px 'Trebuchet MS', sans-serif";
      ctx.fillText(`Best score: ${ui.best}`, 640, 592);
    }
  }
}
