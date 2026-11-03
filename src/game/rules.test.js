import { describe, expect, it } from 'vitest';
import {
  createRunState,
  applyDamage,
  grantExperience,
  applyUpgrade,
  getWaveConfig,
  getUpgradeChoices,
  hasSynergy,
  getProjectileDamage,
  advanceEchoCombo,
  distancePointToSegment2D,
  selectChainTargets,
  canCompleteRun
} from './rules.js';

describe('run progression rules', () => {
  it('creates a fresh run with stable starting resources', () => {
    const state = createRunState(42);
    expect(state.player.hp).toBe(120);
    expect(state.player.shield).toBe(35);
    expect(state.progress.wave).toBe(1);
    expect(state.progress.kills).toBe(0);
  });

  it('absorbs damage with shield before health and clamps at zero', () => {
    const state = createRunState(1);
    const hit = applyDamage(state, 50);
    expect(hit.player.shield).toBe(0);
    expect(hit.player.hp).toBe(105);
    const lethal = applyDamage(hit, 500);
    expect(lethal.player.hp).toBe(0);
    expect(lethal.status).toBe('defeat');
  });

  it('converts overflow experience into multiple levels', () => {
    const state = createRunState(2);
    const result = grantExperience(state, 40);
    expect(result.levelUps).toBeGreaterThan(1);
    expect(result.state.progress.level).toBe(result.levelUps + 1);
    expect(result.state.progress.xp).toBeLessThan(result.state.progress.xpToNext);
  });

  it('opens elite encounters at wave three and the final boss at wave five', () => {
    expect(getWaveConfig(3).boss).toBe('herald');
    expect(getWaveConfig(5).boss).toBe('choir');
    expect(getWaveConfig(2).boss).toBeNull();
  });

  it('offers three unique compatible upgrade choices', () => {
    const state = createRunState(7);
    const choices = getUpgradeChoices(state, 1234);
    expect(choices).toHaveLength(3);
    expect(new Set(choices.map(item => item.id)).size).toBe(3);
  });

  it('applies percentage damage upgrades multiplicatively', () => {
    const state = createRunState(9);
    const upgraded = applyUpgrade(state, { id: 'damage-test', tags: ['prism'], effect: { damage: 0.25 } });
    expect(upgraded.player.damage).toBeCloseTo(state.player.damage * 1.25);
  });

  it('tracks tags and activates a three-stack set synergy', () => {
    let state = createRunState(8);
    for (let i = 0; i < 3; i += 1) {
      state = applyUpgrade(state, { id: 'echo-lattice', tags: ['echo'], effect: { damage: 0.08 } });
    }
    expect(state.build.tags.echo).toBe(3);
    expect(hasSynergy(state, 'echo')).toBe(true);
  });


  it('applies Predator Mark only to enemies that still have full health', () => {
    let state = createRunState(11);
    state = applyUpgrade(state, { id: 'predator-mark', tags: ['prism'], effect: { opener: 0.25 } });
    const fullHealth = { hp: 100, maxHp: 100 };
    const damaged = { hp: 99, maxHp: 100 };
    expect(getProjectileDamage(state, fullHealth, 40)).toBeCloseTo(50);
    expect(getProjectileDamage(state, damaged, 40)).toBeCloseTo(40);
    expect(getProjectileDamage(state, fullHealth, 40, true)).toBeCloseTo(87.5);
  });

  it('applies Chain Lightning stacks as additional jumps', () => {
    let state = createRunState(12);
    state = applyUpgrade(state, { id: 'chain-lightning', tags: ['echo'], effect: { chain: 1 } });
    state = applyUpgrade(state, { id: 'chain-lightning', tags: ['echo'], effect: { chain: 1 } });
    expect(state.player.chain).toBe(2);
  });

  it('triggers Echo Lattice on every third consecutive hit and resets after the window', () => {
    let combo = advanceEchoCombo(0, 9);
    expect(combo).toEqual({ hitCount: 1, triggered: false });
    combo = advanceEchoCombo(combo.hitCount, 0.2);
    expect(combo).toEqual({ hitCount: 2, triggered: false });
    combo = advanceEchoCombo(combo.hitCount, 0.4);
    expect(combo).toEqual({ hitCount: 0, triggered: true });
    expect(advanceEchoCombo(2, 1.5)).toEqual({ hitCount: 1, triggered: false });
  });

  it('measures distance to the full dash segment, not only its endpoint', () => {
    const start = { x: 0, z: 0 };
    const end = { x: 10, z: 0 };
    expect(distancePointToSegment2D({ x: 5, z: 0.8 }, start, end)).toBeCloseTo(0.8);
    expect(distancePointToSegment2D({ x: 12, z: 0 }, start, end)).toBeCloseTo(2);
    expect(distancePointToSegment2D({ x: 4, z: 3 }, start, start)).toBeCloseTo(5);
  });

  it('chains lightning to the nearest enemies in hop order and respects jump range', () => {
    const candidates = [
      { id: 'far', x: 8, z: 0 },
      { id: 'first', x: 2, z: 0 },
      { id: 'second', x: 4, z: 0 },
      { id: 'out-of-range', x: 20, z: 0 }
    ];
    expect(selectChainTargets({ x: 0, z: 0 }, candidates, 3, 3).map(item => item.id)).toEqual(['first', 'second']);
  });

  it('cannot complete the run before the final boss is defeated', () => {
    expect(canCompleteRun({ wave: 5, bossAlive: true })).toBe(false);
    expect(canCompleteRun({ wave: 5, bossAlive: false })).toBe(true);
    expect(canCompleteRun({ wave: 4, bossAlive: false })).toBe(false);
  });
});
