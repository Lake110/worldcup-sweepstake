import { test, expect } from '@playwright/test'

test.describe('Login flow', () => {
  test('shows login page when not authenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Sign in to your sweepstake')).toBeVisible()
  })

  test('shows error with wrong credentials', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('you@example.com').fill('wrong@test.com')
    await page.getByPlaceholder('••••••••').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Invalid email or password')).toBeVisible()
  })

  test('logs in successfully with valid credentials', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('you@example.com').fill('admin@worldcup-sweepstake.com')
    await page.getByPlaceholder('••••••••').fill('admin1234')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('FIFA World Cup 2026')).toBeVisible()
  })

  test('logs out successfully', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('you@example.com').fill('admin@worldcup-sweepstake.com')
    await page.getByPlaceholder('••••••••').fill('admin1234')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('FIFA World Cup 2026')).toBeVisible()
    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page.getByText('Sign in to your sweepstake')).toBeVisible()
  })
})
