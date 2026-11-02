import { test, expect } from '@playwright/test';

test('boots the game shell and exposes the playable start flow', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('NULL', { exact: false }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /开始远征|START EXPEDITION/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /开始远征|START EXPEDITION/i }).click();
  await expect(page.locator('[data-testid="game-hud"]')).toBeVisible();
  await expect(page.locator('[data-testid="run-state"]')).toContainText(/战区|SECTOR/i);
  const before = await page.evaluate(() => window.__NULL_ASCENT__.game.player.position.z);
  await page.keyboard.down('w');
  await page.waitForTimeout(450);
  await page.keyboard.up('w');
  const after = await page.evaluate(() => window.__NULL_ASCENT__.game.player.position.z);
  expect(after).toBeLessThan(before);
  await expect(page.locator('#renderer-status')).toContainText(/WEBGPU|WEBGL2/i);
  expect(errors).toEqual([]);
});

test('pause and resume controls are accessible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /开始远征|START EXPEDITION/i }).click();
  await page.getByRole('button', { name: /暂停|PAUSE/i }).click();
  await expect(page.getByRole('dialog', { name: /暂停|PAUSED/i })).toBeVisible();
  await page.getByRole('button', { name: /继续|RESUME/i }).click();
  await expect(page.getByRole('dialog', { name: /暂停|PAUSED/i })).toBeHidden();
});
