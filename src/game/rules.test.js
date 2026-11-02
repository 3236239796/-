import { describe, expect, it } from 'vitest';
import {
  createRunState,
  applyDamage,
  grantExperience,
  applyUpgrade,
  getWaveConfig,
  getUpgradeChoices,
  hasSynergy,
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

  it('tracks tags and activates a three-stack set synergy', () => {
    let state = createRunState(8);
    for (let i = 0; i < 3; i += 1) {
      state = applyUpgrade(state, { id: 'echo-lattice', tags: ['echo'], effect: { damage: 0.08 } });
    }
    expect(state.build.tags.echo).toBe(3);
    expect(hasSynergy(state, 'echo')).toBe(true);
  });

  it('cannot complete the run before the final boss is defeated', () => {
    expect(canCompleteRun({ wave: 5, bossAlive: true })).toBe(false);
    expect(canCompleteRun({ wave: 5, bossAlive: false })).toBe(true);
    expect(canCompleteRun({ wave: 4, bossAlive: false })).toBe(false);
  });
});
