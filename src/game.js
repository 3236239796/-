import { Vector3, Matrix, MeshBuilder, Color3, StandardMaterial, Scalar } from '@babylonjs/core';
import { createWorld, createPlayerVisual, createEnemyVisual, createProjectileVisual, createTelegraph, createImpact, createXpOrb } from './scene.js';
import { createRunState, applyDamage, grantExperience, applyUpgrade, getWaveConfig, getEnemyConfig, getUpgradeChoices, hasSynergy, canCompleteRun } from './game/rules.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randomBetween = (min, max) => min + Math.random() * (max - min);
const flatDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const flatDirection = (from, to) => {
  const direction = new Vector3(to.x - from.x, 0, to.z - from.z);
  return direction.lengthSquared() > 0.0001 ? direction.normalize() : new Vector3(0, 0, 1);
};

export class Game {
  constructor(engine, canvas, ui, audio, input, rendererName) {
    this.engine = engine;
    this.canvas = canvas;
    this.ui = ui;
    this.audio = audio;
    this.input = input;
    this.rendererName = rendererName;
    this.world = createWorld(engine);
    this.scene = this.world.scene;
    this.camera = this.world.camera;
    this.materials = this.world.materials;
    this.state = createRunState();
    this.state.cooldowns = { dash: 0, shot: 0, special: 0, hurt: 0 };
    this.state.boss = null;
    this.player = createPlayerVisual(this.scene, this.world.shadowGenerator, this.materials);
    this.player.position.y = 0;
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.pickups = [];
    this.telegraphs = [];
    this.particles = [];
    this.started = false;
    this.paused = false;
    this.pendingLevelUps = 0;
    this.spawnTimer = 0;
    this.waveClock = 0;
    this.bossSpawned = false;
    this.comboTimer = 0;
    this.damageFlash = 0;
    this.invulnerable = 0;
    this.aimPoint = new Vector3(0, 0, -8);
    this.lastHud = 0;
    this.obstacles = [];
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      this.obstacles.push({ x: Math.cos(angle) * 17.2, z: Math.sin(angle) * 17.2, radius: 0.9 });
    }
    for (let i = 0; i < 4; i += 1) {
      const angle = Math.PI / 4 + i * Math.PI / 2;
      this.obstacles.push({ x: Math.cos(angle) * 8.8, z: Math.sin(angle) * 8.8, radius: 1.7 });
    }
    this.meta = this.loadMeta();
    try { this.quality = localStorage.getItem('null-ascent-quality') || 'high'; } catch { this.quality = 'high'; }
    this.applyQuality(this.quality);
    this.ui.showMenu(this.meta.best);
    this.ui.setQuality(this.quality);
  }

  loadMeta() {
    try {
      return JSON.parse(localStorage.getItem('null-ascent-meta') || '{"best":null,"runs":0,"wins":0,"totalKills":0}');
    } catch {
      return { best: null, runs: 0, wins: 0, totalKills: 0 };
    }
  }

  saveMeta(won) {
    this.meta.runs += 1;
    this.meta.totalKills += this.state.progress.kills;
    if (won) this.meta.wins += 1;
    const record = { wave: this.state.progress.wave, time: this.state.progress.elapsed, kills: this.state.progress.kills, won };
    if (!this.meta.best || record.wave > this.meta.best.wave || (record.wave === this.meta.best.wave && record.time > this.meta.best.time)) this.meta.best = record;
    try { localStorage.setItem('null-ascent-meta', JSON.stringify(this.meta)); } catch (error) { console.warn('Run record could not be saved.', error); }
  }

  resetRun() {
    this.state = createRunState(Date.now());
    this.state.cooldowns = { dash: 0, shot: 0, special: 0, hurt: 0 };
    this.state.boss = null;
    this.enemies.forEach(enemy => enemy.mesh.dispose());
    this.projectiles.forEach(item => item.mesh.dispose());
    this.enemyProjectiles.forEach(item => item.mesh.dispose());
    this.pickups.forEach(item => item.mesh.dispose());
    this.telegraphs.forEach(item => item.ring?.dispose());
    this.particles.forEach(item => item.mesh.dispose());
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.pickups = [];
    this.telegraphs = [];
    this.particles = [];
    this.pendingLevelUps = 0;
    this.spawnTimer = 0;
    this.waveClock = 0;
    this.bossSpawned = false;
    this.comboTimer = 0;
    this.damageFlash = 0;
    this.invulnerable = 0;
    this.player.position.copyFromFloats(0, 0, 0);
    this.player.rotation.y = 0;
    this.player.setEnabled(true);
    this.camera.setTarget(Vector3.Zero());
    this.camera.radius = this.quality === 'low' ? 22 : 23;
    this.started = true;
    this.paused = false;
    this.finished = false;
  }

  async start() {
    this.resetRun();
    await this.audio.unlock();
    this.ui.showGame();
    this.ui.toast('裂隙连接建立 / 远征开始');
    this.audio.play('upgrade', 0.7);
    this.spawnEnemy('ravager');
    this.spawnEnemy('stalker');
    this.updateHUD(true);
  }

  pause() {
    if (!this.started || this.paused || this.state.status !== 'playing') return;
    this.paused = true;
    this.ui.showPause({ wave: this.state.progress.wave, kills: this.state.progress.kills, time: this.state.progress.elapsed });
  }

  resume() {
    if (!this.started || !this.paused || this.pendingLevelUps > 0) return;
    this.paused = false;
    this.ui.el['pause-screen'].classList.add('hidden');
    this.ui.el['settings-screen'].classList.add('hidden');
    this.ui.el['hud-layer'].classList.remove('hidden');
  }

  abandon() {
    if (!this.started) return;
    this.finish(false, true);
  }

  restart() { this.start(); }

  menu() {
    this.started = false;
    this.paused = false;
    this.ui.showMenu(this.meta.best);
  }

  applyQuality(value) {
    this.quality = value;
    try { localStorage.setItem('null-ascent-quality', value); } catch { /* settings remain active for this session */ }
    const scale = value === 'high' ? 1 : value === 'medium' ? 1.15 : 1.35;
    this.engine.setHardwareScalingLevel(scale);
    this.world.pipeline.samples = value === 'high' ? 4 : 1;
    this.world.pipeline.bloomWeight = value === 'high' ? 0.22 : value === 'medium' ? 0.16 : 0.1;
    this.world.glow.intensity = value === 'high' ? 0.48 : value === 'medium' ? 0.35 : 0.22;
    this.world.shadowGenerator.blurKernel = value === 'high' ? 24 : 12;
  }

  setVolume(value) { this.audio.setVolume(value); }
  setMusic(value) { this.audio.setMusicEnabled(value); }
  setSfx(value) { this.audio.setSfxEnabled(value); }

  getAimPoint() {
    const rect = this.canvas.getBoundingClientRect();
    const x = this.input.pointer.x * this.engine.getRenderWidth() / Math.max(1, rect.width);
    const y = this.input.pointer.y * this.engine.getRenderHeight() / Math.max(1, rect.height);
    const ray = this.scene.createPickingRay(x, y, Matrix.Identity(), this.camera);
    if (Math.abs(ray.direction.y) > 0.0001) {
      const distance = -ray.origin.y / ray.direction.y;
      if (distance > 0) {
        this.aimPoint.copyFrom(ray.origin.add(ray.direction.scale(distance)));
        this.aimPoint.y = 0;
      }
    }
    return this.aimPoint;
  }

  spawnEnemy(type = 'ravager') {
    if (this.enemies.length >= 18) return null;
    const stats = getEnemyConfig(type, this.state.progress.wave);
    const angle = randomBetween(0, Math.PI * 2);
    const radius = randomBetween(15.2, 17.4);
    const mesh = createEnemyVisual(this.scene, this.world.shadowGenerator, this.materials, type);
    mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    const enemy = {
      id: `enemy-${Math.random().toString(36).slice(2)}`,
      type, mesh, stats, hp: stats.hp, maxHp: stats.hp, boss: Boolean(stats.boss),
      cooldown: randomBetween(0.7, 2.1), action: null, hitFlash: 0,
      movePhase: randomBetween(0, Math.PI * 2), attackCount: 0, dead: false
    };
    this.enemies.push(enemy);
    if (enemy.boss) {
      this.bossSpawned = true;
      this.state.boss = { name: type === 'choir' ? 'THE CHOIR' : 'THE HERALD', hp: enemy.hp, maxHp: enemy.maxHp, phaseLabel: 'PHASE I' };
      this.ui.toast(type === 'choir' ? '最终异常体 / THE CHOIR' : '守门者出现 / THE HERALD', 'warning');
      this.audio.play('boss', type === 'choir' ? 1.5 : 1.1);
    }
    return enemy;
  }

  spawnPlayerProjectile(direction, offset = 0, damageScale = 1) {
    const projectile = createProjectileVisual(this.scene, this.materials, true, 1);
    const dir = direction.clone();
    const origin = this.player.position.add(new Vector3(0, 1.18, 0)).add(dir.scale(0.72));
    projectile.position.copyFrom(origin);
    projectile.lookAt(origin.add(dir), Math.PI / 2, 0, 0);
    this.projectiles.push({
      mesh: projectile, direction: dir, speed: this.state.player.projectileSpeed,
      damage: this.state.player.damage * damageScale, life: 1.8,
      pierce: Math.max(0, Math.floor(this.state.player.projectiles) - 1),
      crit: Math.random() < this.state.player.critChance
    });
  }

  resolvePlayerPosition(position) {
    for (let pass = 0; pass < 3; pass += 1) {
      for (const obstacle of this.obstacles) {
        const dx = position.x - obstacle.x;
        const dz = position.z - obstacle.z;
        const distance = Math.hypot(dx, dz);
        const minimum = obstacle.radius + 0.48;
        if (distance < minimum) {
          const angle = distance > 0.0001 ? Math.atan2(dz, dx) : Math.random() * Math.PI * 2;
          position.x = obstacle.x + Math.cos(angle) * minimum;
          position.z = obstacle.z + Math.sin(angle) * minimum;
        }
      }
    }
    position.x = clamp(position.x, -18.2, 18.2);
    position.z = clamp(position.z, -18.2, 18.2);
    return position;
  }

  fire() {
    if (this.state.cooldowns.shot > 0 || !this.input.pointer.down) return;
    const target = this.getAimPoint();
    const direction = flatDirection(this.player.position, target);
    this.player.rotation.y = Math.atan2(direction.x, direction.z);
    const count = clamp(Math.floor(this.state.player.projectiles) + (hasSynergy(this.state, 'prism') ? 1 : 0), 1, 5);
    for (let i = 0; i < count; i += 1) {
      const spread = (i - (count - 1) / 2) * 0.075;
      const rotated = new Vector3(
        direction.x * Math.cos(spread) - direction.z * Math.sin(spread),
        0,
        direction.x * Math.sin(spread) + direction.z * Math.cos(spread)
      );
      this.spawnPlayerProjectile(rotated.normalize(), 0, i === 0 ? 1 : 0.82);
    }
    this.state.cooldowns.shot = this.state.player.fireRate;
    this.state.stats.shotsFired += 1;
    this.audio.play('shot', 0.65);
  }

  dash(movement) {
    if (this.state.cooldowns.dash > 0) return;
    const target = this.getAimPoint();
    let direction = new Vector3(movement.x, 0, movement.z);
    if (direction.lengthSquared() < 0.01) direction = flatDirection(this.player.position, target);
    else direction.normalize();
    const start = this.player.position.clone();
    const distance = this.state.player.dashDistance;
    const destination = this.player.position.add(direction.scale(distance));
    destination.x = clamp(destination.x, -18.2, 18.2);
    destination.z = clamp(destination.z, -18.2, 18.2);
    this.resolvePlayerPosition(destination);
    this.player.position.copyFrom(destination);
    this.state.cooldowns.dash = this.state.player.dashCooldown;
    this.invulnerable = 0.34;
    this.state.stats.dodges += 1;
    this.player.rotation.y = Math.atan2(direction.x, direction.z);
    this.particles.push(...createImpact(this.scene, this.materials, start.add(new Vector3(0, 0.3, 0)), 'cyan', 14));
    if (this.state.player.dashDamage > 0 || hasSynergy(this.state, 'phase')) {
      const radius = 2.1;
      for (const enemy of this.enemies) {
        if (flatDistance(this.player.position, enemy.mesh.position) < radius + enemy.stats.radius) this.damageEnemy(enemy, this.state.player.dashDamage || 36, false);
      }
    }
    this.audio.play('dash');
  }

  useSpecial() {
    if (this.state.player.specialCharge < 100 || this.state.cooldowns.special > 0) return;
    this.state.player.specialCharge = 0;
    this.state.cooldowns.special = 1.2;
    const center = this.player.position.clone();
    this.particles.push(...createImpact(this.scene, this.materials, center.add(new Vector3(0, 0.7, 0)), 'amber', 28));
    for (const enemy of this.enemies) {
      const distance = flatDistance(this.player.position, enemy.mesh.position);
      if (distance < 8.2) {
        this.damageEnemy(enemy, 92 + this.state.player.damage * 1.2, true);
        const direction = flatDirection(this.player.position, enemy.mesh.position);
        enemy.mesh.position.addInPlace(direction.scale(1.5));
      }
    }
    this.enemyProjectiles.forEach(projectile => projectile.mesh.dispose());
    this.enemyProjectiles = [];
    this.ui.toast('裂隙脉冲 / RIFT PULSE', 'warning');
    this.audio.play('pulse', 1.35);
  }

  startTelegraph(enemy, type, duration, radius, position = this.player.position) {
    const ring = createTelegraph(this.scene, this.materials, radius, 'red');
    ring.position.set(position.x, 0.09, position.z);
    ring.scaling.setAll(0.35);
    const action = { type, timer: duration, duration, radius, position: position.clone(), ring };
    enemy.action = action;
    this.telegraphs.push(action);
  }

  resolveEnemyAttack(enemy, action) {
    if (action.type === 'melee' || action.type === 'slam' || action.type === 'charge') {
      const distance = flatDistance(this.player.position, action.position);
      if (distance <= action.radius + 0.52 && (this.invulnerable ?? 0) <= 0) this.hurt(enemy.stats.damage);
      if (action.type === 'charge') {
        const direction = flatDirection(enemy.mesh.position, this.player.position);
        enemy.mesh.position.addInPlace(direction.scale(2.4));
      }
      this.particles.push(...createImpact(this.scene, this.materials, action.position.add(new Vector3(0, 0.15, 0)), 'red', 9));
    } else if (action.type === 'shot') {
      const direction = flatDirection(enemy.mesh.position, this.player.position);
      this.spawnEnemyProjectile(enemy.mesh.position, direction, enemy.stats.damage, 8.5);
    } else if (action.type === 'fan') {
      const base = flatDirection(enemy.mesh.position, this.player.position);
      const count = enemy.type === 'choir' ? 16 : 10;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + (enemy.attackCount % 2) * 0.1;
        const direction = new Vector3(Math.cos(angle), 0, Math.sin(angle));
        this.spawnEnemyProjectile(enemy.mesh.position, direction, enemy.stats.damage * 0.72, enemy.type === 'choir' ? 7.8 : 6.8, 0.9);
      }
      if (enemy.type === 'choir' && enemy.hp / enemy.maxHp < 0.48) {
        for (let i = 0; i < 8; i += 1) {
          const angle = Math.atan2(base.z, base.x) + (i - 3.5) * 0.16;
          this.spawnEnemyProjectile(enemy.mesh.position, new Vector3(Math.cos(angle), 0, Math.sin(angle)), enemy.stats.damage, 11, 1.15);
        }
      }
    }
    enemy.attackCount += 1;
    enemy.cooldown = enemy.boss ? randomBetween(3.1, 4.2) : randomBetween(1.7, 2.8);
    enemy.action = null;
  }

  spawnEnemyProjectile(position, direction, damage, speed, scale = 1) {
    const mesh = createProjectileVisual(this.scene, this.materials, false, scale);
    mesh.position.copyFrom(position.add(new Vector3(0, 0.95, 0)));
    mesh.lookAt(mesh.position.add(direction), Math.PI / 2, 0, 0);
    this.enemyProjectiles.push({ mesh, direction: direction.clone(), damage, speed, life: 4.2 });
  }

  hurt(amount) {
    if ((this.invulnerable ?? 0) > 0 || this.state.status !== 'playing') return;
    this.state = applyDamage(this.state, amount);
    this.state.cooldowns.hurt = 0.55;
    this.invulnerable = 0.24;
    this.damageFlash = 0.2;
    this.state.progress.combo = 0;
    this.audio.play('hurt');
    this.ui.toast('装甲受损 / INTEGRITY DOWN', 'warning');
    if (this.state.status === 'defeat') this.finish(false);
  }

  damageEnemy(enemy, amount, special = false, critical = false) {
    if (enemy.dead) return;
    const wasAlive = enemy.hp > 0;
    enemy.hp = Math.max(0, enemy.hp - amount);
    enemy.hitFlash = 0.12;
    this.state.stats.damageDealt += amount;
    this.particles.push(...createImpact(this.scene, this.materials, enemy.mesh.position.add(new Vector3(0, 1, 0)), special || critical ? 'amber' : 'cyan', special ? 10 : 5));
    if (enemy.hp <= 0 && wasAlive) this.killEnemy(enemy);
    else if (!special) this.audio.play('hit', amount > 50 ? 1.3 : 0.6);
    if (enemy.boss) {
      this.state.boss = { name: enemy.type === 'choir' ? 'THE CHOIR' : 'THE HERALD', hp: enemy.hp, maxHp: enemy.maxHp, phaseLabel: enemy.hp / enemy.maxHp < 0.48 ? 'PHASE III' : enemy.hp / enemy.maxHp < 0.72 ? 'PHASE II' : 'PHASE I' };
    }
  }

  killEnemy(enemy) {
    enemy.dead = true;
    if (enemy.action?.ring) {
      enemy.action.ring.dispose();
      this.telegraphs = this.telegraphs.filter(item => item !== enemy.action);
      enemy.action = null;
    }
    this.state.progress.kills += 1;
    this.state.progress.combo += 1;
    this.state.progress.bestCombo = Math.max(this.state.progress.bestCombo, this.state.progress.combo);
    this.comboTimer = 4.2;
    this.state.player.specialCharge = Math.min(100, this.state.player.specialCharge + (enemy.boss ? 30 : 5) * this.state.player.specialGain);
    if (enemy.boss) this.state.stats.eliteKills += 1;
    const drop = createXpOrb(this.scene, this.materials, enemy.mesh.position, enemy.stats.xp);
    this.pickups.push({ mesh: drop, value: enemy.stats.xp, kind: 'xp', life: 25 });
    if (Math.random() < 0.055 && !enemy.boss) {
      const heal = createXpOrb(this.scene, this.materials, enemy.mesh.position.add(new Vector3(0.3, 0, 0)), 1);
      heal.metadata.value = 1;
      this.pickups.push({ mesh: heal, value: 1, kind: 'heal', life: 20 });
    }
    if (hasSynergy(this.state, 'echo')) {
      for (const other of this.enemies) {
        if (other !== enemy && flatDistance(enemy.mesh.position, other.mesh.position) < 4.4) this.damageEnemy(other, 30, true);
      }
    }
    enemy.mesh.dispose();
    this.enemies = this.enemies.filter(item => item !== enemy);
    this.audio.play(enemy.boss ? 'boss' : 'crit', enemy.boss ? 0.9 : 0.55);
    if (enemy.boss) {
      this.state.progress.bossDefeated = true;
      this.state.boss = null;
      this.advanceWave();
    }
  }

  collectPickup(pickup) {
    pickup.mesh.dispose();
    this.pickups = this.pickups.filter(item => item !== pickup);
    if (pickup.kind === 'heal') {
      this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + 18);
      this.ui.toast('核心修复 +18', 'normal');
    } else {
      const result = grantExperience(this.state, pickup.value);
      this.state = result.state;
      this.pendingLevelUps += result.levelUps;
      this.state.player.specialCharge = Math.min(100, this.state.player.specialCharge + 1.5 * this.state.player.specialGain);
      if (this.state.player.pickupHeal > 0) this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + this.state.player.pickupHeal);
      if (result.levelUps > 0) this.ui.toast('共振升级 / MODULE AVAILABLE');
    }
    this.audio.play('pickup', 0.55);
    if (this.pendingLevelUps > 0 && !this.paused) this.showNextUpgrade();
  }

  showNextUpgrade() {
    if (this.pendingLevelUps <= 0) { this.paused = false; return; }
    this.paused = true;
    const choices = getUpgradeChoices(this.state, this.state.seed + this.state.progress.level * 7919 + this.pendingLevelUps);
    this.ui.showUpgrade(choices, choice => {
      this.state = applyUpgrade(this.state, choice);
      this.pendingLevelUps -= 1;
      this.audio.play('upgrade');
      if (hasSynergy(this.state, choice.tags?.[0])) this.ui.toast(`${choice.tags[0].toUpperCase()} SYNERGY ONLINE`);
      if (this.pendingLevelUps > 0) this.showNextUpgrade();
      else {
        this.ui.hideUpgrade();
        this.paused = false;
        this.updateHUD(true);
      }
    });
  }

  advanceWave() {
    const current = this.state.progress.wave;
    if (current >= 5 && canCompleteRun({ wave: current, bossAlive: false })) {
      this.finish(true);
      return;
    }
    this.enemies.forEach(enemy => { enemy.action?.ring?.dispose(); enemy.mesh.dispose(); });
    this.enemies = [];
    this.telegraphs.forEach(action => action.ring?.dispose());
    this.telegraphs = [];
    this.state.progress.wave += 1;
    this.state.progress.sectorTime = 0;
    this.spawnTimer = 0;
    this.waveClock = 0;
    this.bossSpawned = false;
    this.state.boss = null;
    this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + 12);
    this.state.player.shield = Math.min(this.state.player.maxShield, this.state.player.shield + 14);
    this.ui.toast(`进入战区 ${String(this.state.progress.wave).padStart(2,'0')} / SECTOR ADVANCED`);
    this.audio.play('upgrade', 0.75);
  }

  updateEnemy(enemy, dt, playerPosition) {
    const position = enemy.mesh.position;
    const delta = playerPosition.subtract(position);
    delta.y = 0;
    const distance = delta.length();
    const direction = distance > 0.001 ? delta.scale(1 / distance) : Vector3.Zero();
    enemy.movePhase += dt * (enemy.type === 'stalker' ? 4.4 : 2.2);
    if (enemy.action) {
      const action = enemy.action;
      action.timer -= dt;
      action.ring.scaling.setAll(0.35 + (1 - action.timer / action.duration) * 0.65);
      action.ring.rotation.y += dt * 0.6;
      if (action.timer <= 0) {
        action.ring.dispose();
        this.telegraphs = this.telegraphs.filter(item => item !== action);
        this.resolveEnemyAttack(enemy, action);
      }
      return;
    }
    enemy.cooldown -= dt;
    const bob = Math.sin(enemy.movePhase) * (enemy.boss ? 0.09 : 0.035);
    position.y = bob;
    enemy.mesh.rotation.y = Math.atan2(direction.x, direction.z);
    if (enemy.mesh.metadata?.halo) enemy.mesh.metadata.halo.rotation.y += dt * (enemy.boss ? 0.8 : 1.4);
    if (enemy.mesh.metadata?.core) enemy.mesh.metadata.core.scaling.setAll(1 + Math.sin(enemy.movePhase * 2) * 0.07);

    if (enemy.boss) {
      const phase = enemy.hp / enemy.maxHp < 0.48 ? 3 : enemy.hp / enemy.maxHp < 0.72 ? 2 : 1;
      const preferred = phase === 3 ? 4.2 : 5.2;
      if (distance > preferred) position.addInPlace(direction.scale(enemy.stats.speed * dt));
      if (enemy.cooldown <= 0) {
        const attackType = enemy.attackCount % 3 === 0 ? 'fan' : phase === 3 ? 'charge' : 'slam';
        const radius = attackType === 'fan' ? 2.1 : phase === 3 ? 3.4 : 4.6;
        this.startTelegraph(enemy, attackType, phase === 3 ? 0.78 : 1.12, radius, attackType === 'charge' ? playerPosition : position);
      }
      return;
    }

    if (enemy.type === 'arbalist') {
      if (distance > 8.2) position.addInPlace(direction.scale(enemy.stats.speed * dt));
      else if (distance < 5.2) position.addInPlace(direction.scale(-enemy.stats.speed * dt));
      if (enemy.cooldown <= 0 && distance < 10.5) this.startTelegraph(enemy, 'shot', enemy.stats.windup, 0.65, position);
      return;
    }

    const reach = enemy.stats.range;
    if (distance > reach) {
      const speed = enemy.stats.speed * (enemy.type === 'stalker' && distance > 5 ? 1.18 : 1);
      position.addInPlace(direction.scale(speed * dt));
    } else if (enemy.cooldown <= 0) {
      const attack = enemy.type === 'stalker' ? 'charge' : 'melee';
      this.startTelegraph(enemy, attack, enemy.stats.windup, enemy.type === 'bulwark' ? 2.25 : 1.55, playerPosition);
    }
  }

  updateProjectiles(dt) {
    for (const projectile of [...this.projectiles]) {
      projectile.life -= dt;
      projectile.mesh.position.addInPlace(projectile.direction.scale(projectile.speed * dt));
      if (projectile.life <= 0 || Math.abs(projectile.mesh.position.x) > 25 || Math.abs(projectile.mesh.position.z) > 25) {
        projectile.mesh.dispose();
        this.projectiles = this.projectiles.filter(item => item !== projectile);
        continue;
      }
      const target = this.enemies.find(enemy => flatDistance(projectile.mesh.position, enemy.mesh.position.add(new Vector3(0, 1, 0))) < enemy.stats.radius + 0.42);
      if (target) {
        const damage = projectile.crit ? projectile.damage * this.state.player.critDamage : projectile.damage;
        this.damageEnemy(target, damage, false, projectile.crit);
        if (projectile.pierce > 0) projectile.pierce -= 1;
        else {
          projectile.mesh.dispose();
          this.projectiles = this.projectiles.filter(item => item !== projectile);
        }
      }
    }
    for (const projectile of [...this.enemyProjectiles]) {
      projectile.life -= dt;
      projectile.mesh.position.addInPlace(projectile.direction.scale(projectile.speed * dt));
      if (projectile.life <= 0 || Math.abs(projectile.mesh.position.x) > 24 || Math.abs(projectile.mesh.position.z) > 24) {
        projectile.mesh.dispose();
        this.enemyProjectiles = this.enemyProjectiles.filter(item => item !== projectile);
        continue;
      }
      if (flatDistance(projectile.mesh.position, this.player.position.add(new Vector3(0, 0.9, 0))) < 0.7) {
        this.hurt(projectile.damage);
        projectile.mesh.dispose();
        this.enemyProjectiles = this.enemyProjectiles.filter(item => item !== projectile);
      }
    }
  }

  updatePickups(dt) {
    for (const pickup of [...this.pickups]) {
      pickup.life -= dt;
      pickup.mesh.rotation.y += dt * 1.4;
      pickup.mesh.position.y = 0.36 + Math.sin(this.state.progress.elapsed * 2.5 + pickup.mesh.position.x) * 0.11;
      const distance = flatDistance(pickup.mesh.position, this.player.position);
      if (distance < 1.25) this.collectPickup(pickup);
      else if (distance < 4.2) {
        const direction = flatDirection(pickup.mesh.position, this.player.position);
        pickup.mesh.position.addInPlace(direction.scale(dt * 1.1));
      }
      if (pickup.life <= 0 && this.pickups.includes(pickup)) {
        pickup.mesh.dispose();
        this.pickups = this.pickups.filter(item => item !== pickup);
      }
    }
  }

  updateParticles(dt) {
    for (const particle of [...this.particles]) {
      particle.life -= dt;
      particle.mesh.position.addInPlace(particle.velocity.scale(dt));
      particle.velocity.y -= 5.5 * dt;
      particle.mesh.scaling.scaleInPlace(Math.max(0.05, 1 - dt * 2.4));
      if (particle.life <= 0) {
        particle.mesh.dispose();
        this.particles = this.particles.filter(item => item !== particle);
      }
    }
  }

  updateWave(dt) {
    const progress = this.state.progress;
    const config = getWaveConfig(progress.wave);
    progress.sectorTime += dt;
    this.waveClock += dt;
    this.spawnTimer -= dt;
    const isBossWave = Boolean(config.boss);
    if (this.spawnTimer <= 0 && this.enemies.length < 14 && (!isBossWave || !this.bossSpawned)) {
      const type = config.enemyPool[Math.floor(Math.random() * config.enemyPool.length)];
      this.spawnEnemy(type);
      this.spawnTimer = config.spawnInterval;
    }
    if (isBossWave && progress.sectorTime >= 48 && !this.bossSpawned) {
      this.spawnEnemy(config.boss);
      this.spawnTimer = 999;
    }
    if (!isBossWave && progress.sectorTime >= config.duration) this.advanceWave();
  }

  finish(won, abandoned = false) {
    if (this.finished) return;
    this.finished = true;
    this.state.status = won ? 'victory' : 'defeat';
    this.started = false;
    this.paused = false;
    this.saveMeta(won);
    this.audio.play(won ? 'win' : 'defeat', won ? 1.1 : 0.9);
    this.ui.showResult({
      won,
      wave: this.state.progress.wave,
      kills: this.state.progress.kills,
      time: this.state.progress.elapsed,
      level: this.state.progress.level,
      combo: this.state.progress.bestCombo,
      damage: this.state.stats.damageDealt,
      build: this.state.build.upgrades.map(item => item.name)
    }, () => this.start());
    if (abandoned) this.ui.toast('远征已放弃');
  }

  updateHUD(force = false) {
    if (!force && this.state.progress.elapsed - this.lastHud < 0.09) return;
    this.lastHud = this.state.progress.elapsed;
    this.ui.update(this.state, this.rendererName);
  }

  update(dt) {
    if (!this.started || this.paused || this.state.status !== 'playing') {
      this.input.consumeFrame();
      return;
    }
    dt = Math.min(0.04, Math.max(0, dt));
    const progress = this.state.progress;
    progress.elapsed += dt;
    this.state.cooldowns.dash = Math.max(0, this.state.cooldowns.dash - dt);
    this.state.cooldowns.shot = Math.max(0, this.state.cooldowns.shot - dt);
    this.state.cooldowns.special = Math.max(0, this.state.cooldowns.special - dt);
    this.state.cooldowns.hurt = Math.max(0, this.state.cooldowns.hurt - dt);
    this.invulnerable = Math.max(0, (this.invulnerable ?? 0) - dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt);
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) progress.combo = 0;
    if (this.state.player.shield < this.state.player.maxShield && this.state.cooldowns.hurt <= 0) {
      const aegisMultiplier = hasSynergy(this.state, 'aegis') ? 2.2 : 1;
      this.state.player.shield = Math.min(this.state.player.maxShield, this.state.player.shield + this.state.player.shieldRegen * aegisMultiplier * dt * 10);
    }

    const movement = this.input.movement;
    const move = new Vector3(movement.x, 0, movement.z);
    if (move.lengthSquared() > 1) move.normalize();
    if (this.input.dashPressed) this.dash(movement);
    if (this.input.specialPressed) this.useSpecial();
    if (this.input.pausePressed) { this.pause(); this.input.consumeFrame(); return; }

    if (move.lengthSquared() > 0.001) {
      const destination = this.player.position.add(move.scale(this.state.player.moveSpeed * dt));
      this.resolvePlayerPosition(destination);
      this.player.position.copyFrom(destination);
      this.player.position.y = 0.025 + Math.sin(progress.elapsed * 10) * 0.035;
    } else {
      this.player.position.y = Math.sin(progress.elapsed * 2.2) * 0.018;
    }
    if (this.player.metadata?.core) this.player.metadata.core.scaling.setAll(1 + Math.sin(progress.elapsed * 4.5) * 0.08);
    const aim = this.getAimPoint();
    this.ui.setAim(this.input.pointer.x, this.input.pointer.y, this.input.pointer.inside);
    const aimDirection = flatDirection(this.player.position, aim);
    if (this.input.pointer.inside) this.player.rotation.y = Math.atan2(aimDirection.x, aimDirection.z);
    this.camera.setTarget(this.player.position.add(new Vector3(0, 0.2, 0)));
    this.fire();
    this.updateWave(dt);
    const playerPosition = this.player.position.clone();
    for (const enemy of [...this.enemies]) this.updateEnemy(enemy, dt, playerPosition);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateHUD();
    this.input.consumeFrame();
  }

  dispose() {
    this.input.dispose();
    this.audio.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
