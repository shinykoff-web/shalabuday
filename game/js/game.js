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
    this.testMode = testMode;
    this.godMode = false; // бессмертие по умолчанию выключено

    // сразу применяем очки для тест режима
    this.players.forEach(p => {
      this.scores[p.color] = this.testMode ? 50 : 0;
    });

    this.currentAttack = null;
    this.nextAttackTime = Date.now() + 1000;

    this.setupInput(playerCount);
    this.setupRespawnBind();
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

    // -------------------- тест режим --------------------
    const testModeCheckbox = document.getElementById('testMode');
    if (testModeCheckbox) {
      testModeCheckbox.checked = this.testMode; // синхронизируем чекбокс с текущим состоянием
      testModeCheckbox.onchange = () => {
        this.testMode = testModeCheckbox.checked;
        this.players.forEach(p => (this.scores[p.color] = this.testMode ? 50 : 0));
        this.updateButtonScores();
      };
    }

    // -------------------- обновляем очки --------------------
    this.updateButtonScores();
  }

  setupRespawnBind() {
    // Нажатие R включает/выключает бессмертие
    window.addEventListener('keydown', e => {
      if (e.key.toLowerCase() === 'r') {
        this.godMode = !this.godMode;
        console.log(`GodMode: ${this.godMode ? 'ON' : 'OFF'}`);
      }
    });
  }

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
        btn.textContent = this.scores[color];
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
        this.players.forEach(p => {
          if (p.alive) this.scores[p.color]++;
        });
        this.updateButtonScores();
        this.currentAttack = null;
        this.nextAttackTime = now + 600;
      }
    }

    this.players.forEach(p => {
      if (!p.alive || !this.currentAttack) return;
      const pos = this.getPlayerPos(p);
      if (!this.godMode && this.currentAttack.hitsPlayer?.(pos.x, pos.y)) {
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
      AcidAttack,
      GreenLaserAttack,
      StraightLaserAttack
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

    const score = Math.max(...Object.values(this.scores));

    // ---------- КОЛИЧЕСТВО ----------
    const baseCount = 5 + Math.floor(score / 5);
    const count = Math.min(15, baseCount);

    // ---------- СКОРОСТЬ ----------
    const extraSpeed =
      score <= 50 ? 0 : Math.min(4, (score - 50) / 12.5);
    const speed = 4 + extraSpeed;

    // ---------- ВРЕМЯ ПОДГОТОВКИ ----------
    const prepTime =
      score <= 50
        ? 1000
        : Math.max(500, 1000 - (score - 50) * 10);

    this.objects = [];
    const targets = [];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const x = this.cx + Math.cos(angle) * CONFIG.circleRadius;
      const y = this.cy + Math.sin(angle) * CONFIG.circleRadius;

      targets.push({ angle });

      // ⚠️ метка (эмодзи)
      this.objects.push({
        x,
        y,
        type: 'marker'
      });
    }

    // ---------- ВЫСТРЕЛ ----------
    setTimeout(() => {
      this.objects = [];

      targets.forEach(t => {
        this.objects.push({
          x: this.cx,
          y: this.cy,
          vx: Math.cos(t.angle) * speed,
          vy: Math.sin(t.angle) * speed,
          r: 8,
          type: 'fireball'
        });
      });
    }, prepTime);

    // ---------- СЛЕДУЮЩАЯ СЕРИЯ ----------
    setTimeout(() => this.startSeries(), prepTime + 1100);
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
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    this.objects.forEach(o => {
      if (o.type === 'marker') {
        ctx.fillStyle = 'white';
        ctx.fillText('⦻', o.x, o.y);
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

    this.rocketCount = maxPlayerScore < 10 ? 2 : 3;
    this.speedMult = maxPlayerScore >= 30 ? 3 : maxPlayerScore >= 20 ? 2 : 1;

    const SPAWNS = [
      { x: 0, y: -CONFIG.circleRadius - 70, vx: 0, vy: 3 },   // сверху
      { x: 0, y:  CONFIG.circleRadius + 70, vx: 0, vy: -3 }, // снизу
      { x: -CONFIG.circleRadius - 70, y: 0, vx: 3, vy: 0 },  // слева
      { x:  CONFIG.circleRadius + 70, y: 0, vx: -3, vy: 0 }  // справа
    ];

    const spawn = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];

    const towerOffset = 130;

    // смещения для самих ракет
    const verticalOffsets = [
      { x: -130, y: 0 },
      { x: 130, y: 0 },
      { x: 0, y: 0 }
    ];
    const horizontalOffsets = [
      { x: 0, y: -towerOffset },
      { x: 0, y: towerOffset },
      { x: 0, y: 0 }
    ];

    const isHorizontal = spawn.vx !== 0;
    const OFFSETS = isHorizontal ? horizontalOffsets : verticalOffsets;

    // ⚠️ отдельные смещения для предупреждений
    const verticalWarningOffsets = [
      { x: -25, y: 0 },
      { x: 25, y: 0 },
      { x: 0, y: 0 }
    ];
    const horizontalWarningOffsets = [
      { x: 0, y: -25 },
      { x: 0, y: 25 },
      { x: 0, y: 0 }
    ];
    const WARNING_OFFSETS = isHorizontal ? horizontalWarningOffsets : verticalWarningOffsets;

    for (let i = 0; i < this.rocketCount; i++) {
      const off = OFFSETS[i] || { x: 0, y: 0 };
      const x = this.cx + spawn.x + off.x;
      const y = this.cy + spawn.y + off.y;

      // предупреждение ближе к центру
      const factor = 0.8;
      let warningX = this.cx + (x - this.cx) * factor;
      let warningY = this.cy + (y - this.cy) * factor;

      // применяем смещение только для этой группы
      const extra = WARNING_OFFSETS[i] || { x: 0, y: 0 };
      warningX += extra.x;
      warningY += extra.y;

      this.warnings.push({ x: warningX, y: warningY });

      // ракета вылетает через 1.5 секунды
      setTimeout(() => {
        this.rockets.push({
          x,
          y,
          vx: spawn.vx * this.speedMult,
          vy: spawn.vy * this.speedMult
        });
      }, 1500);
    }

    setTimeout(() => { this.warnings.length = 0; }, 1000);
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
    ctx.font = '24px Arial';
    this.warnings.forEach(w => {
      ctx.fillText('⚠️', w.x - 12, w.y + 12);
    });

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

/* ===================== StraightLaserAttack  ===================== */
class StraightLaserAttack {
  constructor(cx, cy, scores) {
    this.cx = cx;
    this.cy = cy;
    this.scores = scores;

    this.maxPlayerScore = Math.max(...Object.values(scores));

    this.active = false;
    this.done = false;
    this.currentSeries = 0;
    this.totalSeries = 5; // всего 5 серий

    this.laserLength = CONFIG.circleRadius;
    this.laserWidthThin = 2;
    this.laserWidthThick = 8;

    this.angles = []; // массив углов для текущей серии

    this.startSeries();
  }

  startSeries() {
    if (this.currentSeries >= this.totalSeries) {
      this.done = true;
      return;
    }

    this.currentSeries++;

    // определяем количество лучей в серии
    let laserCount = 1;
    if (this.maxPlayerScore >= 30) laserCount = 3;
    if (this.maxPlayerScore >= 40) laserCount = 4;
    if (this.maxPlayerScore >= 50) laserCount = 5;
    else if (this.maxPlayerScore >= 20) laserCount = 2;

    // генерируем случайные углы для лучей
    this.angles = [];
    for (let i = 0; i < laserCount; i++) {
      this.angles.push(Math.random() * Math.PI * 2);
    }

    // подготовка (тонкий лазер)
    let prepTime = this.maxPlayerScore >= 50 ? 1500: 750;
    this.active = false;

    setTimeout(() => {
      // активные толстые лазеры
      this.active = true;
    }, prepTime);

    setTimeout(() => {
      // переход к следующей серии
      this.startSeries();
    }, prepTime + 500); // держим активный лазер 1.5 секунды
  }

  update() {
    // статичные лазеры, можно добавить вращение
  }

  hitsPlayer(px, py) {
    if (!this.active) return false;

    return this.angles.some(angle => {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const t = (px - this.cx) * dx + (py - this.cy) * dy;
      const lx = this.cx + t * dx;
      const ly = this.cy + t * dy;
      return Math.hypot(px - lx, py - ly) < this.laserWidthThick;
    });
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.cx, this.cy);

    const len = this.laserLength;

    this.angles.forEach(angle => {
      if (!this.active) {
        // тонкий подготовительный лазер
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = this.laserWidthThin;
      } else {
        // активный толстый лазер
        ctx.strokeStyle = 'red';
        ctx.lineWidth = this.laserWidthThick;
      }

      ctx.beginPath();
      ctx.moveTo(-len * Math.cos(angle), -len * Math.sin(angle));
      ctx.lineTo(len * Math.cos(angle), len * Math.sin(angle));
      ctx.stroke();
    });

    ctx.restore();
  }
}

/* ===================== LASER ===================== */

class LaserAttack {
  constructor(cx, cy, scores) {
    this.cx = cx;
    this.cy = cy;

    this.score = Math.max(...Object.values(scores));

    this.rotationSpeed = 0.011;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.angle = 0;

    // ---------- ЛАЗЕРЫ ----------
    this.lasers = [];

    if (this.score < 10) {
      // 0–10 → радиус
      this.lasers = ['radius'];
    } else if (this.score < 20) {
      // 10–20 → диаметр
      this.lasers = [0];
    } else if (this.score < 30) {
      // 20–30 → диаметр + радиус
      this.lasers = [0, 'radius'];
    } else if (this.score < 50) {
      // 30–40 → крест (2 диаметра)
      this.lasers = [0, Math.PI / 2];
    } else {
      // 50+ → крест + диагональ
      this.lasers = [0, Math.PI / 2, Math.PI / 4];
    }

    this.active = false;
    this.done = false;

    const prep =
      this.score >= 50 ? 500 :
      this.score >= 20 ? 1000 :
      1500;

    setTimeout(() => (this.active = true), prep);
    setTimeout(() => (this.done = true), prep + 5000);
  }

  update() {
    if (this.active) {
      this.angle += this.rotationSpeed * this.dir;
    }
  }

  hitsPlayer(px, py) {
    if (!this.active) return false;

    return this.lasers.some(l => {
      const ang = this.angle + (l === 'radius' ? 0 : l);
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);

      const t = (px - this.cx) * dx + (py - this.cy) * dy;
      if (l === 'radius' && t < 0) return false;

      const lx = this.cx + t * dx;
      const ly = this.cy + t * dy;
      return Math.hypot(px - lx, py - ly) < 8;
    });
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.cx, this.cy);

    this.lasers.forEach(l => {
      const ang = this.angle + (l === 'radius' ? 0 : l);
      ctx.rotate(ang);

      ctx.strokeStyle = this.active ? 'red' : 'rgba(255,0,0,0.3)';
      ctx.lineWidth = this.active ? 8 : 3;

      ctx.beginPath();
      if (l === 'radius') {
        ctx.moveTo(0, 0);
        ctx.lineTo(CONFIG.circleRadius, 0);
      } else {
        ctx.moveTo(-CONFIG.circleRadius, 0);
        ctx.lineTo(CONFIG.circleRadius, 0);
      }
      ctx.stroke();

      ctx.rotate(-ang);
    });

    ctx.restore();
  }
}



/* ===================== GreenLaserAttack ===================== */
class GreenLaserAttack extends LaserAttack {
  constructor(cx, cy, scores) {
    super(cx, cy, scores);

    const prep =
      this.score >= 50 ? 500 :
      this.score >= 20 ? 1000 :
      1500;

    setTimeout(() => {
      this.dir *= -1;
    }, prep + 2500);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.cx, this.cy);

    this.lasers.forEach(l => {
      const ang = this.angle + (l === 'radius' ? 0 : l);
      ctx.rotate(ang);

      ctx.strokeStyle = this.active
        ? '#00ff66'
        : 'rgba(0,255,100,0.3)';
      ctx.lineWidth = this.active ? 8 : 3;

      ctx.beginPath();
      if (l === 'radius') {
        ctx.moveTo(0, 0);
        ctx.lineTo(CONFIG.circleRadius, 0);
      } else {
        ctx.moveTo(-CONFIG.circleRadius, 0);
        ctx.lineTo(CONFIG.circleRadius, 0);
      }
      ctx.stroke();

      ctx.rotate(-ang);
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
