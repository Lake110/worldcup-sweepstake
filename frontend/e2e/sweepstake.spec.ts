import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('you@example.com').fill('admin@worldcup-sweepstake.com')
  await page.getByPlaceholder('••••••••').fill('admin1234')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('FIFA World Cup 2026')).toBeVisible()
})

test.describe('Quick draw flow', () => {
  test('navigates to the sweepstake page', async ({ page }) => {
    await page.getByRole('link', { name: /sweepstake/i }).click()
    await expect(page).toHaveURL(/sweepstake/)
  })

  test('switches to quick draw mode', async ({ page }) => {
    await page.getByRole('link', { name: /sweepstake/i }).click()
    await page.getByRole('button', { name: /quick draw/i }).click()
    await expect(page.getByText(/new quick draw/i)).toBeVisible()
  })

  test('creates a quick draw with two participants and runs the draw', async ({ page }) => {
    await page.getByRole('link', { name: /sweepstake/i }).click()
    await page.getByRole('button', { name: /quick draw/i }).click()
    await page.getByRole('button', { name: /new quick draw/i }).click()

    await page.getByPlaceholder('e.g. Office World Cup 2026').fill('Playwright Test Draw')

    await page.getByPlaceholder('Enter a name...').fill('Alice')
    await page.getByRole('button', { name: '+ Add' }).click()

    await page.getByPlaceholder('Enter a name...').fill('Bob')
    await page.getByRole('button', { name: '+ Add' }).click()

    await expect(page.getByText('Alice')).toBeVisible()
    await expect(page.getByText('Bob')).toBeVisible()

    await page.getByRole('button', { name: /run draw for 2 people/i }).click()

    await expect(page.getByText('Alice')).toBeVisible()
    await expect(page.getByText('Bob')).toBeVisible()
  })

  test('shows leaderboard tab after draw', async ({ page }) => {
    await page.getByRole('link', { name: /sweepstake/i }).click()
    await page.getByRole('button', { name: /quick draw/i }).click()
    await page.getByRole('button', { name: /new quick draw/i }).click()

    await page.getByPlaceholder('e.g. Office World Cup 2026').fill('Leaderboard Test')
    await page.getByPlaceholder('Enter a name...').fill('Charlie')
    await page.getByRole('button', { name: '+ Add' }).click()
    await page.getByPlaceholder('Enter a name...').fill('Diana')
    await page.getByRole('button', { name: '+ Add' }).click()

    await page.getByRole('button', { name: /run draw for 2 people/i }).click()

    await expect(page.getByRole('button', { name: /leaderboard/i })).toBeVisible()
  })
})
