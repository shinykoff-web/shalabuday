import { Player } from './player.js';
import { CONFIG } from './config.js';

/* ===================== OVERLOAD MANAGER ===================== */

class OverloadManager {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.started = false;

    this.threshold = 50;        // с каких очков
    this.introDelay = 3000;     // пауза перед стартом атак
    this.nextAttackDelay = 400;

    this.music = new Audio('assets/overload.mp3');
    this.music.loop = true;
    this.music.volume = 0.6;
  }

  getMaxScore() {
    return Math.max(...Object.values(this.game.scores));
  }

  check() {
    if (this.active) return;

    if (this.getMaxScore() >= this.threshold) {
      this.activate();
    }
  }

  activate() {
    this.active = true;
    this.started = false;

    // останавливаем атаки
    this.game.currentAttack = null;
    this.game.nextAttackTime = Date.now() + this.introDelay;

    // запускаем музыку
    this.music.play().catch(() => {});

    setTimeout(() => {
      this.started = true;
    }, this.introDelay);
  }

  canSpawnAttacks() {
    return this.active && this.started;
  }

  createDuoAttack() {
    const laserAttacks = [
      LaserAttack,
      GreenLaserAttack,
      StraightLaserAttack,
      EdgeStraightLaserAttack
    ];

    const otherAttacks = [
      FireballAttack,
      RocketAttack,
      BombAttack,
      AcidAttack,
      ZoneAttack
    ];

    let first = Math.random() < 0.5
      ? laserAttacks[Math.floor(Math.random() * laserAttacks.length)]
      : otherAttacks[Math.floor(Math.random() * otherAttacks.length)];

    let secondPool =
      laserAttacks.includes(first) ? otherAttacks : laserAttacks;

    let second =
      secondPool[Math.floor(Math.random() * secondPool.length)];

    return [
      new first(this.game.centerX, this.game.centerY, this.game.scores),
      new second(this.game.centerX, this.game.centerY, this.game.scores)
    ];
  }
}
/* ===================== GAME ===================== */
export class Game {
  constructor(canvas, playerCount, testMode = false) {
    this.ctx = canvas.getContext('2d');
    this.canvas = canvas;

    this.centerX = canvas.width / 2;
    this.centerY = canvas.height / 2;

    // Игроки
    this.players = [];
    const colors = ['blue', 'green', 'red', 'yellow'];
    for (let i = 0; i < playerCount; i++) {
      const angle = (Math.PI * 2 / playerCount) * i;
      this.players.push(new Player(colors[i], angle));
    }

    this.scores = {};
    this.testMode = testMode;
    this.godMode = false;
    this.players.forEach(p => this.scores[p.color] = this.testMode ? 50 : 0);

    // 3D куб
    this.bossSize = 50;
    this.bossScaleStart = 1 / 1.5;
    this.bossScaleEnd = 1.1;
    this.currentBossScale = this.bossScaleStart;
    this.bossAngleX = 0;
    this.bossAngleY = 0;
    this.bossAngleZ = 0;
    this.bossSpeedX = 0.01;
    this.bossSpeedY = 0.01;
    this.bossSpeedZ = 0.01;

    // Overload
    this.overloadActive = false;
    this.overloadMusic = new Audio('assets/overload.mp3');
    this.preOverloadMusic = new Audio('assets/normal.mp3'); // обычная музыка
    this.preOverloadMusic.loop = true; // повтор
    this.overloadDelay = 8000;
    this.pulses = [];

    this.currentAttack = null;
    this.nextAttackTime = Date.now() + 1000;

    // Таймер игры
    this.timerActive = false;
    this.timerStart = null;
    this.timerDuration = 60000; // 1 минута
    this.pauseMenuActive = false;

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

    const testModeCheckbox = document.getElementById('testMode');
    if (testModeCheckbox) {
      testModeCheckbox.checked = this.testMode;
      testModeCheckbox.onchange = () => {
        this.testMode = testModeCheckbox.checked;
        this.players.forEach(p => (this.scores[p.color] = this.testMode ? 50 : 0));
        this.updateButtonScores();
      };
    }
    this.updateButtonScores();
  }

  setupRespawnBind() {
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
    if (this.pauseMenuActive) return;

    this.players.forEach(p => p.update());
    const maxScore = Math.max(...Object.values(this.scores));

    // проигрываем обычную музыку до Overload
    if (!this.overloadActive && maxScore < 50) {
      if (this.preOverloadMusic.paused) this.preOverloadMusic.play();
    }

    // Overload режим
    if (!this.overloadActive && maxScore >= 50) {
      this.overloadActive = true;
      if (this.preOverloadMusic) this.preOverloadMusic.pause();
      if (this.overloadMusic) this.overloadMusic.play();
      this.nextAttackTime = now + this.overloadDelay;

      // запускаем таймер игры
      this.timerActive = true;
      this.timerStart = now;
    }

    // масштаб куба
    const scaleProgress = Math.min(maxScore / 50, 1);
    this.currentBossScale = this.bossScaleStart + (this.bossScaleEnd - this.bossScaleStart) * scaleProgress;

    // вращение куба
    this.bossAngleX += this.bossSpeedX;
    this.bossAngleY += this.bossSpeedY;
    this.bossAngleZ += this.bossSpeedZ;

    // запускаем следующую атаку
    if (!this.currentAttack && now > this.nextAttackTime) {
      this.startNextAttack();
      this.bossSpeedX = (Math.random() * 0.03 - 0.015) * (1 + maxScore / 50);
      this.bossSpeedY = (Math.random() * 0.03 - 0.015) * (1 + maxScore / 50);
      this.bossSpeedZ = (Math.random() * 0.03 - 0.015) * (1 + maxScore / 50);
    }

    // обновляем текущую атаку
    if (this.currentAttack) {
      const attacks = Array.isArray(this.currentAttack) ? this.currentAttack : [this.currentAttack];
      attacks.forEach(a => a.update?.());

      if (attacks.every(a => a.done)) {
        this.players.forEach(pl => { if (pl.alive) this.scores[pl.color]++; });
        this.updateButtonScores();
        this.currentAttack = null;
        this.nextAttackTime = now + 600;
      }
    }

    // проверка попадания игрока
    this.players.forEach(p => {
      if (!p.alive || !this.currentAttack) return;
      const pos = this.getPlayerPos(p);
      const attacks = Array.isArray(this.currentAttack) ? this.currentAttack : [this.currentAttack];
      attacks.forEach(a => { if (!this.godMode && a.hitsPlayer?.(pos.x, pos.y)) p.alive = false; });
    });

    // пульсация круга
    if (this.overloadActive) {
      if (!this.lastPulseTime || now - this.lastPulseTime > 1500) {
        this.pulses.push({ radius: 0, alpha: 1.0 });
        this.lastPulseTime = now;
      }
      this.pulses.forEach(p => { p.radius += 2; p.alpha -= 0.02; });
      this.pulses = this.pulses.filter(p => p.alpha > 0);
    }

    // таймер завершения игры
    if (this.timerActive && now - this.timerStart >= this.timerDuration) {
      this.timerActive = false;
      this.showPauseMenu();
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // арена
    ctx.strokeStyle = 'white';
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, CONFIG.circleRadius, 0, Math.PI * 2);
    ctx.stroke();

    // рисуем 3D куб
    this.drawBossCube();

    // игроки
    this.players.forEach(p => p.draw(ctx, this.centerX, this.centerY));

    // текущие атаки
    const attacks = Array.isArray(this.currentAttack) ? this.currentAttack : [this.currentAttack];
    attacks.forEach(a => a?.draw(ctx));

    // пульсация круга
    this.pulses.forEach(p => {
      ctx.beginPath();
      ctx.arc(this.centerX, this.centerY, CONFIG.circleRadius + p.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${p.alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // таймер сверху
    if (this.timerActive) {
      const remaining = Math.ceil((this.timerDuration - (Date.now() - this.timerStart))/1000);
      ctx.fillStyle = 'white';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(` ${remaining}s`, this.centerX, 30);
    }

    // меню паузы
    if (this.pauseMenuActive) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
      ctx.fillStyle = 'white';
      ctx.font = '30px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Вы прошли основную часть, хотите продолжить?', this.centerX, this.centerY-40);
    }
  }

  drawBossCube() {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const s = this.bossSize * this.currentBossScale;
    const vertices = [
      {x:-s,y:-s,z:-s},{x:s,y:-s,z:-s},{x:s,y:s,z:-s},{x:-s,y:s,z:-s},
      {x:-s,y:-s,z:s},{x:s,y:-s,z:s},{x:s,y:s,z:s},{x:-s,y:s,z:s}
    ];

    const rotated = vertices.map(v=>{
      let r = this.rotateX(v,this.bossAngleX);
      r = this.rotateY(r,this.bossAngleY);
      r = this.rotateZ(r,this.bossAngleZ);
      return r;
    });

    const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];

    ctx.strokeStyle = 'white';
    ctx.beginPath();
    edges.forEach(([i,j])=>{
      const p1 = rotated[i], p2 = rotated[j];
      const scale1 = 300/(300+p1.z), scale2 = 300/(300+p2.z);
      ctx.moveTo(p1.x*scale1, p1.y*scale1);
      ctx.lineTo(p2.x*scale2, p2.y*scale2);
    });
    ctx.stroke();
    ctx.restore();
  }

  rotateX(v, angle){ const cos=Math.cos(angle), sin=Math.sin(angle); return {x:v.x, y:v.y*cos-v.z*sin, z:v.y*sin+v.z*cos}; }
  rotateY(v, angle){ const cos=Math.cos(angle), sin=Math.sin(angle); return {x:v.x*cos+v.z*sin, y:v.y, z:-v.x*sin+v.z*cos}; }
  rotateZ(v, angle){ const cos=Math.cos(angle), sin=Math.sin(angle); return {x:v.x*cos-v.y*sin, y:v.x*sin+v.y*cos, z:v.z}; }

  getPlayerPos(p){ return { x:this.centerX+Math.cos(p.angle)*CONFIG.circleRadius, y:this.centerY+Math.sin(p.angle)*CONFIG.circleRadius }; }

  // --------- меню паузы ---------
  showPauseMenu() {
    this.pauseMenuActive = true;
    this.currentAttack = null; // очищаем атаки
    this.createPauseButtons();
  }

  createPauseButtons() {
    const yesBtn = document.createElement('button');
    yesBtn.textContent = 'Да';
    yesBtn.style.position = 'absolute';
    yesBtn.style.left = '40%';
    yesBtn.style.top = '60%';
    yesBtn.style.zIndex = 1000;
    document.body.appendChild(yesBtn);

    const noBtn = document.createElement('button');
    noBtn.textContent = 'Нет';
    noBtn.style.position = 'absolute';
    noBtn.style.left = '55%';
    noBtn.style.top = '60%';
    noBtn.style.zIndex = 1000;
    document.body.appendChild(noBtn);

    yesBtn.onclick = () => {
      yesBtn.remove();
      noBtn.remove();
      this.pauseMenuActive = false;
      this.nextAttackTime = Date.now() + 3000; // пауза перед продолжением
    };

    noBtn.onclick = () => {
      yesBtn.remove();
      noBtn.remove();
      this.pauseMenuActive = false;
      this.overloadActive = false;
      window.location.href = 'index.html';
    };
  }

  startNextAttack() {
    const list = [
      EdgeStraightLaserAttack, FireballAttack, RocketAttack, ZoneAttack,
      LaserAttack, AcidAttack, GreenLaserAttack, StraightLaserAttack, BombAttack
    ];

    if (!this.overloadActive) {
      const idx = Math.floor(Math.random()*list.length);
      this.currentAttack = new list[idx](this.centerX,this.centerY,this.scores);
      return;
    }

    // Duo атаки
    const laserAttacks = ['LaserAttack','GreenLaserAttack','StraightLaserAttack','EdgeStraightLaserAttack'];
    const zoneAttacks = ['ZoneAttack'];
    const bombAttacks = ['BombAttack'];

    let firstAttackClass, secondAttackClass;

    while (true) {
      const firstIdx = Math.floor(Math.random()*list.length);
      const secondIdx = Math.floor(Math.random()*list.length);
      firstAttackClass = list[firstIdx];
      secondAttackClass = list[secondIdx];

      const fName = firstAttackClass.name;
      const sName = secondAttackClass.name;

      const fIsLaser = laserAttacks.includes(fName);
      const sIsLaser = laserAttacks.includes(sName);
      const fIsZone = zoneAttacks.includes(fName);
      const sIsZone = zoneAttacks.includes(sName);
      const fIsBomb = bombAttacks.includes(fName);
      const sIsBomb = bombAttacks.includes(sName);

      // GreenLaser всегда одиночный
      if (fName==='GreenLaserAttack' || sName==='GreenLaserAttack') { secondAttackClass = null; }

      if (
        (fIsLaser && sIsLaser) ||
        (fIsZone && sIsZone) ||
        (fIsLaser && sIsZone) ||
        (fIsZone && sIsLaser) ||
        (fIsZone && sIsBomb) ||
        (fIsBomb && sIsZone)
      ) continue; // повторяем выбор
      break;
    }

    this.currentAttack = [ new firstAttackClass(this.centerX,this.centerY,this.scores) ];
    if (secondAttackClass) this.currentAttack.push(new secondAttackClass(this.centerX,this.centerY,this.scores));
  }

  loop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
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
// ---------------- RocketAttack ----------------
const rocketImg = new Image();
rocketImg.src = 'assets/rocket.png'; // путь к вашей PNG ракете

export class RocketAttack {
  constructor(cx, cy, scores) {
    this.cx = cx;
    this.cy = cy;

    this.warnings = [];
    this.rockets = [];
    this.done = false;

    const maxPlayerScore = Math.max(...Object.values(scores));

    // скорость ракет
    this.speedMult = maxPlayerScore >= 30 ? 3 : maxPlayerScore >= 20 ? 2 : 1;

    // количество ракет в серии
    this.rocketCount = maxPlayerScore < 10 ? 2 : 3;

    // количество серий (50+ очков → 4 серии)
    this.series = maxPlayerScore >= 50 ? 4 : 1;
    this.currentSeries = 0;

    // запускаем первую серию
    this.launchSeries();
  }

  launchSeries() {
    if (this.currentSeries >= this.series) {
      // завершаем атаку после последней серии
      setTimeout(() => { this.done = true; }, 500);
      return;
    }

    this.currentSeries++;

    // точки спавна
    const SPAWNS = [
      { x: 0, y: -CONFIG.circleRadius - 70, vx: 0, vy: 3 },   // сверху
      { x: 0, y:  CONFIG.circleRadius + 70, vx: 0, vy: -3 },  // снизу
      { x: -CONFIG.circleRadius - 70, y: 0, vx: 3, vy: 0 },   // слева
      { x:  CONFIG.circleRadius + 70, y: 0, vx: -3, vy: 0 }   // справа
    ];

    const spawn = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];

    const towerOffset = 130;

    const verticalOffsets = [{ x: -130, y: 0 }, { x: 130, y: 0 }, { x: 0, y: 0 }];
    const horizontalOffsets = [{ x: 0, y: -towerOffset }, { x: 0, y: towerOffset }, { x: 0, y: 0 }];
    const isHorizontal = spawn.vx !== 0;
    const OFFSETS = isHorizontal ? horizontalOffsets : verticalOffsets;

    const verticalWarningOffsets = [{ x: -25, y: 0 }, { x: 25, y: 0 }, { x: 0, y: 0 }];
    const horizontalWarningOffsets = [{ x: 0, y: -25 }, { x: 0, y: 25 }, { x: 0, y: 0 }];
    const WARNING_OFFSETS = isHorizontal ? horizontalWarningOffsets : verticalWarningOffsets;

    for (let i = 0; i < this.rocketCount; i++) {
      const off = OFFSETS[i] || { x: 0, y: 0 };
      const x = this.cx + spawn.x + off.x;
      const y = this.cy + spawn.y + off.y;

      // предупреждение ближе к центру
      const factor = 0.8;
      let warningX = this.cx + (x - this.cx) * factor;
      let warningY = this.cy + (y - this.cy) * factor;

      const extra = WARNING_OFFSETS[i] || { x: 0, y: 0 };
      warningX += extra.x;
      warningY += extra.y;

      this.warnings.push({ x: warningX, y: warningY });

      // ракета вылетает через 1 секунду после появления метки
      setTimeout(() => {
        let angle = Math.atan2(spawn.vy, spawn.vx);

        // если ракета летит влево или вверх, повернуть на 180° для PNG
        if (spawn.vx < 0 || spawn.vy < 0) angle += Math.PI;

        this.rockets.push({
          x,
          y,
          vx: spawn.vx * this.speedMult,
          vy: spawn.vy * this.speedMult,
          angle,
          width: 32,
          height: 50
        });
      }, 1000);
    }

    // убираем метки через 1 секунду
    setTimeout(() => { this.warnings.length = 0; }, 1000);

    // запускаем следующую серию только после завершения текущей
    setTimeout(() => this.launchSeries(), 1500); 
  }

  update() {
    this.rockets.forEach(r => {
      r.x += r.vx;
      r.y += r.vy;
      r.angle = Math.atan2(r.vy, r.vx);
    });
  }

  hitsPlayer(px, py) {
    return this.rockets.some(r => Math.hypot(px - r.x, py - r.y) < 16);
  }

  draw(ctx) {
    ctx.font = '24px Arial';
    this.warnings.forEach(w => ctx.fillText('⚠️', w.x - 12, w.y + 12));

    this.rockets.forEach(r => {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle - Math.PI / -2); // корректировка для вертикальной PNG
      if (rocketImg.complete) {
        ctx.drawImage(rocketImg, -r.width / 2, -r.height / 2, r.width, r.height);
      } else {
        ctx.fillStyle = 'red';
        ctx.fillRect(-8, -8, 16, 16);
      }
      ctx.restore();
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

if (this.maxPlayerScore >= 0 && this.maxPlayerScore < 10) {
  laserCount = 1; 
} else if (this.maxPlayerScore >= 10 && this.maxPlayerScore < 20) {
  laserCount = 2; 
} else if (this.maxPlayerScore >= 20 && this.maxPlayerScore < 30) {
  laserCount = 3; 
} else if (this.maxPlayerScore >= 30 && this.maxPlayerScore < 40) {
  laserCount = 4; 
} else if (this.maxPlayerScore >= 40 && this.maxPlayerScore < 50) {
  laserCount = 5; 
} else if (this.maxPlayerScore >= 50) {
  laserCount = 10; 
}

    // генерируем случайные углы для лучей
    this.angles = [];
    for (let i = 0; i < laserCount; i++) {
      this.angles.push(Math.random() * Math.PI * 2);
    }

    // подготовка (тонкий лазер)
    let prepTime = this.maxPlayerScore >= 50 ? 1000: 750;
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

    setTimeout(() => (this.done = true), 3000);
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
// ---------BombAttack----------
class BombAttack {
  constructor(cx, cy, scores) {
    this.cx = cx;
    this.cy = cy;
    this.scores = scores;
    this.maxPlayerScore = Math.max(...Object.values(scores));

    this.bombs = [];
    this.zone = [];
    this.explosions = [];

    this.done = false;
    this.active = false;

    this.zoneRadius = 50;
    this.bombRadius = 20;

    this.explosionDuration = 700; // длительность анимации взрыва (мс)

    this.prepTime = Math.max(750, 1500 - (this.maxPlayerScore * 15));
    this.bombCount = Math.min(5, 1 + Math.floor(this.maxPlayerScore / 10));

    // красные зоны
    for (let i = 0; i < this.bombCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const x = this.cx + Math.cos(angle) * CONFIG.circleRadius;
      const y = this.cy + Math.sin(angle) * CONFIG.circleRadius;
      this.zone.push({ x, y, visible: true });
    }

    setTimeout(() => {
      this.active = true;
      this.spawnBombs();
    }, this.prepTime);
  }

  spawnBombs() {
    const speed = 2 + this.maxPlayerScore / 20;

    this.zone.forEach((z, i) => {
      const dx = z.x - this.cx;
      const dy = z.y - this.cy;
      const dist = Math.hypot(dx, dy);

      setTimeout(() => {
        this.bombs.push({
          x: this.cx,
          y: this.cy,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          targetX: z.x,
          targetY: z.y,
          exploded: false,
          zoneIndex: i
        });
      }, i * 300);
    });

    setTimeout(() => {
      this.done = true;
    }, 2000 + this.bombCount * 100);
  }

  update() {
    const now = performance.now();

    this.bombs.forEach(b => {
      if (!b.exploded) {
        b.x += b.vx;
        b.y += b.vy;

        if (Math.hypot(b.x - b.targetX, b.y - b.targetY) < 5) {
          b.exploded = true;
          this.zone[b.zoneIndex].visible = false;

          // создаём взрыв
          this.explosions.push(this.createExplosion(b.targetX, b.targetY));
        }
      }
    });

    // обновляем взрывы
    this.explosions = this.explosions.filter(e => {
      return now - e.startTime < this.explosionDuration;
    });
  }

  createExplosion(x, y) {
    const particles = [];

    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 2 + 1;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s
      });
    }

    return {
      x,
      y,
      startTime: performance.now(),
      particles
    };
  }

  hitsPlayer(px, py) {
    return this.explosions.some(e =>
      Math.hypot(px - e.x, py - e.y) < this.zoneRadius
    );
  }

  draw(ctx) {
    const now = performance.now();

    // красные зоны подготовки
    this.zone.forEach(z => {
      if (z.visible) {
        ctx.fillStyle = `rgba(255,0,0,${0.3 + 0.2 * Math.sin(now / 200)})`;
        ctx.beginPath();
        ctx.arc(z.x, z.y, this.zoneRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // бомбы
    this.bombs.forEach(b => {
      if (!b.exploded) {
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(b.x, b.y, this.bombRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // взрывы
    this.explosions.forEach(e => {
      const t = (now - e.startTime) / this.explosionDuration;
      const radius = this.zoneRadius * (0.3 + t);
      const alpha = 1 - t;

      // основное свечение
      const grad = ctx.createRadialGradient(
        e.x, e.y, 0,
        e.x, e.y, radius
      );
      grad.addColorStop(0, `rgba(255,220,120,${alpha})`);
      grad.addColorStop(0.5, `rgba(255,140,0,${alpha * 0.7})`);
      grad.addColorStop(1, 'rgba(255,60,0,0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // частицы
      ctx.fillStyle = `rgba(255,180,80,${alpha})`;
      e.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        ctx.fillRect(p.x, p.y, 3, 3);
      });
    });
  }
}
/* ===================== EdgeStraightLaserAttack ===================== */
export class EdgeStraightLaserAttack {
  constructor(cx, cy, scores) {
    this.cx = cx;
    this.cy = cy;
    this.scores = scores;

    this.maxPlayerScore = Math.max(...Object.values(scores));

    this.active = false;
    this.done = false;
    this.currentSeries = 0;
    this.totalSeries = 5; // всего серий

    this.laserWidthThin = 2;
    this.laserWidthThick = 8;
    this.laserLength = CONFIG.circleRadius * 2; // лазер проходит через хорду

    this.seriesLasers = []; // массив лазеров текущей серии

    this.startSeries();
  }

  startSeries() {
    if (this.currentSeries >= this.totalSeries) {
      this.done = true;
      return;
    }

    this.currentSeries++;

    // определяем количество лазеров в серии
    let laserCount = 1;
    if (this.maxPlayerScore >= 10) laserCount = 2;
    if (this.maxPlayerScore >= 20) laserCount = 3;
    if (this.maxPlayerScore >= 30) laserCount = 4;
    if (this.maxPlayerScore >= 40) laserCount = 5;
    if (this.maxPlayerScore >= 50) laserCount = 10;

    // генерируем случайные смещения от центра, чтобы лазеры не проходили через центр
    const offsets = [];
    for (let i = 0; i < laserCount; i++) {
      offsets.push((Math.random() - 0.5) * CONFIG.circleRadius * 1.5); // случайное смещение по перпендикуляру к линии
    }

    // генерируем случайные углы направления лазеров
    this.seriesLasers = offsets.map(offset => {
      const angle = Math.random() * Math.PI * 2; // направление лазера
      return { angle, offset };
    });

    this.active = false;

    // подготовка (тонкий лазер)
    const prepTime = this.maxPlayerScore >= 50 ? 1000 : 750;

    setTimeout(() => {
      this.active = true; // активный лазер
    }, prepTime);

    // переход к следующей серии после окончания этой
    setTimeout(() => this.startSeries(), prepTime + 500); // 0.5s активного лазера
  }

  update() {
    // лазеры статичные, вращение не используется
  }

  hitsPlayer(px, py) {
    if (!this.active) return false;

    const R = CONFIG.circleRadius;

    return this.seriesLasers.some(laser => {
      const dx = Math.cos(laser.angle);
      const dy = Math.sin(laser.angle);

      // смещаем линию от центра по перпендикуляру
      const perpX = -dy * laser.offset;
      const perpY = dx * laser.offset;

      // проектируем игрока на линию лазера
      const t = (px - (this.cx + perpX)) * dx + (py - (this.cy + perpY)) * dy;
      const lx = this.cx + perpX + t * dx;
      const ly = this.cy + perpY + t * dy;

      // ограничиваем длину лазера хордами круга
      const maxLen = Math.sqrt(R * R - laser.offset * laser.offset);
      if (t < -maxLen || t > maxLen) return false;

      return Math.hypot(px - lx, py - ly) < this.laserWidthThick;
    });
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.cx, this.cy);

    this.seriesLasers.forEach(laser => {
      const dx = Math.cos(laser.angle);
      const dy = Math.sin(laser.angle);

      // смещение по перпендикуляру
      const perpX = -dy * laser.offset;
      const perpY = dx * laser.offset;

      const R = CONFIG.circleRadius;
      const halfLen = Math.sqrt(R * R - laser.offset * laser.offset);

      ctx.beginPath();
      if (!this.active) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = this.laserWidthThin;
      } else {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = this.laserWidthThick;
      }

      ctx.moveTo(perpX - dx * halfLen, perpY - dy * halfLen);
      ctx.lineTo(perpX + dx * halfLen, perpY + dy * halfLen);
      ctx.stroke();
    });

    ctx.restore();
  }
}
