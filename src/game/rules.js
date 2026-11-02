export const UPGRADE_POOL = [
  { id: 'echo-lattice', name: '回声晶格', description: '连续命中会叠加回响，第三次命中触发额外脉冲。', rarity: 'rare', tags: ['echo'], maxStacks: 5, effect: { damage: 0.08 } },
  { id: 'prism-split', name: '棱镜分裂', description: '主武器额外发射一枚偏转弹体。', rarity: 'rare', tags: ['prism'], maxStacks: 3, effect: { projectiles: 1 } },
  { id: 'phase-shear', name: '相位切割', description: '冲刺结束时留下能量切线，对路径敌人造成伤害。', rarity: 'rare', tags: ['phase'], maxStacks: 3, effect: { dashDamage: 18 } },
  { id: 'aegis-weave', name: '神盾编织', description: '最大护盾提高 18，护盾恢复速度提高。', rarity: 'uncommon', tags: ['aegis'], maxStacks: 4, effect: { maxShield: 18, shieldRegen: 0.35 } },
  { id: 'overclock', name: '超频线圈', description: '射击间隔缩短 12%。', rarity: 'common', tags: ['prism'], maxStacks: 5, effect: { fireRate: 0.88 } },
  { id: 'singularity', name: '微型奇点', description: '暴击率提高 7%，暴击伤害提高 20%。', rarity: 'uncommon', tags: ['echo'], maxStacks: 4, effect: { critChance: 0.07, critDamage: 0.2 } },
  { id: 'afterimage', name: '残像协议', description: '冲刺冷却缩短 16%，冲刺距离增加。', rarity: 'common', tags: ['phase'], maxStacks: 4, effect: { dashCooldown: 0.84, dashDistance: 0.8 } },
  { id: 'vital-core', name: '活性核心', description: '最大生命提高 22，并立即恢复 22 点生命。', rarity: 'common', tags: ['aegis'], maxStacks: 4, effect: { maxHp: 22, heal: 22 } },
  { id: 'rail-accelerator', name: '磁轨加速器', description: '弹体速度提高 22%，伤害提高 5%。', rarity: 'uncommon', tags: ['prism'], maxStacks: 4, effect: { projectileSpeed: 1.22, damage: 0.05 } },
  { id: 'chain-lightning', name: '链式电弧', description: '击杀时电弧跳向附近敌人。', rarity: 'rare', tags: ['echo'], maxStacks: 3, effect: { chain: 1 } },
  { id: 'rift-reservoir', name: '裂隙蓄能', description: '特殊技能充能效率提高 20%。', rarity: 'uncommon', tags: ['phase'], maxStacks: 4, effect: { specialGain: 1.2 } },
  { id: 'last-stand', name: '最后防线', description: '生命低于 35% 时获得 18% 减伤。', rarity: 'rare', tags: ['aegis'], maxStacks: 2, effect: { lastStand: 0.18 } },
  { id: 'predator-mark', name: '猎杀标记', description: '对满血敌人的首发伤害提高 25%。', rarity: 'uncommon', tags: ['prism'], maxStacks: 3, effect: { opener: 0.25 } },
  { id: 'void-harvest', name: '虚空收割', description: '拾取回响时恢复 2 点生命。', rarity: 'common', tags: ['aegis'], maxStacks: 5, effect: { pickupHeal: 2 } }
];

export function createRunState(seed = Date.now()) {
  return {
    seed,
    status: 'playing',
    player: {
      hp: 120, maxHp: 120, shield: 35, maxShield: 35,
      damage: 22, fireRate: 0.22, projectileSpeed: 18, projectiles: 1,
      critChance: 0.08, critDamage: 1.75, moveSpeed: 7.2,
      dashCooldown: 2.4, dashDistance: 5.2, dashDamage: 0,
      shieldRegen: 0.12, specialCharge: 35, specialGain: 1,
      chain: 0, lastStand: 0, opener: 0, pickupHeal: 0
    },
    progress: {
      wave: 1, level: 1, xp: 0, xpToNext: 14, kills: 0,
      elapsed: 0, sectorTime: 0, bossDefeated: false, combo: 0,
      bestCombo: 0
    },
    build: { upgrades: [], tags: { echo: 0, prism: 0, phase: 0, aegis: 0 }, synergy: [] },
    stats: { damageDealt: 0, damageTaken: 0, shotsFired: 0, dodges: 0, eliteKills: 0 }
  };
}

export function applyDamage(state, amount) {
  if (state.status !== 'playing' || amount <= 0) return state;
  const next = structuredClone(state);
  const absorbed = Math.min(next.player.shield, amount);
  next.player.shield = Math.max(0, next.player.shield - absorbed);
  const remaining = amount - absorbed;
  const reduction = next.progress && next.player.hp / next.player.maxHp < 0.35 ? next.player.lastStand : 0;
  const dealt = remaining * (1 - reduction);
  next.player.hp = Math.max(0, next.player.hp - dealt);
  next.stats.damageTaken += amount - Math.max(0, amount - absorbed - dealt);
  if (next.player.hp <= 0) next.status = 'defeat';
  return next;
}

export function grantExperience(state, amount) {
  const next = structuredClone(state);
  next.progress.xp += Math.max(0, amount);
  let levelUps = 0;
  while (next.progress.xp >= next.progress.xpToNext) {
    next.progress.xp -= next.progress.xpToNext;
    next.progress.level += 1;
    levelUps += 1;
    next.progress.xpToNext = Math.ceil(next.progress.xpToNext * 1.24 + 4);
  }
  return { state: next, levelUps };
}

export function getWaveConfig(wave) {
  const n = Math.max(1, Math.floor(wave));
  const boss = n === 3 ? 'herald' : n >= 5 ? 'choir' : null;
  const pool = ['ravager'];
  if (n >= 2) pool.push('stalker');
  if (n >= 3) pool.push('arbalist');
  if (n >= 4) pool.push('bulwark');
  return {
    wave: n,
    duration: n >= 5 ? 75 : 60,
    spawnInterval: Math.max(0.58, 2.25 - n * 0.18),
    enemyPool: pool,
    boss,
    enemyHealthScale: 1 + (n - 1) * 0.22,
    enemyDamageScale: 1 + (n - 1) * 0.12
  };
}

export function getEnemyConfig(type, wave = 1) {
  const configs = {
    ravager: { hp: 58, speed: 2.6, damage: 12, radius: 0.72, xp: 3, range: 1.55, windup: 0.52, color: '#b65343' },
    stalker: { hp: 38, speed: 4.1, damage: 10, radius: 0.56, xp: 4, range: 1.2, windup: 0.32, color: '#b97849' },
    arbalist: { hp: 46, speed: 2.1, damage: 9, radius: 0.62, xp: 4, range: 7.2, windup: 0.8, color: '#b64d63' },
    bulwark: { hp: 155, speed: 1.35, damage: 20, radius: 1.05, xp: 8, range: 2.1, windup: 0.95, color: '#8d4c45' },
    herald: { hp: 950, speed: 2.4, damage: 20, radius: 1.55, xp: 45, range: 3.5, windup: 1.1, color: '#d66b42', boss: true },
    choir: { hp: 2600, speed: 2.8, damage: 25, radius: 2.2, xp: 120, range: 5.5, windup: 1.25, color: '#df684d', boss: true }
  };
  const base = configs[type] ?? configs.ravager;
  const scale = base.boss ? 1 + Math.max(0, wave - (type === 'choir' ? 5 : 3)) * 0.12 : 1 + (wave - 1) * 0.22;
  return { ...base, hp: Math.round(base.hp * scale), damage: Math.round(base.damage * (1 + (wave - 1) * 0.12)) };
}

function seededRandom(seed) {
  let t = (seed >>> 0) || 1;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function getUpgradeChoices(state, seed = Date.now()) {
  const available = UPGRADE_POOL.filter(item => (state.build.upgrades.filter(entry => entry.id === item.id).length) < item.maxStacks);
  const random = seededRandom(seed);
  const pool = [...available];
  const choices = [];
  while (choices.length < 3 && pool.length) {
    const index = Math.floor(random() * pool.length);
    choices.push(pool.splice(index, 1)[0]);
  }
  return choices;
}

export function applyUpgrade(state, upgrade) {
  const next = structuredClone(state);
  next.build.upgrades.push({ id: upgrade.id, name: upgrade.name ?? upgrade.id, tags: [...(upgrade.tags ?? [])] });
  for (const tag of upgrade.tags ?? []) {
    next.build.tags[tag] = (next.build.tags[tag] ?? 0) + 1;
    if (next.build.tags[tag] >= 3 && !next.build.synergy.includes(tag)) next.build.synergy.push(tag);
  }
  const effect = upgrade.effect ?? {};
  for (const key of ['damage', 'critChance', 'critDamage', 'shieldRegen', 'dashDamage', 'specialGain', 'chain', 'lastStand', 'opener', 'pickupHeal']) {
    if (effect[key] !== undefined) next.player[key] = (next.player[key] ?? 0) + effect[key];
  }
  for (const key of ['fireRate', 'dashCooldown']) {
    if (effect[key] !== undefined) next.player[key] *= effect[key];
  }
  for (const key of ['projectileSpeed', 'projectiles', 'dashDistance']) {
    if (effect[key] !== undefined) next.player[key] = (next.player[key] ?? 0) + effect[key];
  }
  if (effect.maxHp) { next.player.maxHp += effect.maxHp; next.player.hp = Math.min(next.player.maxHp, next.player.hp + (effect.heal ?? effect.maxHp)); }
  if (effect.maxShield) { next.player.maxShield += effect.maxShield; next.player.shield = Math.min(next.player.maxShield, next.player.shield + effect.maxShield); }
  return next;
}

export function hasSynergy(state, tag) {
  return (state.build.tags[tag] ?? 0) >= 3;
}

export function canCompleteRun({ wave, bossAlive }) {
  return wave >= 5 && bossAlive === false;
}
