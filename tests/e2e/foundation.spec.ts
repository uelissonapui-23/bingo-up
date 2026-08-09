import { test, expect } from '@playwright/test'
test('tela de login oferece criação e recuperação', async ({ page }) => { await page.goto('/entrar'); await expect(page.getByRole('heading', { name: 'Bingo PWA' })).toBeVisible(); await expect(page.getByRole('link', { name: 'Criar conta' })).toBeVisible(); await expect(page.getByRole('link', { name: 'Esqueci a senha' })).toBeVisible() })
