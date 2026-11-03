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
  const box = await page.locator('#renderCanvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.up();
  const shots = await page.evaluate(() => window.__NULL_ASCENT__.game.state.stats.shotsFired);
  expect(shots).toBeGreaterThan(0);
  await page.keyboard.press('Shift');
  const dodges = await page.evaluate(() => window.__NULL_ASCENT__.game.state.stats.dodges);
  expect(dodges).toBe(1);
  await expect(page.locator('#renderer-status')).toContainText(/WEBGPU|WEBGL2/i);
  expect(errors).toEqual([]);
});

test('build-time CC0 soundtrack assets are served locally', async ({ page }) => {
  await page.goto('/');
  for (const track of ['sector', 'airy', 'urgent', 'pulse', 'transmission', 'victory']) {
    const response = await page.request.get(`/audio/${track}.mp3`);
    expect(response.ok(), `${track}.mp3 should be available`).toBeTruthy();
    expect(Number(response.headers()['content-length'] ?? 0)).toBeGreaterThan(20_000);
  }
});

test('pause and resume controls are accessible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /开始远征|START EXPEDITION/i }).click();
  await page.getByRole('button', { name: /暂停|PAUSE/i }).click();
  await expect(page.getByRole('dialog', { name: /暂停|PAUSED/i })).toBeVisible();
  await page.getByRole('button', { name: /继续|RESUME/i }).click();
  await expect(page.getByRole('dialog', { name: /暂停|PAUSED/i })).toBeHidden();
});

test('lethal damage opens the defeat summary and allows a fresh run', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /开始远征|START EXPEDITION/i }).click();
  await page.evaluate(() => window.__NULL_ASCENT__.game.hurt(9999));
  await expect(page.getByRole('dialog', { name: /远征结算/i })).toBeVisible();
  await page.getByRole('button', { name: /再次远征/i }).click();
  await expect(page.locator('[data-testid="game-hud"]')).toBeVisible();
  await expect(page.getByRole('dialog', { name: /远征结算/i })).toBeHidden();
});
