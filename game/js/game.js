import { Player } from './player.js';
import { CONFIG } from './config.js';

/* ===================== GAME ===================== */



export class Game {
  constructor(canvas, playerCount, testMode = false) {
    this.ctx = canvas.getContext('2d');
    this.canvas = canvas;

    this.centerX = canvas.width / 2;
    this.centerY = canvas.height / 2;

    this.players = [];
    const colors = ['blue', 'green', 'red', 'yellow'];

    for (let i = 0; i < playerCount; i++) {
      const angle = (Math.PI * 2 / playerCount) * i;
      this.players.push(new Player(colors[i], angle));
    }

    this.scores = {};
    this.players.forEach(p => {
      this.scores[p.color] = testMode ? 50 : 0; // Тест-режим
    });

    this.currentAttack = null;
    this.nextAttackTime = Date.now() + 1000;

    this.testMode = testMode;

    this.setupInput(playerCount);
    this.loop();
  }

  setupInput(playerCount) {
    const controlDiv = document.getElementById('controls');
    controlDiv.classList.remove('hidden');

    const btns = ['btnBlue', 'btnGreen', 'btnRed', 'btnYellow'];
    btns.forEach((id, i) => {
      const btn = document.getElementById(id);
      if (i < playerCount) {
        btn.style.display = 'block';
        btn.onpointerdown = e => {
          e.preventDefault();
          this.players[i].switchDirection();
        };
      } else btn.style.display = 'none';
    });

    // Сразу обновляем очки на кнопках
    this.updateButtonScores();
  }

  // -------------------- метод для обновления очков на кнопках --------------------
  updateButtonScores() {
    const btns = {
      blue: document.getElementById('btnBlue'),
      green: document.getElementById('btnGreen'),
      red: document.getElementById('btnRed'),
      yellow: document.getElementById('btnYellow')
    };

    for (let color in this.scores) {
      const btn = btns[color];
      if (btn) {
        btn.textContent = this.scores[color];  // вывод очков на кнопке
        btn.style.color = 'white';
        btn.style.fontWeight = 'bold';
        btn.style.textAlign = 'center';
      }
    }
  }

  update() {
    const now = Date.now();
    this.players.forEach(p => p.update());

    if (!this.currentAttack && now > this.nextAttackTime) {
      this.startNextAttack();
    }

    if (this.currentAttack) {
      this.currentAttack.update();
      if (this.currentAttack.done) {
        // начисляем очки
        this.players.forEach(p => {
          if (p.alive) this.scores[p.color]++;
        });

        this.updateButtonScores(); // обновление кнопок

        this.currentAttack = null;
        this.nextAttackTime = now + 600;
      }
    }

    this.players.forEach(p => {
      if (!p.alive || !this.currentAttack) return;
      const pos = this.getPlayerPos(p);
      if (this.currentAttack.hitsPlayer?.(pos.x, pos.y)) {
        p.alive = false;
      }
    });
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // круг
    this.ctx.strokeStyle = 'white';
    this.ctx.beginPath();
    this.ctx.arc(this.centerX, this.centerY, CONFIG.circleRadius, 0, Math.PI * 2);
    this.ctx.stroke();

    // босс
    this.ctx.save();
    this.ctx.translate(this.centerX, this.centerY);
    this.ctx.beginPath();
    this.ctx.moveTo(0, -30);
    this.ctx.lineTo(-25, 20);
    this.ctx.lineTo(25, 20);
    this.ctx.closePath();
    this.ctx.fillStyle = 'white';
    this.ctx.fill();
    this.ctx.restore();

    // игроки
    this.players.forEach(p => p.draw(this.ctx, this.centerX, this.centerY));

    // текущая атака
    this.currentAttack?.draw(this.ctx);
  }

  loop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }

  getPlayerPos(p) {
    return {
      x: this.centerX + Math.cos(p.angle) * CONFIG.circleRadius,
      y: this.centerY + Math.sin(p.angle) * CONFIG.circleRadius
    };
  }

    startNextAttack() {
    const list = [
      FireballAttack,
      RocketAttack,
      ZoneAttack,
      LaserAttack,
      AcidAttack
    ];
    const A = list[Math.floor(Math.random() * list.length)];
    this.currentAttack = new A(this.centerX, this.centerY, this.scores);
  }
}



/* ===================== FIREBALLS ===================== */

class FireballAttack {
  constructor(cx, cy, scores) {
    this.cx = cx;
    this.cy = cy;
    this.scores = scores;

    this.objects = [];
    this.done = false;

    this.series = 3;
    this.currentSeries = 0;

    this.startSeries();
  }

  startSeries() {
    if (this.currentSeries >= this.series) {
      this.done = true;
      return;
    }

    this.currentSeries++;

    const maxPlayerScore = Object.values(this.scores).reduce((a, b) => a + b, 0);
    const count = 5 + Math.floor(maxPlayerScore / 5);

    this.objects = []; // очищаем старые точки и фаерболы

    const targets = [];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const x = this.cx + Math.cos(angle) * CONFIG.circleRadius;
      const y = this.cy + Math.sin(angle) * CONFIG.circleRadius;

      targets.push({ angle });

      // белая метка
      this.objects.push({
        x,
        y,
        type: 'marker'
      });
    }

    // через 500мс стреляем
    setTimeout(() => {
      this.objects = []; // убираем метки

      targets.forEach(t => {
        this.objects.push({
          x: this.cx,
          y: this.cy,
          vx: Math.cos(t.angle) * (4 + maxPlayerScore / 100),// скорость фаеров
          vy: Math.sin(t.angle) * (4 + maxPlayerScore / 100),
          r: 8,
          type: 'fireball'
        });
      });
    }, 1000);

    // следующая серия
    setTimeout(() => this.startSeries(), 2100);
  }

  update() {
    this.objects.forEach(o => {
      if (o.type === 'fireball') {
        o.x += o.vx;
        o.y += o.vy;
      }
    });
  }

  hitsPlayer(px, py) {
    return this.objects.some(
      o =>
        o.type === 'fireball' &&
        Math.hypot(px - o.x, py - o.y) < o.r + 8
    );
  }

  draw(ctx) {
    this.objects.forEach(o => {
      if (o.type === 'marker') {
        ctx.fillStyle = 'white';
        ctx.font = '25px Arial';
        ctx.fillText('⦻', o.x - 12, o.y + 12); // белый эмодзи
      } else {
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
}



/* ===================== ROCKET ===================== */

class RocketAttack { 
  constructor(cx, cy, scores) {
    this.cx = cx;
    this.cy = cy;

    this.warnings = [];
    this.rockets = [];
    this.done = false;

    const maxPlayerScore = Math.max(...Object.values(scores));

    // ---------- НАСТРОЙКИ ----------
    this.rocketCount = maxPlayerScore < 10 ? 2 : 3
    this.speedMult = maxPlayerScore >= 30 ? 3 : maxPlayerScore >= 20 ? 2 : 1;

    // ---------- СПАВНЫ ----------
    const SPAWNS = [
      { x: 0, y: -CONFIG.circleRadius - 70, vx: 0, vy: 3 },   // сверху
      { x: 0, y:  CONFIG.circleRadius + 70, vx: 0, vy: -3 }, // снизу
      { x: -CONFIG.circleRadius - 70, y: 0, vx: 3, vy: 0 },  // слева
      { x:  CONFIG.circleRadius + 70, y: 0, vx: -3, vy: 0 }  // справа
    ];

    const spawn = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];

    // ---------- СМЕЩЕНИЯ ----------
    const towerOffset = 130;

    const verticalOffsets = [
      { x: -130, y: 0 },
      { x: 130,    y: 0 },
      { x: 0,  y: 0 }
    ];

    const horizontalOffsets = [
      { x: 0, y: -towerOffset },
      { x: 0, y: 130 },
      { x: 0, y: 0, towerOffset }
    ];

    const isHorizontal = spawn.vx !== 0;
    const OFFSETS = isHorizontal ? horizontalOffsets : verticalOffsets;

    // ---------- СПАВН РАКЕТ И ПРЕДУПРЕЖДЕНИЯ ----------
    for (let i = 0; i < this.rocketCount; i++) {
      const off = OFFSETS[i] || { x: 0, y: 0 };

      const x = this.cx + spawn.x + off.x;
      const y = this.cy + spawn.y + off.y;

      // ⚠️ предупреждение ближе к кругу
      const factor = 0.8; // 0.85 = смещаем к центру
      const warningX = this.cx + (x - this.cx) * factor;
      const warningY = this.cy + (y - this.cy) * factor;
      this.warnings.push({ x: warningX, y: warningY });

      // ракета вылетает через 1 секунду
      setTimeout(() => {
        this.rockets.push({
          x,
          y,
          vx: spawn.vx * this.speedMult,
          vy: spawn.vy * this.speedMult
        });
      }, 1500);
    }

    // удалить все предупреждения
    setTimeout(() => { this.warnings.length = 0; }, 1000);

    // атака завершена
    setTimeout(() => { this.done = true; }, 5000);
  }

  update() {
    this.rockets.forEach(r => {
      r.x += r.vx;
      r.y += r.vy;
    });
  }

  hitsPlayer(px, py) {
    return this.rockets.some(
      r => Math.hypot(px - r.x, py - r.y) < 16
    );
  }

  draw(ctx) {
    // ⚠️ предупреждения
    ctx.font = '24px Arial';
    this.warnings.forEach(w => {
      ctx.fillText('⚠️', w.x - 12, w.y + 12);
    });

    // 🚀 ракеты
    ctx.fillStyle = 'red';
    this.rockets.forEach(r => {
      ctx.fillRect(r.x - 8, r.y - 8, 16, 16);
    });
  }
}


/* ===================== ZONE ===================== */

class ZoneAttack {
  constructor(cx, cy, scores) {
    this.cx = cx;
    this.cy = cy;

    const maxPlayerScore = scores
      ? Object.values(scores).reduce((a, b) => a + b, 0)
      : 0;

    // ---- размер зоны ----
    let part = 0.1;          // 10%
    if (maxPlayerScore >= 10) part = 0.2;
    if (maxPlayerScore >= 15) part = 0.3;
    if (maxPlayerScore >= 20) part = 0.4;
    if (maxPlayerScore >= 25) part = 0.5;
    if (maxPlayerScore >= 30) part = 0.6;
    if (maxPlayerScore >= 35) part = 0.7;
    if (maxPlayerScore >= 40) part = 0.8;
    if (maxPlayerScore >= 45) part = 0.9;

    this.size = Math.PI * 2 * part;

    this.start = Math.random() * Math.PI * 2;
    this.end = this.start + this.size;

    this.deadly = false;
    this.done = false;

    setTimeout(() => (this.deadly = true), 2000);
    setTimeout(() => (this.done = true), 3000);
  }

  update() {}

  hitsPlayer(px, py) {
    if (!this.deadly) return false;

    // угол игрока 0..2π
    let a = Math.atan2(py - this.cy, px - this.cx);
    if (a < 0) a += Math.PI * 2;

    // нормализация границ зоны
    let s = this.start % (Math.PI * 2);
    let e = this.end % (Math.PI * 2);
    if (s < 0) s += Math.PI * 2;
    if (e < 0) e += Math.PI * 2;

    if (s <= e) {
      return a >= s && a <= e;
    } else {
      return a >= s || a <= e;
    }
  }

  draw(ctx) {
    ctx.fillStyle = this.deadly
      ? 'rgba(255,0,0,0.5)'
      : 'rgba(255,255,255,0.2)';

    ctx.beginPath();
    ctx.moveTo(this.cx, this.cy);
    ctx.arc(this.cx, this.cy, CONFIG.circleRadius, this.start, this.end);
    ctx.closePath();
    ctx.fill();
  }
}


/* ===================== LASER ===================== */

class LaserAttack {
  constructor(cx, cy, scores) {
    this.cx = cx;
    this.cy = cy;
    this.maxPlayerScore = Object.values(scores).reduce((a, b) => a + b, 0);

    this.rotationSpeed = 0.011;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.angle = 0;

    this.lasers = [0];
    if (this.maxPlayerScore >= 15) {
      this.lasers.push(Math.PI / 2, Math.PI / 4);
    }

    this.active = false;
    this.done = false;

    const prep = this.maxPlayerScore >= 20 ? 1000 : 1500;
    setTimeout(() => (this.active = true), prep);
    setTimeout(() => (this.done = true), prep + 5250);
  }

  update() {
    this.angle += this.rotationSpeed * this.dir;
  }

  hitsPlayer(px, py) {
    if (!this.active) return false;
    return this.lasers.some(off => {
      const ang = this.angle + off;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const t = (px - this.cx) * dx + (py - this.cy) * dy;
      const lx = this.cx + t * dx;
      const ly = this.cy + t * dy;
      return Math.hypot(px - lx, py - ly) < 8;
    });
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.cx, this.cy);
    this.lasers.forEach(off => {
      ctx.rotate(this.angle + off);
      ctx.strokeStyle = this.active ? 'red' : 'rgba(255,0,0,0.3)';
      ctx.lineWidth = this.active ? 8 : 2;
      ctx.beginPath();
      ctx.moveTo(-CONFIG.circleRadius, 0);
      ctx.lineTo(CONFIG.circleRadius, 0);
      ctx.stroke();
      ctx.rotate(-(this.angle + off));
    });
    ctx.restore();
  }
}

/* ===================== ACID ===================== */

class AcidAttack {
  constructor(cx, cy) {
    this.objects = [];
    this.done = false;

    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      this.objects.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * 2,
        vy: Math.sin(a) * 2,
        r: 20
      });
    }

    setTimeout(() => (this.done = true), 4500);
  }

  update() {
    this.objects.forEach(a => {
      a.x += a.vx;
      a.y += a.vy;
    });
  }

  hitsPlayer(px, py) {
    return this.objects.some(a => Math.hypot(px - a.x, py - a.y) < a.r);
  }

  draw(ctx) {
    ctx.fillStyle = 'green';
    this.objects.forEach(a => {
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
