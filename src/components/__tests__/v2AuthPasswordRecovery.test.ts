import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

describe('V2 Authentication: Admin Password Reset & Password Recovery (BUG-005)', () => {
  const root = path.resolve(import.meta.dirname, '../../..');

  it('1. LoginPage: must render "Забыли пароль?" and support password recovery mode', () => {
    const loginPagePath = path.join(root, 'src', 'components', 'auth', 'LoginPage.tsx');
    assert.ok(fs.existsSync(loginPagePath), 'LoginPage.tsx must exist');
    const content = fs.readFileSync(loginPagePath, 'utf-8');

    // Must have "Забыли пароль?" button/trigger
    assert.ok(
      content.includes('Забыли пароль?') || content.includes('authForgotPassword'),
      'LoginPage must render "Забыли пароль?" link or button'
    );

    // Must support recovery mode with inputs for username, recovery key, and new password
    assert.ok(content.includes('Восстановление пароля'), 'LoginPage must support recovery title');
    assert.ok(content.includes('recoveryKey'), 'LoginPage must provide recoveryKey state/field');
    assert.ok(content.includes('newPassword'), 'LoginPage must provide newPassword state/field');
    assert.ok(content.includes('confirmPassword'), 'LoginPage must provide confirmPassword state/field');
    assert.ok(content.includes('Test2026'), 'LoginPage must mention Test2026 for admin recovery');
    assert.ok(content.includes('resetPassword'), 'LoginPage must invoke resetPassword from useAuth');
  });

  it('2. LoginModal: must render "Забыли пароль?" and switch between login and recovery views', () => {
    const modalPath = path.join(root, 'src', 'components', 'modals', 'LoginModal.tsx');
    assert.ok(fs.existsSync(modalPath), 'LoginModal.tsx must exist');
    const content = fs.readFileSync(modalPath, 'utf-8');

    assert.ok(
      content.includes('authForgotPassword') || content.includes('Забыли пароль?'),
      'LoginModal must include forgot password link'
    );
    assert.ok(content.includes('recovery'), 'LoginModal must support recovery mode');
    assert.ok(content.includes('recoveryKey'), 'LoginModal must handle recoveryKey input');
    assert.ok(content.includes('resetPassword'), 'LoginModal must invoke resetPassword');
    assert.ok(content.includes('Test2026'), 'LoginModal must quick-fill admin credentials with Test2026');
  });

  it('3. AuthContext: must expose forgotPassword and resetPassword methods', () => {
    const contextPath = path.join(root, 'src', 'services', 'authContext.tsx');
    assert.ok(fs.existsSync(contextPath), 'authContext.tsx must exist');
    const content = fs.readFileSync(contextPath, 'utf-8');

    assert.ok(content.includes('forgotPassword:'), 'AuthContext must declare forgotPassword');
    assert.ok(content.includes('resetPassword:'), 'AuthContext must declare resetPassword');
    assert.ok(content.includes('/api/auth/forgot-password'), 'AuthContext must call /api/auth/forgot-password');
    assert.ok(content.includes('/api/auth/reset-password'), 'AuthContext must call /api/auth/reset-password');
  });

  it('4. Translations: must have English and Russian strings for password recovery', () => {
    const i18nPath = path.join(root, 'src', 'models', 'i18n.ts');
    const transPath = path.join(root, 'src', 'i18n', 'translations.ts');
    const i18nContent = fs.readFileSync(i18nPath, 'utf-8');
    const transContent = fs.readFileSync(transPath, 'utf-8');

    assert.ok(i18nContent.includes('authForgotPassword: string;'), 'i18n interface must include authForgotPassword');
    assert.ok(i18nContent.includes('authRecoveryTitle: string;'), 'i18n interface must include authRecoveryTitle');
    assert.ok(i18nContent.includes('authRecoveryKeyLabel: string;'), 'i18n interface must include authRecoveryKeyLabel');

    assert.ok(transContent.includes('authForgotPassword: \'Forgot password?\''), 'English translations must include authForgotPassword');
    assert.ok(transContent.includes('authForgotPassword: \'Забыли пароль?\''), 'Russian translations must include authForgotPassword');
    assert.ok(transContent.includes('authRecoveryTitle: \'Восстановление пароля\''), 'Russian translations must include authRecoveryTitle');
  });

  it('5. AppRouter: must support /forgot-password route', () => {
    const routerPath = path.join(root, 'src', 'AppRouter.tsx');
    assert.ok(fs.existsSync(routerPath), 'AppRouter.tsx must exist');
    const content = fs.readFileSync(routerPath, 'utf-8');

    assert.ok(content.includes('/forgot-password'), 'AppRouter must have /forgot-password route');
  });

  it('6. UserSettingsScreen: must provide working password change form calling /api/auth/change-password', () => {
    const settingsPath = path.join(root, 'src', 'components', 'v2', 'UserSettingsScreen.tsx');
    assert.ok(fs.existsSync(settingsPath), 'UserSettingsScreen.tsx must exist');
    const content = fs.readFileSync(settingsPath, 'utf-8');

    assert.ok(content.includes('/api/auth/change-password'), 'UserSettingsScreen must call /api/auth/change-password');
    assert.ok(content.includes('currentPasswordInput'), 'UserSettingsScreen must manage currentPasswordInput');
    assert.ok(content.includes('newPasswordInput'), 'UserSettingsScreen must manage newPasswordInput');
    assert.ok(content.includes('confirmPasswordInput'), 'UserSettingsScreen must manage confirmPasswordInput');
    assert.ok(content.includes('btn-submit-change-password'), 'UserSettingsScreen must render submit change password button');
  });
});
