import React, { useState, useCallback } from 'react';
import { useAuth } from '../../services/authContext';
import { useLanguage } from '../../i18n/LanguageContext';
import './LoginModal.css';

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const { login, resetPassword } = useAuth();
  const { t } = useLanguage();

  const [mode, setMode] = useState<'login' | 'recovery'>('login');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recovery state
  const [recoveryUsername, setRecoveryUsername] = useState('admin');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSubmitting) return;

      if (!username.trim()) {
        setError(t('authUsernameRequired' as any) || 'Username is required');
        return;
      }
      if (!password) {
        setError(t('authPasswordRequired' as any) || 'Password is required');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const res = await login(username.trim(), password);
        if (res.success) {
          onClose();
          if (onSuccess) onSuccess();
        } else {
          setError(res.error || t('authInvalidCredentials' as any) || 'Invalid username or password');
        }
      } catch (err: any) {
        setError(err?.message || t('authServerUnreachable' as any) || 'Authentication error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, username, password, login, onClose, onSuccess, t]
  );

  const handleRecoverySubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSubmitting) return;

      if (!recoveryUsername.trim()) {
        setError(t('authUsernameRequired' as any) || 'Username is required');
        return;
      }
      if (!newPassword || newPassword.length < 4) {
        setError(t('authPasswordMinLength' as any) || 'Password must be at least 4 characters');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError(t('authPasswordMismatch' as any) || 'Passwords do not match');
        return;
      }

      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      try {
        const res = await resetPassword(recoveryUsername.trim(), newPassword, recoveryKey.trim());
        if (res.success) {
          setSuccessMessage(t('authResetSuccessMessage' as any) || 'Password reset successfully! You can now sign in.');
          setUsername(recoveryUsername.trim());
          setPassword(newPassword);
          setTimeout(() => {
            setMode('login');
          }, 1500);
        } else {
          setError(res.error || 'Failed to reset password. Please check the recovery key.');
        }
      } catch (err: any) {
        setError(err?.message || t('authServerUnreachable' as any) || 'Authentication error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, recoveryUsername, recoveryKey, newPassword, confirmPassword, resetPassword, t]
  );

  const handleQuickAdmin = useCallback(() => {
    if (isSubmitting) return;
    setUsername('admin');
    setPassword('Test2026');
    setError(null);
  }, [isSubmitting]);

  const handleOverlayClose = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="login-modal-overlay" onClick={handleOverlayClose} role="dialog" aria-modal="true" id="modal-login">
      <div className="login-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="login-modal-header">
          <div className="login-header-title-wrap">
            <span className="login-header-icon" aria-hidden="true">
              {mode === 'login' ? '🔐' : '🔑'}
            </span>
            <div>
              <h2>
                {mode === 'login'
                  ? t('authLoginTitle' as any) || 'Sign In'
                  : t('authRecoveryTitle' as any) || 'Password Recovery'}
              </h2>
              <p>
                {mode === 'login'
                  ? t('authLoginSubtitle' as any) || 'Access administrative & editing features'
                  : t('authRecoverySubtitle' as any) || 'Reset your account password'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="login-modal-close"
            onClick={handleOverlayClose}
            aria-label="Close"
            disabled={isSubmitting}
          >
            &times;
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleSubmit}>
            <div className="login-modal-body">
              {successMessage && (
                <div className="login-success-alert" role="status">
                  <span>✅</span>
                  <span>{successMessage}</span>
                </div>
              )}

              {error && (
                <div className="login-error-alert" role="alert">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="login-form-group">
                <label htmlFor="login-username">{t('authUsernameLabel' as any) || 'Username'}</label>
                <div className="login-input-wrap">
                  <input
                    id="login-username"
                    type="text"
                    className="login-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    autoFocus
                    autoComplete="username"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="login-form-group">
                <div className="login-label-row">
                  <label htmlFor="login-password">{t('authPasswordLabel' as any) || 'Password'}</label>
                  <button
                    type="button"
                    className="login-forgot-link"
                    onClick={() => {
                      setMode('recovery');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    id="btn-modal-forgot-password"
                  >
                    {t('authForgotPassword' as any) || 'Forgot password?'}
                  </button>
                </div>
                <div className="login-input-wrap">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="login-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                  />
                  <button
                    type="button"
                    className="login-pwd-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    disabled={isSubmitting}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {isSubmitting && (
                <div className="login-verifying-notice" role="status" aria-live="polite">
                  <span className="login-spinner" aria-hidden="true" />
                  <span>{t('authVerifyingPassword' as any) || 'Verifying credentials...'}</span>
                </div>
              )}
            </div>

            <div className="login-modal-footer">
              <button
                type="submit"
                className="btn-login-submit"
                disabled={isSubmitting}
                id="btn-submit-login"
              >
                {isSubmitting ? (
                  <span className="btn-login-content-submitting">
                    <span className="login-spinner-sm" aria-hidden="true" />
                    {t('authSigningIn' as any) || 'Signing in...'}
                  </span>
                ) : (
                  t('authSignInButton' as any) || 'Sign In'
                )}
              </button>

              <button
                type="button"
                className="btn-quick-admin"
                onClick={handleQuickAdmin}
                disabled={isSubmitting}
                title="Auto-fill default administrator credentials"
              >
                🔑 {t('authQuickAdminDemo' as any) || 'Fill Default Admin (admin / Test2026)'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRecoverySubmit}>
            <div className="login-modal-body">
              {successMessage && (
                <div className="login-success-alert" role="status">
                  <span>✅</span>
                  <span>{successMessage}</span>
                </div>
              )}

              {error && (
                <div className="login-error-alert" role="alert">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="login-form-group">
                <label htmlFor="recovery-username">{t('authUsernameLabel' as any) || 'Username'}</label>
                <div className="login-input-wrap">
                  <input
                    id="recovery-username"
                    type="text"
                    className="login-input"
                    value={recoveryUsername}
                    onChange={(e) => setRecoveryUsername(e.target.value)}
                    placeholder="admin"
                    autoFocus
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="login-form-group">
                <label htmlFor="recovery-key">
                  {t('authRecoveryKeyLabel' as any) || 'Recovery Key / Security Code'}
                </label>
                <div className="login-input-wrap">
                  <input
                    id="recovery-key"
                    type="text"
                    className="login-input"
                    value={recoveryKey}
                    onChange={(e) => setRecoveryKey(e.target.value)}
                    placeholder={t('authRecoveryKeyPlaceholder' as any) || 'Enter master key or code'}
                    disabled={isSubmitting}
                  />
                </div>
                <p className="login-hint-text">
                  {t('authRecoveryKeyHintAdmin' as any) || 'For admin: use server master key (default: Test2026)'}
                </p>
              </div>

              <div className="login-form-group">
                <label htmlFor="recovery-new-password">
                  {t('authNewPasswordLabel' as any) || 'New Password'}
                </label>
                <div className="login-input-wrap">
                  <input
                    id="recovery-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    className="login-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="login-pwd-toggle"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    title={showNewPassword ? 'Hide password' : 'Show password'}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    disabled={isSubmitting}
                  >
                    {showNewPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="login-form-group">
                <label htmlFor="recovery-confirm-password">
                  {t('authConfirmPasswordLabel' as any) || 'Confirm Password'}
                </label>
                <div className="login-input-wrap">
                  <input
                    id="recovery-confirm-password"
                    type="password"
                    className="login-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            <div className="login-modal-footer">
              <button
                type="submit"
                className="btn-login-submit"
                disabled={isSubmitting}
                id="btn-modal-submit-reset"
              >
                {isSubmitting ? (
                  <span className="btn-login-content-submitting">
                    <span className="login-spinner-sm" aria-hidden="true" />
                    {t('authSigningIn' as any) || 'Updating...'}
                  </span>
                ) : (
                  t('authResetPasswordButton' as any) || 'Reset Password'
                )}
              </button>

              <button
                type="button"
                className="btn-quick-admin"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMessage(null);
                }}
                disabled={isSubmitting}
                id="btn-modal-back-login"
              >
                {t('authBackToLogin' as any) || '← Back to Sign In'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
