import { CONFIG } from './config.js';
import { angleToPos } from './utils.js';

export class Player {
  constructor(color, angle) {
    this.color = color;
    this.angle = angle;
    this.direction = 1;
    this.alive = true;
  }

  update() {
    if (!this.alive) return;
    this.angle += CONFIG.playerSpeed * this.direction;
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
