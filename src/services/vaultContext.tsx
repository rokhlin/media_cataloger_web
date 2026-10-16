import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { VaultStatus } from '../models/auth';
import { useAuth } from './authContext';

interface VaultContextValue {
  vaultStatus: VaultStatus | null;
  vaultToken: string | null;
  isUnlocked: boolean;
  isConfigured: boolean;
  isLoading: boolean;
  unlockedUntil: number | null;
  remainingSeconds: number;
  vaultMediaFiles: any[];
  loadingVaultFiles: boolean;
  fetchVaultStatus: () => Promise<VaultStatus | null>;
  setupVault: (pin: string, vaultFolder?: string, autoLockMinutes?: number, recoveryEmail?: string) => Promise<{ success: boolean; error?: string }>;
  unlockVault: (pin: string) => Promise<{ success: boolean; error?: string }>;
  lockVault: () => Promise<void>;
  changePin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  requestPinRecovery: (email: string) => Promise<{ success: boolean; message: string; codeHint?: string; error?: string }>;
  resetPinWithRecovery: (email: string, recoveryCode: string, newPin: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  fetchVaultMediaItems: () => Promise<any[]>;
  addVaultItem: (filePath: string, notes?: string) => Promise<boolean>;
  removeVaultItem: (filePath: string) => Promise<boolean>;
  vaultFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

const VAULT_SESSION_KEY = 'media_cataloger_vault_session';

const VaultContext = createContext<VaultContextValue | null>(null);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authFetch } = useAuth();
  const [vaultToken, setVaultToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(VAULT_SESSION_KEY);
    } catch {
      return null;
    }
  });

  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [vaultMediaFiles, setVaultMediaFiles] = useState<any[]>([]);
  const [loadingVaultFiles, setLoadingVaultFiles] = useState<boolean>(false);
  const timerRef = useRef<any>(null);

  // Vault authenticated fetch
  const vaultFetch = useCallback(
    async (url: string, init: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(init.headers || {});
      if (vaultToken) {
        headers.set('x-vault-token', vaultToken);
      }
      return authFetch(url, {
        ...init,
        headers,
      });
    },
    [authFetch, vaultToken]
  );

  const fetchVaultStatus = useCallback(async (): Promise<VaultStatus | null> => {
    try {
      const headers: Record<string, string> = {};
      if (vaultToken) {
        headers['x-vault-token'] = vaultToken;
      }
      const res = await authFetch('/api/vault/status', { headers });
      if (res.ok) {
        const status: VaultStatus = await res.json();
        setVaultStatus(status);
        if (!status.isUnlocked && vaultToken) {
          // Token expired on server
          setVaultToken(null);
          try {
            sessionStorage.removeItem(VAULT_SESSION_KEY);
          } catch {}
        }
        return status;
      }
    } catch (err) {
      console.warn('Failed to fetch vault status:', err);
    } finally {
      setIsLoading(false);
    }
    return null;
  }, [authFetch, vaultToken]);

  const fetchVaultMediaItems = useCallback(async (): Promise<any[]> => {
    if (!vaultToken) return [];
    setLoadingVaultFiles(true);
    try {
      const res = await vaultFetch('/api/vault/media-items');
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data?.items || []);
        setVaultMediaFiles(items);
        return items;
      } else {
        // Fallback to /api/media/files?vault=true
        const altRes = await vaultFetch('/api/media/files?vault=true');
        if (altRes.ok) {
          const data = await altRes.json();
          const items = Array.isArray(data) ? data : (data?.items || []);
          setVaultMediaFiles(items);
          return items;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch vault media files:', err);
    } finally {
      setLoadingVaultFiles(false);
    }
    return [];
  }, [vaultFetch, vaultToken]);

  useEffect(() => {
    fetchVaultStatus();
  }, [fetchVaultStatus]);

  // When vault is unlocked, automatically fetch items
  useEffect(() => {
    if (vaultStatus?.isUnlocked && vaultToken) {
      fetchVaultMediaItems();
    } else {
      setVaultMediaFiles([]);
    }
  }, [vaultStatus?.isUnlocked, vaultToken, fetchVaultMediaItems]);

  // Handle countdown timer for auto-lock
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (vaultStatus?.isUnlocked && vaultStatus.unlockedUntil) {
      const updateCountdown = () => {
        const now = Date.now();
        const diffMs = (vaultStatus.unlockedUntil || 0) - now;
        if (diffMs <= 0) {
          setRemainingSeconds(0);
          setVaultToken(null);
          try {
            sessionStorage.removeItem(VAULT_SESSION_KEY);
          } catch {}
          setVaultStatus((prev) => (prev ? { ...prev, isUnlocked: false, unlockedUntil: null } : null));
          if (timerRef.current) clearInterval(timerRef.current);
        } else {
          setRemainingSeconds(Math.ceil(diffMs / 1000));
        }
      };

      updateCountdown();
      timerRef.current = setInterval(updateCountdown, 1000);
    } else {
      setRemainingSeconds(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [vaultStatus?.isUnlocked, vaultStatus?.unlockedUntil]);

  const setupVault = useCallback(
    async (pin: string, vaultFolder?: string, autoLockMinutes = 15, recoveryEmail?: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await authFetch('/api/vault/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin, vaultFolder, autoLockMinutes, recoveryEmail }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.message || 'Failed to initialize vault' };
        }
        setVaultStatus(data);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Network error during vault setup' };
      }
    },
    [authFetch]
  );

  const unlockVault = useCallback(
    async (pin: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await authFetch('/api/vault/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.message || 'Incorrect PIN or Passphrase' };
        }

        const token = data.sessionToken;
        setVaultToken(token);
        try {
          sessionStorage.setItem(VAULT_SESSION_KEY, token);
        } catch {}

        await fetchVaultStatus();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Network error unlocking vault' };
      }
    },
    [authFetch, fetchVaultStatus]
  );

  const lockVault = useCallback(async () => {
    try {
      if (vaultToken) {
        await authFetch('/api/vault/lock', {
          method: 'POST',
          headers: { 'x-vault-token': vaultToken },
        }).catch(() => {});
      }
    } finally {
      setVaultToken(null);
      try {
        sessionStorage.removeItem(VAULT_SESSION_KEY);
      } catch {}
      setVaultStatus((prev) => (prev ? { ...prev, isUnlocked: false, unlockedUntil: null } : null));
      setVaultMediaFiles([]);
    }
  }, [authFetch, vaultToken]);

  const changePin = useCallback(
    async (currentPin: string, newPin: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await vaultFetch('/api/vault/change-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPin, newPin }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.message || 'Не удалось изменить PIN-код' };
        }
        await fetchVaultStatus();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Ошибка сети при смене PIN-кода' };
      }
    },
    [vaultFetch, fetchVaultStatus]
  );

  const requestPinRecovery = useCallback(
    async (email: string): Promise<{ success: boolean; message: string; codeHint?: string; error?: string }> => {
      try {
        const res = await authFetch('/api/vault/recover-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, message: '', error: data.message || 'Ошибка запроса восстановления' };
        }
        return {
          success: true,
          message: data.message || `Код восстановления отправлен на адрес ${email}`,
          codeHint: data.codeHint,
        };
      } catch (err: any) {
        return { success: false, message: '', error: err.message || 'Ошибка сети' };
      }
    },
    [authFetch]
  );

  const resetPinWithRecovery = useCallback(
    async (email: string, recoveryCode: string, newPin: string): Promise<{ success: boolean; error?: string; message?: string }> => {
      try {
        const res = await authFetch('/api/vault/recover-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, recoveryCode, newPin }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.message || 'Неверный или просроченный код восстановления' };
        }
        await fetchVaultStatus();
        return { success: true, message: data.message || 'PIN-код личной папки успешно изменён' };
      } catch (err: any) {
        return { success: false, error: err.message || 'Ошибка сети' };
      }
    },
    [authFetch, fetchVaultStatus]
  );

  const addVaultItem = useCallback(
    async (filePath: string, notes?: string): Promise<boolean> => {
      try {
        const res = await vaultFetch('/api/vault/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath, notes }),
        });
        if (res.ok) {
          fetchVaultStatus();
          fetchVaultMediaItems();
          window.dispatchEvent(new CustomEvent('media_updated'));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [vaultFetch, fetchVaultStatus, fetchVaultMediaItems]
  );

  const removeVaultItem = useCallback(
    async (filePath: string): Promise<boolean> => {
      try {
        const res = await vaultFetch(`/api/vault/items?file=${encodeURIComponent(filePath)}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          fetchVaultStatus();
          fetchVaultMediaItems();
          window.dispatchEvent(new CustomEvent('media_updated'));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [vaultFetch, fetchVaultStatus, fetchVaultMediaItems]
  );

  const isUnlocked = Boolean(vaultStatus?.isUnlocked);
  const isConfigured = Boolean(vaultStatus?.isConfigured);

  const value = useMemo<VaultContextValue>(
    () => ({
      vaultStatus,
      vaultToken,
      isUnlocked,
      isConfigured,
      isLoading,
      unlockedUntil: vaultStatus?.unlockedUntil || null,
      remainingSeconds,
      vaultMediaFiles,
      loadingVaultFiles,
      fetchVaultStatus,
      setupVault,
      unlockVault,
      lockVault,
      changePin,
      requestPinRecovery,
      resetPinWithRecovery,
      fetchVaultMediaItems,
      addVaultItem,
      removeVaultItem,
      vaultFetch,
    }),
    [
      vaultStatus,
      vaultToken,
      isUnlocked,
      isConfigured,
      isLoading,
      remainingSeconds,
      vaultMediaFiles,
      loadingVaultFiles,
      fetchVaultStatus,
      setupVault,
      unlockVault,
      lockVault,
      changePin,
      requestPinRecovery,
      resetPinWithRecovery,
      fetchVaultMediaItems,
      addVaultItem,
      removeVaultItem,
      vaultFetch,
    ]
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
};

export function useVault(): VaultContextValue {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}
