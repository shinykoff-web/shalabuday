import { CONFIG } from './config.js';
import { angleToPos } from './utils.js';

export class Player {
  constructor(color, angle) {
    this.color = color;
    this.angle = angle;
    this.direction = 1;
    this.alive = true;
    // ===== Ability system =====
    this.abilityReady = true;
    this.abilityCooldown = 10000;
    this.abilityCooldownTimer = 0;

    this.holdTime = 0;
    this.holdThreshold = 200; // 0.2 сек

    this.activeAbility = null; 
    // 'shield' | 'immune_fire' | 'immune_acid' | 'immune_bomb'

    this.shieldActive = false;
    this.shieldTimer = 0;
    this.shieldBlinking = false;

    this.immunityType = null; // 'fire' | 'acid' | 'bomb'
    this.immunityUsed = false;

  }

  update(dt = 16) {
  if (!this.alive) return;

  this.angle += CONFIG.playerSpeed * this.direction;

  // кулдаун способности
  if (!this.abilityReady) {
    this.abilityCooldownTimer -= dt;
    if (this.abilityCooldownTimer <= 0) {
      this.abilityReady = true;
      this.abilityCooldownTimer = 0;
    }
  }

  // щит
  if (this.shieldActive) {
    this.shieldTimer -= dt;
    if (this.shieldTimer <= 0) {
      this.shieldActive = false;
      this.shieldBlinking = false;
    }
  }
}


  draw(ctx, cx, cy) {
    if (!this.alive) return;
    const pos = angleToPos(this.angle, CONFIG.circleRadius, cx, cy);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }

  switchDirection() {
    this.direction *= -1;
  }
}

