import { test, expect } from '@playwright/test';

test.describe('Authentication and Navigation', () => {

  test('should redirect to /login if not authenticated', async ({ page }) => {
    // Clear localStorage to ensure not authenticated
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    
    // Go to protected route
    await page.goto('/');
    
    // Check if redirected to login
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.locator('h1')).toContainText('Media Cataloger');
  });

  test('should login and navigate successfully', async ({ page }) => {
    // Mock the API response for login
    await page.route('/api/auth/login', async route => {
      const json = { token: 'fake-jwt-token', user: { id: 1, username: 'admin', role: 'admin' } };
      await route.fulfill({ json });
    });
    
    // Also mock user profile fetch if there is one
    await page.route('/api/auth/me', async route => {
      const json = { authenticated: true, user: { id: 1, username: 'admin', role: 'admin' } };
      await route.fulfill({ json });
    });
    
    // Mock other APIs
    await page.route('/api/feature-flags', async route => {
      await route.fulfill({ json: {} });
    });
    await page.route('/api/media/files*', async route => {
      await route.fulfill({ json: { items: [], total: 0 } });
    });

    await page.goto('/login');
    
    // Fill the login form
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');

    // Should redirect to gallery '/'
    await expect(page).toHaveURL('http://localhost:5173/');

    // Check if sidebar has admin panel link since we mocked isAdmin
    // Use .first() in case of mobile menu duplicates
    await page.screenshot({ path: 'screenshot.png' });
    await expect(page.getByText('Админ панель').first()).toBeVisible({ timeout: 10000 });
    
    // Navigate to Admin panel
    await page.getByText('Админ панель').first().click();
    await expect(page).toHaveURL(/.*\/admin/);
    
    // Check if Gallery page works
    await page.click('text=Галерея');
    await expect(page).toHaveURL('http://localhost:5173/');
  });

});
