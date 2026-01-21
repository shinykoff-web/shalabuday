import { CONFIG } from './config.js'
import { Player } from './player.js'

/* ===================== OVERLOAD MANAGER ===================== */

class OverloadManager {
	constructor(game) {
		this.game = game
		this.active = false
		this.started = false

		this.threshold = 50 // с каких очков
		this.introDelay = 3000 // пауза перед стартом атак
		this.nextAttackDelay = 400
		SoundManager.init()

		this.music = new Audio('assets/overload.mp3')
		this.music.loop = true
		this.music.volume = 0.4
	}

	getMaxScore() {
		return Math.max(...Object.values(this.game.scores))
	}

	check() {
		if (this.active) return

		if (this.getMaxScore() >= this.threshold) {
			this.activate()
		}
	}

	activate() {
		this.active = true
		this.started = false

		// останавливаем атаки
		this.game.currentAttack = null
		this.game.nextAttackTime = Date.now() + this.introDelay

		// запускаем музыку
		this.music.play().catch(() => {})

		setTimeout(() => {
			this.started = true
		}, this.introDelay)
	}

	canSpawnAttacks() {
		return this.active && this.started
	}

	createDuoAttack() {
		const laserAttacks = [
			LaserAttack,
			GreenLaserAttack,
			StraightLaserAttack,
			EdgeStraightLaserAttack,
		]

		const otherAttacks = [
			FireballAttack,
			RocketAttack,
			BombAttack,
			AcidAttack,
			ZoneAttack,
		]

		let first =
			Math.random() < 0.5
				? laserAttacks[Math.floor(Math.random() * laserAttacks.length)]
				: otherAttacks[Math.floor(Math.random() * otherAttacks.length)]

		let secondPool = laserAttacks.includes(first) ? otherAttacks : laserAttacks

		let second = secondPool[Math.floor(Math.random() * secondPool.length)]

		return [
			new first(this.game.centerX, this.game.centerY, this.game.scores),
			new second(this.game.centerX, this.game.centerY, this.game.scores),
		]
	}
}

/* ===================== SOUND MANAGER ===================== */
export const SoundManager = {
	// аудио объекты
	laserAudio: new Audio('assets/laser.mp3'),
	bombAudio: new Audio('assets/bomb_explosion.mp3'),

	laserPlaying: false,

	init() {
		this.laserAudio.loop = true
		this.laserAudio.volume = 0.6

		this.bombAudio.loop = false
		this.bombAudio.volume = 0.7
	},

	// ---------------- LASER ----------------
	playLaser() {
		if (!this.laserPlaying) {
			this.laserAudio.currentTime = 0
			this.laserAudio.play().catch(() => {})
			this.laserPlaying = true
		}
	},

	stopLaser() {
		if (this.laserPlaying) {
			this.laserAudio.pause()
			this.laserAudio.currentTime = 0
			this.laserPlaying = false
		}
	},

	// ---------------- BOMB ----------------
	playBomb() {
		const bombClone = this.bombAudio.cloneNode()
		bombClone.volume = this.bombAudio.volume
		bombClone.play().catch(() => {})
	},

	// ---------------- UTILS ----------------
	stopAll() {
		this.stopLaser()
	},
}

// Инициализация звуков
SoundManager.init()

/* ===================== ATTACK SOUND CONTROLLER ===================== */
export class AttackSoundController {
	/**
	 * Обновляет звуки для всех атак
	 * @param {Array} attacks - массив атак
	 */
	static update(attacks) {
		let anyDeadlyLaser = false

		attacks.forEach(a => {
			// ---------- LASERS ONLY ----------
			if (
				a instanceof LaserAttack ||
				a instanceof GreenLaserAttack ||
				a instanceof StraightLaserAttack ||
				a instanceof EdgeStraightLaserAttack
			) {
				if (a.active) anyDeadlyLaser = true
			}

			// ---------- BOMB SERIES ----------
			if (a.explosions) {
				a.explosions.forEach(e => {
					if (!e._soundPlayed) {
						SoundManager.playBomb()
						e._soundPlayed = true
					}
				})
			}

			// ---------- SINGLE BOMB ----------
			if (a.exploded && !a._soundPlayed) {
				SoundManager.playBomb()
				a._soundPlayed = true
			}
		})

		// ---------- GLOBAL LASER CONTROL ----------
		if (anyDeadlyLaser) {
			SoundManager.playLaser()
		} else {
			SoundManager.stopLaser()
		}
	}
}

/* ===================== GAME ===================== */
export class Game {
	constructor(canvas, playerCount, testMode = false) {
		this.ctx = canvas.getContext('2d')
		this.canvas = canvas

		this.centerX = canvas.width / 2
		this.centerY = canvas.height / 2

		// Игроки
		this.players = []
		const colors = ['blue', 'green', 'red', 'yellow']
		for (let i = 0; i < playerCount; i++) {
			const angle = ((Math.PI * 2) / playerCount) * i
			this.players.push(new Player(colors[i], angle))
		}

		this.scores = {}
		this.testMode = testMode
		this.godMode = false
		this.players.forEach(p => (this.scores[p.color] = this.testMode ? 50 : 0))

		// 3D куб
		this.bossSize = 50
		this.bossScaleStart = 1 / 1.5
		this.bossScaleEnd = 1.1
		this.currentBossScale = this.bossScaleStart
		this.bossAngleX = 0
		this.bossAngleY = 0
		this.bossAngleZ = 0
		this.bossSpeedX = 0.01
		this.bossSpeedY = 0.01
		this.bossSpeedZ = 0.01

		// Overload
		this.overloadActive = false
		this.overloadMusic = new Audio('assets/overload.mp3')
		this.preOverloadMusic = new Audio('assets/normal.mp3') // обычная музыка
		this.preOverloadMusic.loop = true // повтор
		this.overloadDelay = 8000
		this.pulses = []

		this.currentAttack = null
		this.nextAttackTime = Date.now() + 1000

		// Таймер игры
		this.timerActive = false
		this.timerStart = null
		this.timerDuration = 60000 // 1 минута
		this.pauseMenuActive = false
		this.debugHitboxes = true

		this.setupInput(playerCount)
		this.setupRespawnBind()
		this.loop()
	}

	setupInput(playerCount) {
		const controlDiv = document.getElementById('controls')
		controlDiv.classList.remove('hidden')

		const btns = ['btnBlue', 'btnGreen', 'btnRed', 'btnYellow']
		btns.forEach((id, i) => {
			const btn = document.getElementById(id)
			if (i < playerCount) {
				btn.style.display = 'block'
				btn.onpointerdown = e => {
					e.preventDefault()
					this.players[i].switchDirection()
				}
			} else btn.style.display = 'none'
		})

		const testModeCheckbox = document.getElementById('testMode')
		if (testModeCheckbox) {
			testModeCheckbox.checked = this.testMode
			testModeCheckbox.onchange = () => {
				this.testMode = testModeCheckbox.checked
				this.players.forEach(
					p => (this.scores[p.color] = this.testMode ? 10 : 0),
				)
				this.updateButtonScores()
			}
		}
		this.updateButtonScores()
	}

	setupRespawnBind() {
		window.addEventListener('keydown', e => {
			if (e.key.toLowerCase() === 'h') {
				this.debugHitboxes = !this.debugHitboxes
				console.log('DEBUG HITBOXES:', this.debugHitboxes)
			}
		})

		window.addEventListener('keydown', e => {
			if (e.key.toLowerCase() === 'r') {
				this.godMode = !this.godMode
				console.log(`GodMode: ${this.godMode ? 'ON' : 'OFF'}`)
			}
		})
	}

	updateButtonScores() {
		const btns = {
			blue: document.getElementById('btnBlue'),
			green: document.getElementById('btnGreen'),
			red: document.getElementById('btnRed'),
			yellow: document.getElementById('btnYellow'),
		}

		for (let color in this.scores) {
			const btn = btns[color]
			if (btn) {
				btn.textContent = this.scores[color]
				btn.style.color = 'white'
				btn.style.fontWeight = 'bold'
				btn.style.textAlign = 'center'
			}
		}
	}

	update() {
		const now = Date.now()
		if (this.pauseMenuActive) return

		this.players.forEach(p => p.update())
		const maxScore = Math.max(...Object.values(this.scores))

		// проигрываем обычную музыку до Overload
		if (!this.overloadActive && maxScore < 50) {
			if (this.preOverloadMusic.paused) this.preOverloadMusic.play()
		}

		// Overload режим
		if (!this.overloadActive && maxScore >= 50) {
			this.overloadActive = true
			if (this.preOverloadMusic) this.preOverloadMusic.pause()
			if (this.overloadMusic) this.overloadMusic.play()
			this.nextAttackTime = now + this.overloadDelay

			// запускаем таймер игры
			this.timerActive = true
			this.timerStart = now
		}

		// масштаб куба
		const scaleProgress = Math.min(maxScore / 50, 1)
		this.currentBossScale =
			this.bossScaleStart +
			(this.bossScaleEnd - this.bossScaleStart) * scaleProgress

		// вращение куба
		this.bossAngleX += this.bossSpeedX
		this.bossAngleY += this.bossSpeedY
		this.bossAngleZ += this.bossSpeedZ

		// запускаем следующую атаку
		if (!this.currentAttack && now > this.nextAttackTime) {
			this.startNextAttack()
			this.bossSpeedX = (Math.random() * 0.03 - 0.015) * (1 + maxScore / 50)
			this.bossSpeedY = (Math.random() * 0.03 - 0.015) * (1 + maxScore / 50)
			this.bossSpeedZ = (Math.random() * 0.03 - 0.015) * (1 + maxScore / 50)
			const attacks = Array.isArray(this.currentAttack)
				? this.currentAttack
				: [this.currentAttack]

			attacks.forEach(a => {
				if (
					a instanceof LaserAttack ||
					a instanceof GreenLaserAttack ||
					a instanceof StraightLaserAttack ||
					a instanceof EdgeStraightLaserAttack
				) {
					SoundManager.playLaser()
					SoundManager.stopLaser()
				}

				if (a instanceof BombAttack) {
					// звук ТОЛЬКО при взрыве, не здесь
					a._soundHooked = false
				}
			})
		}

		// обновляем текущую атаку
		if (this.currentAttack) {
			const attacks = Array.isArray(this.currentAttack)
				? this.currentAttack
				: [this.currentAttack]
			attacks.forEach(a => a.update?.())
			AttackSoundController.update(attacks)

			if (attacks.every(a => a.done)) {
				this.players.forEach(pl => {
					if (pl.alive) this.scores[pl.color]++
				})
				this.updateButtonScores()
				this.currentAttack = null
				this.nextAttackTime = now + 600
			}
		}

		// проверка попадания игрока
		this.players.forEach(p => {
			if (!p.alive || !this.currentAttack) return
			const pos = this.getPlayerPos(p)
			const attacks = Array.isArray(this.currentAttack)
				? this.currentAttack
				: [this.currentAttack]
			attacks.forEach(a => {
				if (!this.godMode && a.hitsPlayer?.(pos.x, pos.y)) p.alive = false
			})
		})

		// пульсация круга
		if (this.overloadActive) {
			if (!this.lastPulseTime || now - this.lastPulseTime > 1500) {
				this.pulses.push({ radius: 0, alpha: 1.0 })
				this.lastPulseTime = now
			}
			this.pulses.forEach(p => {
				p.radius += 2
				p.alpha -= 0.02
			})
			this.pulses = this.pulses.filter(p => p.alpha > 0)
		}

		// таймер завершения игры
		if (this.timerActive && now - this.timerStart >= this.timerDuration) {
			this.timerActive = false
			this.showPauseMenu()
		}
	}

	draw() {
		const ctx = this.ctx
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

		// арена
		ctx.strokeStyle = 'white'
		ctx.beginPath()
		ctx.arc(this.centerX, this.centerY, CONFIG.circleRadius, 0, Math.PI * 2)
		ctx.stroke()

		// рисуем 3D куб
		this.drawBossCube()

		// игроки
		this.players.forEach(p => p.draw(ctx, this.centerX, this.centerY))

		// текущие атаки
		const attacks = Array.isArray(this.currentAttack)
			? this.currentAttack
			: [this.currentAttack]
		attacks.forEach(a => a?.draw(ctx))

if (this.debugHitboxes && this.currentAttack) {
  const attacks = Array.isArray(this.currentAttack)
    ? this.currentAttack
    : [this.currentAttack];

  this.drawAllHitboxes(ctx, attacks);
}

		// пульсация круга
		this.pulses.forEach(p => {
			ctx.beginPath()
			ctx.arc(
				this.centerX,
				this.centerY,
				CONFIG.circleRadius + p.radius,
				0,
				Math.PI * 2,
			)
			ctx.strokeStyle = `rgba(255,255,255,${p.alpha})`
			ctx.lineWidth = 2
			ctx.stroke()
		})

		// таймер сверху
		if (this.timerActive) {
			const remaining = Math.ceil(
				(this.timerDuration - (Date.now() - this.timerStart)) / 1000,
			)
			ctx.fillStyle = 'white'
			ctx.font = '24px Arial'
			ctx.textAlign = 'center'
			ctx.fillText(` ${remaining}s`, this.centerX, 30)
		}

		// меню паузы
		if (this.pauseMenuActive) {
			ctx.fillStyle = 'rgba(0,0,0,0.7)'
			ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
			ctx.fillStyle = 'white'
			ctx.font = '30px Arial'
			ctx.textAlign = 'center'
			ctx.fillText(
				'Вы прошли основную часть, хотите продолжить?',
				this.centerX,
				this.centerY - 40,
			)
		}
	}

	drawBossCube() {
		const ctx = this.ctx
		ctx.save()
		ctx.translate(this.centerX, this.centerY)

		const s = this.bossSize * this.currentBossScale
		const vertices = [
			{ x: -s, y: -s, z: -s },
			{ x: s, y: -s, z: -s },
			{ x: s, y: s, z: -s },
			{ x: -s, y: s, z: -s },
			{ x: -s, y: -s, z: s },
			{ x: s, y: -s, z: s },
			{ x: s, y: s, z: s },
			{ x: -s, y: s, z: s },
		]

		const rotated = vertices.map(v => {
			let r = this.rotateX(v, this.bossAngleX)
			r = this.rotateY(r, this.bossAngleY)
			r = this.rotateZ(r, this.bossAngleZ)
			return r
		})

		const edges = [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 0],
			[4, 5],
			[5, 6],
			[6, 7],
			[7, 4],
			[0, 4],
			[1, 5],
			[2, 6],
			[3, 7],
		]

		ctx.strokeStyle = 'white'
		ctx.beginPath()
		edges.forEach(([i, j]) => {
			const p1 = rotated[i],
				p2 = rotated[j]
			const scale1 = 300 / (300 + p1.z),
				scale2 = 300 / (300 + p2.z)
			ctx.moveTo(p1.x * scale1, p1.y * scale1)
			ctx.lineTo(p2.x * scale2, p2.y * scale2)
		})
		ctx.stroke()
		ctx.restore()
	}

	rotateX(v, angle) {
		const cos = Math.cos(angle),
			sin = Math.sin(angle)
		return { x: v.x, y: v.y * cos - v.z * sin, z: v.y * sin + v.z * cos }
	}
	rotateY(v, angle) {
		const cos = Math.cos(angle),
			sin = Math.sin(angle)
		return { x: v.x * cos + v.z * sin, y: v.y, z: -v.x * sin + v.z * cos }
	}
	rotateZ(v, angle) {
		const cos = Math.cos(angle),
			sin = Math.sin(angle)
		return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos, z: v.z }
	}

	getPlayerPos(p) {
		return {
			x: this.centerX + Math.cos(p.angle) * CONFIG.circleRadius,
			y: this.centerY + Math.sin(p.angle) * CONFIG.circleRadius,
		}
	}

	// --------- меню паузы ---------
	showPauseMenu() {
		this.pauseMenuActive = true
		this.currentAttack = null // очищаем атаки
		this.createPauseButtons()
	}

	createPauseButtons() {
		const yesBtn = document.createElement('button')
		yesBtn.textContent = 'Да'
		yesBtn.style.position = 'absolute'
		yesBtn.style.left = '40%'
		yesBtn.style.top = '60%'
		yesBtn.style.zIndex = 1000
		document.body.appendChild(yesBtn)

		const noBtn = document.createElement('button')
		noBtn.textContent = 'Нет'
		noBtn.style.position = 'absolute'
		noBtn.style.left = '55%'
		noBtn.style.top = '60%'
		noBtn.style.zIndex = 1000
		document.body.appendChild(noBtn)

		yesBtn.onclick = () => {
			yesBtn.remove()
			noBtn.remove()
			this.pauseMenuActive = false
			this.nextAttackTime = Date.now() + 3000 // пауза перед продолжением
		}

		noBtn.onclick = () => {
			yesBtn.remove()
			noBtn.remove()
			this.pauseMenuActive = false
			this.overloadActive = false
			window.location.href = 'index.html'
		}
	}

	startNextAttack() {
		const list = [RocketAttack, BombAttack, LaserAttack, GreenLaserAttack, EdgeStraightLaserAttack, StraightLaserAttack,ZoneAttack,AcidAttack, FireballAttack]

		if (!this.overloadActive) {
			const idx = Math.floor(Math.random() * list.length)
			this.currentAttack = new list[idx](
				this.centerX,
				this.centerY,
				this.scores,
			)
			return
		}

		// Duo атаки
		const laserAttacks = [
			'LaserAttack',
			'GreenLaserAttack',
			'StraightLaserAttack',
			'EdgeStraightLaserAttack',
		]
		const zoneAttacks = ['ZoneAttack']
		const bombAttacks = ['BombAttack']

		let firstAttackClass, secondAttackClass

		while (true) {
			const firstIdx = Math.floor(Math.random() * list.length)
			const secondIdx = Math.floor(Math.random() * list.length)
			firstAttackClass = list[firstIdx]
			secondAttackClass = list[secondIdx]

			const fName = firstAttackClass.name
			const sName = secondAttackClass.name

			const fIsLaser = laserAttacks.includes(fName)
			const sIsLaser = laserAttacks.includes(sName)
			const fIsZone = zoneAttacks.includes(fName)
			const sIsZone = zoneAttacks.includes(sName)
			const fIsBomb = bombAttacks.includes(fName)
			const sIsBomb = bombAttacks.includes(sName)

			// GreenLaser всегда одиночный
			if (fName === 'GreenLaserAttack' || sName === 'GreenLaserAttack') {
				secondAttackClass = null
			}

			if (
				(fIsLaser && sIsLaser) ||
				(fIsZone && sIsZone) ||
				(fIsLaser && sIsZone) ||
				(fIsZone && sIsLaser) ||
				(fIsZone && sIsBomb) ||
				(fIsBomb && sIsZone)
			)
				continue // повторяем выбор
			break
		}

		this.currentAttack = [
			new firstAttackClass(this.centerX, this.centerY, this.scores),
		]
		if (secondAttackClass)
			this.currentAttack.push(
				new secondAttackClass(this.centerX, this.centerY, this.scores),
			)
	}

  drawAllHitboxes(ctx, attacks) {
  ctx.save();
  ctx.strokeStyle = 'rgba(0,255,0,0.9)';
  ctx.lineWidth = 2;

  attacks.forEach(a => {

    // ROCKETS
    if (a.rockets) {
      a.rockets.forEach(r => {
        ctx.beginPath();
        ctx.arc(r.x, r.y, 16, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    // BOMBS
    if (a.bombs) {
      a.bombs.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius || 30, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    // EXPLOSIONS
    if (a.explosions) {
      a.explosions.forEach(e => {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius || 40, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    // LASERS (универсально)
    if (a.active === true && a.angle !== undefined && a.cx !== undefined) {
      const len = CONFIG.circleRadius + 120;
      ctx.beginPath();
      ctx.moveTo(a.cx, a.cy);
      ctx.lineTo(
        a.cx + Math.cos(a.angle) * len,
        a.cy + Math.sin(a.angle) * len
      );
      ctx.stroke();
    }

    // FALLBACK (шарики)
    if (a.x !== undefined && a.y !== undefined && a.radius) {
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  ctx.restore();
}

	loop() {
		this.update()
		this.draw()
		requestAnimationFrame(() => this.loop())
	}
}

/* ===================== FIREBALLS ===================== */

class FireballAttack {
	constructor(cx, cy, scores) {
		this.cx = cx
		this.cy = cy
		this.scores = scores

		this.objects = []
		this.done = false

		this.series = 3
		this.currentSeries = 0

		this.fireSound = new Audio('assets/fireball.mp3')
		this.fireSound.volume = 0.7

		this.startSeries()
	}

	startSeries() {
		if (this.currentSeries >= this.series) {
			this.done = true
			return
		}

		this.currentSeries++

		const score = Math.max(...Object.values(this.scores))
		const count = Math.min(15, 5 + Math.floor(score / 5))
		const speed = 4 + (score > 50 ? Math.min(4, (score - 50) / 12.5) : 0)

		const prepTime =
			score <= 50 ? 1000 : Math.max(500, 1000 - (score - 50) * 10)

		this.objects = []
		const targets = []

		for (let i = 0; i < count; i++) {
			const a = Math.random() * Math.PI * 2
			targets.push(a)
			this.objects.push({
				x: this.cx + Math.cos(a) * CONFIG.circleRadius,
				y: this.cy + Math.sin(a) * CONFIG.circleRadius,
				type: 'marker',
			})
		}

		setTimeout(() => {
			this.objects = []
			try {
				this.fireSound.currentTime = 0
				this.fireSound.play()
			} catch {}

			targets.forEach(a => {
				this.objects.push({
					x: this.cx,
					y: this.cy,
					vx: Math.cos(a) * speed,
					vy: Math.sin(a) * speed,
					r: 8,
					type: 'fireball',
					trail: [],
					particles: [],
				})
			})
		}, prepTime)

		setTimeout(() => this.startSeries(), prepTime + 1100)
	}

	update() {
		this.objects.forEach(o => {
			if (o.type !== 'fireball') return

			// позиция
			o.x += o.vx
			o.y += o.vy

			// ---- ТРЕУГОЛЬНЫЙ ШЛЕЙФ ----
			const len = Math.hypot(o.vx, o.vy)
			const nx = -o.vy / len
			const ny = o.vx / len

			o.trail.push({
				x: o.x,
				y: o.y,
				nx,
				ny,
				a: 1,
			})
			if (o.trail.length > 6) o.trail.shift()
			o.trail.forEach(t => (t.a -= 0.15))

			// ---- ПАРТИКЛЫ ----
			if (Math.random() < 0.5) {
				o.particles.push({
					x: o.x,
					y: o.y,
					vx: (Math.random() - 0.5) * 0.6,
					vy: (Math.random() - 0.5) * 0.6,
					r: 2 + Math.random() * 2,
					a: 1,
				})
			}

			o.particles.forEach(p => {
				p.x += p.vx
				p.y += p.vy
				p.a -= 0.08
			})

			o.particles = o.particles.filter(p => p.a > 0)
		})
	}

	hitsPlayer(px, py) {
		return this.objects.some(
			o => o.type === 'fireball' && Math.hypot(px - o.x, py - o.y) < o.r + 8,
		)
	}

	draw(ctx) {
		this.objects.forEach(o => {
			if (o.type === 'marker') {
				ctx.save()
				ctx.font = '26px Arial'
				ctx.shadowColor = 'white'
				ctx.shadowBlur = 2
				ctx.textAlign = 'center'
				ctx.textBaseline = 'middle'
				ctx.fillStyle = 'white'
				ctx.fillText('⦻', o.x, o.y)
				ctx.restore()
				return
			}

			// ---- ШЛЕЙФ (ТРЕУГОЛЬНИКИ) ----
			o.trail.forEach((t, i) => {
				const w = o.r * (1 - i / o.trail.length)

				ctx.save()
				ctx.globalAlpha = t.a * 0.6
				ctx.fillStyle = 'orange'

				ctx.beginPath()
				ctx.moveTo(t.x, t.y)
				ctx.lineTo(t.x + t.nx * w, t.y + t.ny * w)
				ctx.lineTo(t.x - t.nx * w, t.y - t.ny * w)
				ctx.closePath()
				ctx.fill()
				ctx.restore()
			})

			// ---- ПАРТИКЛЫ ----
			o.particles.forEach(p => {
				ctx.save()
				ctx.globalAlpha = p.a
				ctx.shadowColor = 'orange'
				ctx.shadowBlur = 10

				ctx.fillStyle = 'orange'
				ctx.beginPath()
				ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
				ctx.fill()
				ctx.restore()
			})

			// ---- САМО ЯДРО ----
			ctx.save()
			ctx.shadowColor = 'orange'
			ctx.shadowBlur = 18

			ctx.fillStyle = 'orange'
			ctx.beginPath()
			ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2)
			ctx.fill()

			ctx.fillStyle = 'yellow'
			ctx.beginPath()
			ctx.arc(o.x, o.y, o.r * 0.5, 0, Math.PI * 2)
			ctx.fill()

			ctx.restore()
		})
	}
}

/* ===================== ROCKET ===================== */

const rocketImg = new Image()
rocketImg.src = 'assets/rocket.png' // путь к PNG ракеты

export class RocketAttack {
	constructor(cx, cy, scores, debug = false) {
		this.cx = cx
		this.cy = cy

		this.warnings = []
		this.rockets = []
		this.particles = []
		this.done = false
		this.debug = debug

		const maxPlayerScore = Math.max(...Object.values(scores))

		// скорость ракет
		this.speedMult = maxPlayerScore >= 30 ? 3 : maxPlayerScore >= 20 ? 2 : 1

		// количество ракет в серии
		this.rocketCount = maxPlayerScore < 10 ? 2 : 3

		// количество серий (50+ очков → 4 серии)
		this.series = maxPlayerScore >= 50 ? 4 : 1
		this.currentSeries = 0

		// Звуки ракеты
		this.launchSound = new Audio('assets/rocket_launch.mp3')
		this.explosionSound = new Audio('assets/rocket_explosion.mp3')
		this.launchSound.volume = 0.5
		this.explosionSound.volume = 0.6

		this.launchSeries()
	}

	launchSeries() {
		if (this.currentSeries >= this.series) {
			setTimeout(() => {
				this.done = true
			}, 700)
			return
		}

		this.currentSeries++

		const SPAWNS = [
			{ x: 0, y: -CONFIG.circleRadius - 70, vx: 0, vy: 3 },
			{ x: 0, y: CONFIG.circleRadius + 70, vx: 0, vy: -3 },
			{ x: -CONFIG.circleRadius - 70, y: 0, vx: 3, vy: 0 },
			{ x: CONFIG.circleRadius + 70, y: 0, vx: -3, vy: 0 },
		]

		const spawn = SPAWNS[Math.floor(Math.random() * SPAWNS.length)]
		const towerOffset = 130

		const verticalOffsets = [
			{ x: -130, y: 0 },
			{ x: 130, y: 0 },
			{ x: 0, y: 0 },
		]
		const horizontalOffsets = [
			{ x: 0, y: -towerOffset },
			{ x: 0, y: towerOffset },
			{ x: 0, y: 0 },
		]
		const isHorizontal = spawn.vx !== 0
		const OFFSETS = isHorizontal ? horizontalOffsets : verticalOffsets

		const verticalWarningOffsets = [
			{ x: -25, y: 0 },
			{ x: 25, y: 0 },
			{ x: 0, y: 0 },
		]
		const horizontalWarningOffsets = [
			{ x: 0, y: -25 },
			{ x: 0, y: 25 },
			{ x: 0, y: 0 },
		]
		const WARNING_OFFSETS = isHorizontal
			? horizontalWarningOffsets
			: verticalWarningOffsets

		for (let i = 0; i < this.rocketCount; i++) {
			const off = OFFSETS[i] || { x: 0, y: 0 }
			const x = this.cx + spawn.x + off.x
			const y = this.cy + spawn.y + off.y

			const factor = 0.8
			let warningX = this.cx + (x - this.cx) * factor
			let warningY = this.cy + (y - this.cy) * factor

			const extra = WARNING_OFFSETS[i] || { x: 0, y: 0 }
			warningX += extra.x
			warningY += extra.y

			this.warnings.push({ x: warningX, y: warningY })

			setTimeout(() => {
				this.launchSound.currentTime = 0
				this.launchSound.play().catch(() => {})

				let angle = Math.atan2(spawn.vy, spawn.vx)
				if (spawn.vx < 0 || spawn.vy < 0) angle += Math.PI

				this.rockets.push({
					x,
					y,
					vx: spawn.vx * this.speedMult,
					vy: spawn.vy * this.speedMult,
					angle,
					width: 32,
					height: 50,
				})
			}, 1000)
		}

		setTimeout(() => {
			this.warnings.length = 0
		}, 1000)
		setTimeout(() => this.launchSeries(), 1500)
	}

	update() {
		this.rockets.forEach(r => {
			r.x += r.vx
			r.y += r.vy
			r.angle = Math.atan2(r.vy, r.vx)

			// создаем партиклы следа ракеты
			this.particles.push({
				x: r.x - r.vx * 0.5,
				y: r.y - r.vy * 0.5,
				alpha: 1,
				size: Math.random() * 3 + 2,
				vx: (Math.random() - 0.5) * 1.5,
				vy: (Math.random() - 0.5) * 1.5,
				color: Math.random() < 0.5 ? 'rgba(255,165,0,' : 'rgba(255,255,0,',
			})

			if (
				Math.hypot(r.x - this.cx, r.y - this.cy) >
				CONFIG.circleRadius + 100
			) {
				this.explosionSound.currentTime = 0
				this.explosionSound.play().catch(() => {})
				r.exploded = true
			}
		})

		this.particles.forEach(p => {
			p.x += p.vx
			p.y += p.vy
			p.alpha -= 0.03
		})
		this.particles = this.particles.filter(p => p.alpha > 0)
	}

	hitsPlayer(px, py) {
		return this.rockets.some(r => Math.hypot(px - r.x, py - r.y) < 16)
	}

	draw(ctx) {
		ctx.font = '24px Arial'
		this.warnings.forEach(w => ctx.fillText('⚠️', w.x - 12, w.y + 12))

		// партиклы с свечением
		this.particles.forEach(p => {
			ctx.save() // сохранение контекста
			ctx.beginPath()
			ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
			ctx.fillStyle = p.color + p.alpha + ')'
			ctx.shadowColor = p.color + p.alpha + ')'
			ctx.shadowBlur = 4 // свечения только для этого элемента
			ctx.fill()
			ctx.restore() // восстановление контекста — остальные объекты не светятся
		})

		// ракеты
		this.rockets.forEach(r => {
			ctx.save()
			ctx.translate(r.x, r.y)
			ctx.rotate(r.angle - Math.PI / -2)
			if (rocketImg.complete) {
				ctx.drawImage(rocketImg, -r.width / 2, -r.height / 2, r.width, r.height)
			} else {
				ctx.fillStyle = 'red'
				ctx.fillRect(-8, -8, 16, 16)
			}
			ctx.restore()
		})

		// отладка хитбоксов
		if (this.debug) {
			ctx.strokeStyle = 'lime'
			ctx.lineWidth = 2
			this.rockets.forEach(r => {
				ctx.beginPath()
				ctx.rect(r.x - 12, r.y - 12, 24, 24)
				ctx.stroke()
			})
		}
	}
}

/* ===================== ZONE ===================== */
class ZoneAttack {
	constructor(cx, cy, scores) {
		this.cx = cx
		this.cy = cy

		const maxPlayerScore = scores
			? Object.values(scores).reduce((a, b) => a + b, 0)
			: 0

		// ---- размер зоны ----
		let part = 0.1 // 10%
		if (maxPlayerScore >= 10) part = 0.2
		if (maxPlayerScore >= 15) part = 0.3
		if (maxPlayerScore >= 20) part = 0.4
		if (maxPlayerScore >= 25) part = 0.5
		if (maxPlayerScore >= 30) part = 0.6
		if (maxPlayerScore >= 35) part = 0.7
		if (maxPlayerScore >= 40) part = 0.8
		if (maxPlayerScore >= 45) part = 0.9

		this.size = Math.PI * 2 * part
		this.start = Math.random() * Math.PI * 2
		this.end = this.start + this.size

		this.deadly = false
		this.done = false

		// скорость пульсации
		this.pulseSpeed = 0 //0.0075

		// ---- Таймеры ----
		setTimeout(() => (this.deadly = true), 2000) // зона становится смертельной
		setTimeout(() => (this.done = true), 3000) // зона завершена
	}

	hitsPlayer(px, py) {
		if (!this.deadly) return false

		let a = Math.atan2(py - this.cy, px - this.cx)
		if (a < 0) a += Math.PI * 2

		let s = this.start % (Math.PI * 2)
		let e = this.end % (Math.PI * 2)
		if (s < 0) s += Math.PI * 2
		if (e < 0) e += Math.PI * 2

		if (s <= e) return a >= s && a <= e
		else return a >= s || a <= e
	}

	draw(ctx) {
		const now = performance.now()

		// ---- Пульсация ----
		const pulse = 0.5 + 0.5 * Math.sin(now * this.pulseSpeed)
		const baseColor = this.deadly ? `255,80,0` : `200,200,200` // красная или серо-белая
		const innerAlpha = this.deadly ? pulse * 0.6 : pulse * 0.5

		// ---- Мягкое свечение по краю зоны ----
		const grad = ctx.createRadialGradient(
			this.cx,
			this.cy,
			CONFIG.circleRadius * 0.7,
			this.cx,
			this.cy,
			CONFIG.circleRadius,
		)
		grad.addColorStop(0, `rgba(${baseColor},0)`)
		grad.addColorStop(1, `rgba(${baseColor},${innerAlpha})`)

		ctx.fillStyle = grad
		ctx.beginPath()
		ctx.moveTo(this.cx, this.cy)
		ctx.arc(this.cx, this.cy, CONFIG.circleRadius, this.start, this.end)
		ctx.closePath()
		ctx.fill()

		// ---- Бегущие светящиеся точки по дуге ----
		const segments = 10
		for (let i = 0; i < segments; i++) {
			const t = (i / segments + now / 1500) % 1
			const a = this.start + t * this.size

			const x = this.cx + Math.cos(a) * CONFIG.circleRadius
			const y = this.cy + Math.sin(a) * CONFIG.circleRadius

			ctx.save()
			ctx.translate(x, y)
			ctx.rotate((now / 500 + i) % (Math.PI * 2))

			const color = this.deadly
				? `rgba(${255},${100 + Math.random() * 155},0,0.8)` // красные/оранжевые
				: `rgba(200,200,200,0.8)` // серо-белые

			ctx.fillStyle = color
			ctx.shadowColor = color
			ctx.shadowBlur = 6
			ctx.fillRect(-4, -4, 8, 8)
			ctx.restore()
		}
	}
}

/* ===================== StraightLaserAttack ===================== */
class StraightLaserAttack {
	constructor(cx, cy, scores) {
		this.cx = cx
		this.cy = cy
		this.scores = scores

		this.maxPlayerScore = Math.max(...Object.values(scores))

		this.active = false
		this.done = false
		this.currentSeries = 0
		this.totalSeries = 5

		this.laserLength = CONFIG.circleRadius
		this.laserWidthThin = 2
		this.laserWidthThick = 8

		this.angles = []
		this.particles = []

		this.startSeries()
	}

	startSeries() {
		if (this.currentSeries >= this.totalSeries) {
			this.done = true
			return
		}

		this.currentSeries++

		let laserCount = 1
		if (this.maxPlayerScore >= 10) laserCount = 2
		if (this.maxPlayerScore >= 20) laserCount = 3
		if (this.maxPlayerScore >= 30) laserCount = 4
		if (this.maxPlayerScore >= 40) laserCount = 5
		if (this.maxPlayerScore >= 50) laserCount = 10

		this.angles = []
		for (let i = 0; i < laserCount; i++) {
			this.angles.push(Math.random() * Math.PI * 2)
		}

		const prepTime = this.maxPlayerScore >= 50 ? 1000 : 750
		this.active = false

		setTimeout(() => (this.active = true), prepTime)
		setTimeout(() => this.startSeries(), prepTime + 500)
	}

	update() {
		this.particles.forEach(p => {
			p.life--
			p.rot += 0.12
		})

		this.particles = this.particles.filter(p => p.life > 0)
	}

	hitsPlayer(px, py) {
		if (!this.active) return false

		return this.angles.some(angle => {
			const dx = Math.cos(angle)
			const dy = Math.sin(angle)
			const t = (px - this.cx) * dx + (py - this.cy) * dy
			const lx = this.cx + t * dx
			const ly = this.cy + t * dy
			return Math.hypot(px - lx, py - ly) < this.laserWidthThick
		})
	}

	draw(ctx) {
		ctx.save()
		ctx.translate(this.cx, this.cy)

		const len = this.laserLength
		const pulse = 0.85 + Math.sin(Date.now() / 180) * 0.15

		this.angles.forEach(angle => {
			ctx.save()
			ctx.rotate(angle)

			// ---- ЛАЗЕР ----
			if (!this.active) {
				ctx.strokeStyle = 'rgba(255,255,255,0.5)'
				ctx.lineWidth = this.laserWidthThin
				ctx.shadowBlur = 0
			} else {
				ctx.strokeStyle = `rgba(255,${200 + 55 * pulse},${200 + 55 * pulse},0.95)`
				ctx.lineWidth = this.laserWidthThick
				ctx.shadowColor = 'red'
				ctx.shadowBlur = 14
			}

			ctx.beginPath()
			ctx.moveTo(-len, 0)
			ctx.lineTo(len, 0)
			ctx.stroke()

			ctx.shadowBlur = 0

			// ---- КОНЦЫ ЛАЗЕРА ----
			;[-1, 1].forEach(side => {
				const x = side * len

				this.spawnParticles(angle, side)
				this.drawStar(ctx, x, 0)
			})

			ctx.restore()
		})

		// ---- ПАРТИКЛЫ ----
		this.particles.forEach(p => {
			const r = CONFIG.circleRadius * p.side

			const x = Math.cos(p.angle) * r + Math.cos(p.spread) * 4
			const y = Math.sin(p.angle) * r + Math.sin(p.spread) * 4

			ctx.save()
			ctx.translate(x, y)
			ctx.rotate(p.rot)

			const a = p.life / 40
			ctx.fillStyle = `rgba(${p.color},${a})`
			ctx.shadowColor = `rgba(${p.color},${a})`
			ctx.shadowBlur = 10 * a

			ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
			ctx.restore()
		})

		ctx.restore()
	}

	spawnParticles(angle, side) {
		const MAX = 3

		const existing = this.particles.filter(
			p => p.angle === angle && p.side === side,
		)
		if (existing.length >= MAX) return

		this.particles.push({
			angle,
			side,
			life: 40,
			size: 6 + Math.random() * 4,
			rot: Math.random() * Math.PI,
			spread: Math.random() * Math.PI * 2,
			color: Math.random() < 0.5 ? '255,0,0' : '255,255,255',
		})
	}

	drawStar(ctx, x, y) {
		ctx.save()
		ctx.translate(x, y)
		ctx.rotate(Date.now() / 300)

		ctx.fillStyle = 'rgba(255,255,255,0.95)'
		ctx.shadowColor = 'white'
		ctx.shadowBlur = 12

		ctx.fillRect(-6, -2, 12, 4)
		ctx.fillRect(-2, -6, 4, 12)

		// внутренняя звезда
		ctx.shadowBlur = 6
		ctx.fillStyle = 'rgba(255,80,80,0.9)'
		ctx.fillRect(-3, -1, 6, 2)
		ctx.fillRect(-1, -3, 2, 6)

		ctx.restore()
	}
}

///===================== LASER =====================
class LaserAttack {
	constructor(cx, cy, scores) {
		this.cx = cx
		this.cy = cy
		this.score = Math.max(...Object.values(scores))

		this.rotationSpeed = 0.011
		this.dir = Math.random() < 0.5 ? 1 : -1
		this.angle = 0

		this.lasers = []
		this.particles = []

		if (this.score < 10) this.lasers = ['radius']
		else if (this.score < 20) this.lasers = [0]
		else if (this.score < 30) this.lasers = [0, 'radius']
		else if (this.score < 50) this.lasers = [0, Math.PI / 2]
		else this.lasers = [0, Math.PI / 2, Math.PI / 4]

		this.active = false
		this.done = false

		const prep = this.score >= 50 ? 500 : this.score >= 20 ? 1000 : 1500

		setTimeout(() => (this.active = true), prep)
		setTimeout(() => (this.done = true), prep + 5000)
	}

	update() {
		if (this.active) this.angle += this.rotationSpeed * this.dir

		this.particles.forEach(p => {
			p.life--
			p.rot += 0.1
		})

		this.particles = this.particles.filter(p => p.life > 0)
	}

	draw(ctx) {
		ctx.save()
		ctx.translate(this.cx, this.cy)

		this.lasers.forEach(l => {
			const baseAngle = this.angle + (l === 'radius' ? 0 : l)
			const ends = l === 'radius' ? [1] : [1, -1]

			ctx.rotate(baseAngle)

			// ---- ЛАЗЕР ----
			const pulse = 0.85 + Math.sin(Date.now() / 180) * 0.15
			ctx.lineWidth = this.active ? 8 : 3
			ctx.strokeStyle = `rgba(255,${200 + 55 * pulse},${200 + 55 * pulse},0.9)`
			ctx.shadowColor = 'red'
			ctx.shadowBlur = this.active ? 12 : 0

			ctx.beginPath()
			if (l === 'radius') {
				ctx.moveTo(0, 0)
				ctx.lineTo(CONFIG.circleRadius, 0)
			} else {
				ctx.moveTo(-CONFIG.circleRadius, 0)
				ctx.lineTo(CONFIG.circleRadius, 0)
			}
			ctx.stroke()

			ctx.shadowBlur = 0

			// ---- КОНЦЫ ЛАЗЕРА ----
			ends.forEach(side => {
				const x = side * CONFIG.circleRadius

				this.spawnParticles(baseAngle, side)

				this.drawStar(ctx, x, 0)
			})

			ctx.rotate(-baseAngle)
		})

		// ---- ПАРТИКЛЫ ----
		this.particles.forEach(p => {
			const ang = p.angle
			const r = CONFIG.circleRadius * p.side

			const x = Math.cos(ang) * r + Math.cos(p.spread) * 4
			const y = Math.sin(ang) * r + Math.sin(p.spread) * 4

			ctx.save()
			ctx.translate(x, y)
			ctx.rotate(p.rot)
			const a = p.life / 40
			ctx.fillStyle = `rgba(${p.color},${a})`
			ctx.shadowColor = `rgba(${p.color},${a})`
			ctx.shadowBlur = 8 * a
			ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
			ctx.restore()
		})

		ctx.restore()
	}

	spawnParticles(angle, side) {
		const MAX = 3

		const existing = this.particles.filter(
			p => p.angle === angle && p.side === side,
		)

		if (existing.length >= MAX) return

		this.particles.push({
			angle,
			side,
			life: 40,
			size: 6 + Math.random() * 4,
			rot: Math.random() * Math.PI,
			spread: Math.random() * Math.PI * 2,
			color: Math.random() < 0.5 ? '255,0,0' : '255,255,255',
		})
	}
	hitsPlayer(px, py) {
		if (!this.active) return false

		const HIT_WIDTH = 10 // толщина лазера (можно менять)

		return this.lasers.some(l => {
			const ang = this.angle + (l === 'radius' ? 0 : l)
			const dx = Math.cos(ang)
			const dy = Math.sin(ang)

			// проекция игрока на направление лазера
			const t = (px - this.cx) * dx + (py - this.cy) * dy

			// ограничение длины
			if (l === 'radius') {
				if (t < 0 || t > CONFIG.circleRadius) return false
			} else {
				if (t < -CONFIG.circleRadius || t > CONFIG.circleRadius) return false
			}

			// ближайшая точка лазера
			const lx = this.cx + dx * t
			const ly = this.cy + dy * t

			// расстояние до игрока
			return Math.hypot(px - lx, py - ly) <= HIT_WIDTH
		})
	}

	drawStar(ctx, x, y) {
		ctx.save()
		ctx.translate(x, y)
		ctx.rotate(Date.now() / 300)
		ctx.fillStyle = 'rgba(255,255,255,0.9)'
		ctx.shadowColor = 'white'
		ctx.shadowBlur = 12
		ctx.fillRect(-6, -2, 12, 4)
		ctx.fillRect(-2, -6, 4, 12)
		ctx.restore()
	}
}

/* ===================== GREEN LASER ===================== */
class GreenLaserAttack extends LaserAttack {
	constructor(cx, cy, scores) {
		super(cx, cy, scores)

		const prep = this.score >= 50 ? 500 : this.score >= 20 ? 1000 : 1500

		// смена направления как у тебя
		setTimeout(() => {
			this.dir *= -1
		}, prep + 2500)
	}

	draw(ctx) {
		ctx.save()
		ctx.translate(this.cx, this.cy)

		this.lasers.forEach(l => {
			const baseAngle = this.angle + (l === 'radius' ? 0 : l)
			const ends = l === 'radius' ? [1] : [1, -1]

			ctx.rotate(baseAngle)

			// ---- ЗЕЛЁНЫЙ ЛАЗЕР ----
			const pulse = 0.85 + Math.sin(Date.now() / 180) * 0.15
			ctx.lineWidth = this.active ? 8 : 3
			ctx.strokeStyle = this.active
				? `rgba(0, ${200 + 55 * pulse}, 120, 0.9)`
				: 'rgba(0,255,120,0.3)'

			ctx.shadowColor = '#00ff88'
			ctx.shadowBlur = this.active ? 14 : 0

			ctx.beginPath()
			if (l === 'radius') {
				ctx.moveTo(0, 0)
				ctx.lineTo(CONFIG.circleRadius, 0)
			} else {
				ctx.moveTo(-CONFIG.circleRadius, 0)
				ctx.lineTo(CONFIG.circleRadius, 0)
			}
			ctx.stroke()

			ctx.shadowBlur = 0

			// ---- КОНЦЫ ЛАЗЕРА (ЗВЁЗДЫ + ПАРТИКЛЫ) ----
			ends.forEach(side => {
				const x = side * CONFIG.circleRadius

				this.spawnGreenParticles(baseAngle, side)
				this.drawGreenStar(ctx, x, 0)
			})

			ctx.rotate(-baseAngle)
		})

		// ---- ПАРТИКЛЫ ----
		this.particles.forEach(p => {
			const r = CONFIG.circleRadius * p.side

			const x = Math.cos(p.angle) * r + Math.cos(p.spread) * 4
			const y = Math.sin(p.angle) * r + Math.sin(p.spread) * 4

			ctx.save()
			ctx.translate(x, y)
			ctx.rotate(p.rot)

			const a = p.life / 40
			ctx.fillStyle = `rgba(${p.color},${a})`
			ctx.shadowColor = `rgba(${p.color},${a})`
			ctx.shadowBlur = 10 * a

			ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
			ctx.restore()
		})

		ctx.restore()
	}

	spawnGreenParticles(angle, side) {
		const MAX = 3

		const existing = this.particles.filter(
			p => p.angle === angle && p.side === side && p.green,
		)
		if (existing.length >= MAX) return

		this.particles.push({
			angle,
			side,
			life: 40,
			size: 6 + Math.random() * 4,
			rot: Math.random() * Math.PI,
			spread: Math.random() * Math.PI * 2,
			color: Math.random() < 0.5 ? '0,255,140' : '180,255,220',
			green: true,
		})
	}

	drawGreenStar(ctx, x, y) {
		ctx.save()
		ctx.translate(x, y)
		ctx.rotate(Date.now() / 300)

		ctx.fillStyle = 'rgba(200,255,220,0.95)'
		ctx.shadowColor = '#00ff88'
		ctx.shadowBlur = 14

		ctx.fillRect(-6, -2, 12, 4)
		ctx.fillRect(-2, -6, 4, 12)

		// внутренняя звезда
		ctx.shadowBlur = 6
		ctx.fillStyle = 'rgba(0,255,150,0.9)'
		ctx.fillRect(-3, -1, 6, 2)
		ctx.fillRect(-1, -3, 2, 6)

		ctx.restore()
	}
}

/* ===================== ACID ===================== */

class AcidAttack {
	constructor(cx, cy) {
		this.cx = cx
		this.cy = cy
		this.objects = []
		this.particles = []
		this.done = false

		// 🔊 звук вылета кислоты
		this.launchSound = new Audio('assets/sfx/acid_launch.mp3')
		this.launchSound.volume = 0.9
		this.launchSound.play()

		// ---------- ОСНОВНЫЕ КИСЛОТНЫЕ СНАРЯДЫ ----------
		for (let i = 0; i < 6; i++) {
			const angle = Math.random() * Math.PI * 2
			const speed = 1.2
			this.objects.push({
				x: cx,
				y: cy, // стартует из центра
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				r: 20,
			})
		}

		setTimeout(() => (this.done = true), 3000)
	}

	update() {
		this.objects.forEach(a => {
			a.x += a.vx
			a.y += a.vy

			// ---------- ШЛЕЙФ ПАРТИКЛОВ (треугольник) ----------
			const particleCount = 1 // сколько партиклов на снаряд
			for (let i = 0; i < particleCount; i++) {
				// генерируем позицию на окружности снаряда
				const theta = Math.random() * Math.PI * 2
				const radiusOffset = a.r // радиус снаряда
				const px = a.x + Math.cos(theta) * radiusOffset
				const py = a.y + Math.sin(theta) * radiusOffset

				// направление к движению снаряда плюс небольшой разброс
				const angle = Math.atan2(a.vy, a.vx) + (Math.random() - 0.5) * 0.3
				const speed = 0.6 + Math.random() * 0.6

				this.particles.push({
					x: px,
					y: py,
					vx: Math.cos(angle) * speed,
					vy: Math.sin(angle) * speed,
					r: 2 + Math.random() * 3,
					life: 20 + Math.floor(Math.random() * 10),
				})
			}
		})

		// ---------- ОБНОВЛЕНИЕ ПАРТИКЛОВ ----------
		this.particles.forEach(p => {
			p.x += p.vx
			p.y += p.vy
			p.life--
		})

		this.particles = this.particles.filter(p => p.life > 0)
	}

	hitsPlayer(px, py) {
		return (
			this.objects.some(a => Math.hypot(px - a.x, py - a.y) < a.r) ||
			this.particles.some(p => Math.hypot(px - p.x, py - p.y) < p.r + 4)
		)
	}

	draw(ctx) {
		// ---------- ОСНОВНАЯ КИСЛОТА ----------
		this.objects.forEach(a => {
			ctx.save()
			ctx.shadowColor = 'rgba(0,255,100,0.9)'
			ctx.shadowBlur = 12
			ctx.fillStyle = '#3dff6a'
			ctx.beginPath()
			ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2)
			ctx.fill()
			ctx.restore()
		})

		// ---------- ШЛЕЙФ ПАРТИКЛОВ ----------
		this.particles.forEach(p => {
			ctx.save()
			ctx.shadowColor = 'rgba(0,255,120,0.8)'
			ctx.shadowBlur = 10
			ctx.fillStyle = 'rgba(100,255,150,0.9)'
			ctx.beginPath()
			ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
			ctx.fill()
			ctx.restore()
		})
	}
}

// ---------BombAttack----------
class BombAttack {
	constructor(cx, cy, scores) {
		this.cx = cx
		this.cy = cy
		this.scores = scores
		this.maxPlayerScore = Math.max(...Object.values(scores))

		this.bombs = []
		this.zone = []
		this.explosions = []

		this.done = false
		this.active = false

		this.zoneRadius = 50
		this.bombRadius = 20

		this.explosionDuration = 700

		this.prepTime = Math.max(750, 1500 - this.maxPlayerScore * 15)
		this.bombCount = Math.min(5, 1 + Math.floor(this.maxPlayerScore / 10))

		// зоны
		for (let i = 0; i < this.bombCount; i++) {
			const a = Math.random() * Math.PI * 2
			const x = this.cx + Math.cos(a) * CONFIG.circleRadius
			const y = this.cy + Math.sin(a) * CONFIG.circleRadius
			this.zone.push({ x, y, visible: true })
		}

		setTimeout(() => {
			this.active = true
			this.spawnBombs()
		}, this.prepTime)
	}

	spawnBombs() {
		const speed = 2 + this.maxPlayerScore / 20

		this.zone.forEach((z, i) => {
			const dx = z.x - this.cx
			const dy = z.y - this.cy
			const dist = Math.hypot(dx, dy)

			setTimeout(() => {
				this.bombs.push({
					x: this.cx,
					y: this.cy,
					vx: (dx / dist) * speed,
					vy: (dy / dist) * speed,
					targetX: z.x,
					targetY: z.y,
					exploded: false,
					zoneIndex: i,
					particles: [],
				})
			}, i * 300)
		})

		setTimeout(() => (this.done = true), 2000 + this.bombCount * 100)
	}

	update() {
		const now = performance.now()

		this.bombs.forEach(b => {
			if (!b.exploded) {
				b.x += b.vx
				b.y += b.vy

				// партиклы полёта
				b.particles.push({
					x: b.x,
					y: b.y,
					vx: (Math.random() - 0.5) * 0.6,
					vy: (Math.random() - 0.5) * 0.6,
					life: 20,
					rot: Math.random() * Math.PI,
				})

				b.particles.forEach(p => {
					p.x += p.vx
					p.y += p.vy
					p.life--
					p.rot += 0.2
				})

				b.particles = b.particles.filter(p => p.life > 0)

				if (Math.hypot(b.x - b.targetX, b.y - b.targetY) < 5) {
					if (!this._playedExplosionSound) {
						SoundManager.playBomb()
						this._playedExplosionSound = true
					}

					b.exploded = true
					this.zone[b.zoneIndex].visible = false
					this.explosions.push(this.createExplosion(b.targetX, b.targetY))
				}
			}
		})

		this.explosions = this.explosions.filter(
			e => now - e.startTime < this.explosionDuration,
		)
	}

	createExplosion(x, y) {
		const particles = []

		for (let i = 0; i < 28; i++) {
			const a = Math.random() * Math.PI * 2
			const s = Math.random() * 2 + 1
			particles.push({
				x,
				y,
				vx: Math.cos(a) * s,
				vy: Math.sin(a) * s,
				life: 40,
				rot: Math.random() * Math.PI,
				size: 4 + Math.random() * 3,
			})
		}

		return {
			x,
			y,
			startTime: performance.now(),
			particles,
		}
	}

	hitsPlayer(px, py) {
		return this.explosions.some(
			e => Math.hypot(px - e.x, py - e.y) < this.zoneRadius,
		)
	}

	draw(ctx) {
		const now = performance.now()

		// зоны
		this.zone.forEach(z => {
			if (z.visible) {
				ctx.fillStyle = `rgba(255,0,0,${0.3 + 0.2 * Math.sin(now / 200)})`
				ctx.beginPath()
				ctx.arc(z.x, z.y, this.zoneRadius, 0, Math.PI * 2)
				ctx.fill()
			}
		})

		// бомбы
		this.bombs.forEach(b => {
			if (!b.exploded) {
				ctx.save()
				ctx.translate(b.x, b.y)

				ctx.shadowColor = 'orange'
				ctx.shadowBlur = 0
				ctx.fillStyle = '#111'

				ctx.beginPath()
				ctx.arc(0, 0, this.bombRadius, 0, Math.PI * 2)
				ctx.fill()

				ctx.shadowBlur = 0

				// партиклы полёта
				b.particles.forEach(p => {
					ctx.save()
					ctx.translate(p.x - b.x, p.y - b.y)
					ctx.rotate(p.rot)
					const a = p.life / 20
					ctx.fillStyle = `rgba(255,120,60,${a})`
					ctx.fillRect(-2, -2, 4, 4)
					ctx.restore()
				})

				ctx.restore()
			}
		})

		// взрывы
		this.explosions.forEach(e => {
			const t = (now - e.startTime) / this.explosionDuration
			const alpha = 1 - t
			const radius = this.zoneRadius * (0.4 + t)

			// основное свечение
			const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, radius)
			g.addColorStop(0, `rgba(255,240,180,${alpha})`)
			g.addColorStop(0.5, `rgba(255,140,0,${alpha * 0.8})`)
			g.addColorStop(1, 'rgba(255,60,0,0)')

			ctx.fillStyle = g
			ctx.beginPath()
			ctx.arc(e.x, e.y, radius, 0, Math.PI * 2)
			ctx.fill()

			// частицы взрыва
			e.particles.forEach(p => {
				p.x += p.vx
				p.y += p.vy
				p.life--
				p.rot += 0.25

				const a = p.life / 40
				ctx.save()
				ctx.translate(p.x, p.y)
				ctx.rotate(p.rot)
				ctx.fillStyle = `rgba(255,180,80,${a})`
				ctx.shadowColor = 'orange'
				ctx.shadowBlur = 60 * a
				ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
				ctx.restore()
			})
		})
	}
}

/* ===================== EdgeStraightLaserAttack ===================== */
export class EdgeStraightLaserAttack {
	constructor(cx, cy, scores) {
		this.cx = cx
		this.cy = cy
		this.scores = scores

		this.maxPlayerScore = Math.max(...Object.values(scores))

		this.active = false
		this.done = false
		this.currentSeries = 0
		this.totalSeries = 5

		this.laserWidthThin = 2
		this.laserWidthThick = 8

		this.seriesLasers = []
		this.particles = []

		this.startSeries()
	}

	startSeries() {
		if (this.currentSeries >= this.totalSeries) {
			this.done = true
			return
		}

		this.currentSeries++

		let laserCount = 1
		if (this.maxPlayerScore >= 10) laserCount = 2
		if (this.maxPlayerScore >= 20) laserCount = 3
		if (this.maxPlayerScore >= 30) laserCount = 4
		if (this.maxPlayerScore >= 40) laserCount = 5
		if (this.maxPlayerScore >= 50) laserCount = 10

		const offsets = []
		for (let i = 0; i < laserCount; i++) {
			offsets.push((Math.random() - 0.5) * CONFIG.circleRadius * 1.5)
		}

		this.seriesLasers = offsets.map(offset => ({
			angle: Math.random() * Math.PI * 2,
			offset,
		}))

		this.active = false

		const prepTime = this.maxPlayerScore >= 50 ? 1000 : 750
		setTimeout(() => (this.active = true), prepTime)
		setTimeout(() => this.startSeries(), prepTime + 500)
	}

	update() {
		this.particles.forEach(p => {
			p.life--
			p.rot += 0.12
		})
		this.particles = this.particles.filter(p => p.life > 0)
	}

	hitsPlayer(px, py) {
		if (!this.active) return false

		const R = CONFIG.circleRadius

		return this.seriesLasers.some(laser => {
			const dx = Math.cos(laser.angle)
			const dy = Math.sin(laser.angle)

			const perpX = -dy * laser.offset
			const perpY = dx * laser.offset

			const t = (px - (this.cx + perpX)) * dx + (py - (this.cy + perpY)) * dy
			const lx = this.cx + perpX + t * dx
			const ly = this.cy + perpY + t * dy

			const maxLen = Math.sqrt(R * R - laser.offset * laser.offset)
			if (t < -maxLen || t > maxLen) return false

			return Math.hypot(px - lx, py - ly) < this.laserWidthThick
		})
	}

	draw(ctx) {
		ctx.save()
		ctx.translate(this.cx, this.cy)

		const pulse = 0.85 + Math.sin(Date.now() / 180) * 0.15
		const R = CONFIG.circleRadius

		this.seriesLasers.forEach(laser => {
			const dx = Math.cos(laser.angle)
			const dy = Math.sin(laser.angle)

			const perpX = -dy * laser.offset
			const perpY = dx * laser.offset

			const halfLen = Math.sqrt(R * R - laser.offset * laser.offset)

			// ---- ЛАЗЕР ----
			if (!this.active) {
				ctx.strokeStyle = 'rgba(255,255,255,0.5)'
				ctx.lineWidth = this.laserWidthThin
				ctx.shadowBlur = 0
			} else {
				ctx.strokeStyle = `rgba(255,${200 + 55 * pulse},${200 + 55 * pulse},0.95)`
				ctx.lineWidth = this.laserWidthThick
				ctx.shadowColor = 'red'
				ctx.shadowBlur = 14
			}

			ctx.beginPath()
			ctx.moveTo(perpX - dx * halfLen, perpY - dy * halfLen)
			ctx.lineTo(perpX + dx * halfLen, perpY + dy * halfLen)
			ctx.stroke()

			ctx.shadowBlur = 0

			// ---- КОНЦЫ ЛАЗЕРА ----
			;[-1, 1].forEach(side => {
				const x = perpX + dx * halfLen * side
				const y = perpY + dy * halfLen * side

				this.spawnParticles(laser.angle, laser.offset, side)
				this.drawStar(ctx, x, y)
			})
		})

		// ---- ПАРТИКЛЫ ----
		this.particles.forEach(p => {
			const dx = Math.cos(p.angle)
			const dy = Math.sin(p.angle)

			const perpX = -dy * p.offset
			const perpY = dx * p.offset

			const halfLen = Math.sqrt(R * R - p.offset * p.offset)

			const x = perpX + dx * halfLen * p.side + Math.cos(p.spread) * 4
			const y = perpY + dy * halfLen * p.side + Math.sin(p.spread) * 4

			ctx.save()
			ctx.translate(x, y)
			ctx.rotate(p.rot)

			const a = p.life / 40
			ctx.fillStyle = `rgba(${p.color},${a})`
			ctx.shadowColor = `rgba(${p.color},${a})`
			ctx.shadowBlur = 10 * a

			ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
			ctx.restore()
		})

		ctx.restore()
	}

	spawnParticles(angle, offset, side) {
		const MAX = 3
		const existing = this.particles.filter(
			p => p.angle === angle && p.offset === offset && p.side === side,
		)
		if (existing.length >= MAX) return

		this.particles.push({
			angle,
			offset,
			side,
			life: 40,
			size: 6 + Math.random() * 4,
			rot: Math.random() * Math.PI,
			spread: Math.random() * Math.PI * 2,
			color: Math.random() < 0.5 ? '255,0,0' : '255,255,255',
		})
	}

	drawStar(ctx, x, y) {
		ctx.save()
		ctx.translate(x, y)
		ctx.rotate(Date.now() / 300)

		ctx.fillStyle = 'rgba(255,255,255,0.95)'
		ctx.shadowColor = 'white'
		ctx.shadowBlur = 12

		ctx.fillRect(-6, -2, 12, 4)
		ctx.fillRect(-2, -6, 4, 12)

		ctx.shadowBlur = 6
		ctx.fillStyle = 'rgba(255,80,80,0.9)'
		ctx.fillRect(-3, -1, 6, 2)
		ctx.fillRect(-1, -3, 2, 6)

		ctx.restore()
	}
}
class AttackSoundManager {
	constructor() {
		// ---- Звуки ----
		this.laserSound = new Audio('assets/laser.mp3')
		this.laserSound.volume = 1

		this.bombSound = new Audio('assets/bomb_explosion.mp3')
		this.bombSound.volume = 0.7

		// ---- Активные объекты для предотвращения повторного проигрывания ----
		this.activeLasers = new Set()
		this.activeBombExplosions = new Set()
	}

	update(attacks) {
		if (!attacks || !Array.isArray(attacks)) return

		attacks.forEach(att => {
			if (!att) return // пропустить undefined или null

			// ---- ЛАЗЕРНЫЕ АТАКИ ----
			if (
				att instanceof LaserAttack ||
				att instanceof GreenLaserAttack ||
				att instanceof StraightLaserAttack ||
				att instanceof EdgeStraightLaserAttack
			) {
				if (att.active && !this.activeLasers.has(att)) {
					// Проигрываем звук один раз при активации
					this.laserSound.currentTime = 0
					this.laserSound.play().catch(() => {})
					this.activeLasers.add(att)
				} else if (!att.active && this.activeLasers.has(att)) {
					// Когда лазер деактивируется, удаляем из Set
					this.activeLasers.delete(att)
				}
			}

			// ---- БОМБЫ ----
			if (att instanceof BombAttack && Array.isArray(att.explosions)) {
				att.explosions.forEach(explosion => {
					if (!this.activeBombExplosions.has(explosion)) {
						// Проигрываем звук взрыва один раз
						this.bombSound.currentTime = 0
						this.bombSound.play().catch(() => {})
						this.activeBombExplosions.add(explosion)
					}
				})

				// Удаляем взрывы, которые уже закончились
				att.explosions.forEach(explosion => {
					if (performance.now() - explosion.startTime > att.explosionDuration) {
						this.activeBombExplosions.delete(explosion)
					}
				})
			}
		})
	}
}
