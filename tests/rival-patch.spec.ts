import { expect, test, type Page } from '@playwright/test'

async function startFight(page: Page): Promise<void> {
  await page.goto('/?renderer=canvas')
  await page.waitForFunction(() => Boolean((window as any).__fightingGame))

  await expect
    .poll(
      async () => {
        const mode = await page.evaluate(
          () => (window as any).__fightingGame.scene.keys.FightScene.mode,
        )
        if (mode === 'select') {
          await page.keyboard.press('Enter')
        }
        return mode
      },
      { timeout: 25_000, intervals: [200, 500] },
    )
    .not.toBe('select')

  await page.waitForFunction(() => {
    const scene = (window as any).__fightingGame.scene.keys.FightScene
    return scene && scene.mode === 'fight'
  }, undefined, { timeout: 35_000 })
}

test('habit patch fires once after corner camping', async ({ page }) => {
  await startFight(page)

  for (let i = 0; i < 140; i += 1) {
    await page.keyboard.down('a')
    await page.waitForTimeout(40)
    await page.keyboard.up('a')
    await page.waitForTimeout(20)
  }

  await page.waitForFunction(
    () => (window as any).__rivalPatch?.getState()?.patchCount >= 1,
    undefined,
    { timeout: 35_000 },
  )

  const state = await page.evaluate(() => (window as any).__rivalPatch.getState())
  expect(state.patchCount).toBeGreaterThanOrEqual(1)
  expect(state.appliedReasonCodes.length).toBeGreaterThanOrEqual(1)
})

test('complaint form returns a denied buff patch via backend', async ({ page, request }) => {
  const health = await request.get('http://localhost:8787/health')
  test.skip(!health.ok(), 'Rival Patch backend not running on :8787')

  await startFight(page)

  await page.locator('#rival-patch-panel').click()
  await page.fill('#rp-complaint-input', 'Stop, this is too hard!')
  await page.click('#rival-patch-panel button[type="submit"]')

  await page.waitForFunction(
    () => (window as any).__rivalPatch?.getState()?.complaintCount >= 1,
    undefined,
    { timeout: 20_000 },
  )

  const state = await page.evaluate(() => (window as any).__rivalPatch.getState())
  expect(state.complaintCount).toBe(1)
  expect(state.tuning.aggression).toBeGreaterThan(0.4)
})