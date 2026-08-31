import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { FeatureFlag, FeatureFlagsContextValue } from '../models/featureFlags';

export const STORAGE_KEY = 'media_cataloger_feature_flags';
export const STYLE_ELEMENT_ID = 'feature-flags-dynamic-styles';

// Normalize a class name string (strip leading dot, whitespace)
export function normalizeClassName(cls: string): string {
  return cls.trim().replace(/^\.+/, '');
}

// Normalize a flag key (case-insensitive, treats '-' and '_' interchangeably)
export function normalizeFlagKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export const DEFAULT_FEATURE_FLAG_PRESETS: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>[] = [
  {
    key: 'first_frame_thumbnail_generation',
    classNames: ['gallery-video-play-overlay'],
    isEnabled: true,
    description: 'First-frame video thumbnail extraction and preview',
  },
  {
    key: 'header_logs_button',
    classNames: ['btn-logs-toggle'],
    isEnabled: true,
    description: 'Header logs toggle button',
  },
  {
    key: 'theme_quick_switcher',
    classNames: ['theme-switcher-container'],
    isEnabled: true,
    description: 'Header theme switcher and dark/light toggle',
  },
  {
    key: 'language_switcher',
    classNames: ['lang-switcher-wrap'],
    isEnabled: true,
    description: 'Language switch buttons (EN/RU)',
  },
  {
    key: 'status_badge_header',
    classNames: ['status-badge'],
    isEnabled: true,
    description: 'System status indicator badge in header',
  },
  {
    key: 'gallery_view_mode_selector',
    classNames: ['view-mode-selector'],
    isEnabled: true,
    description: 'Media gallery view mode switcher buttons',
  },
  {
    key: 'media_filter_bar',
    classNames: ['gallery-filter-bar', 'gallery-filters-row'],
    isEnabled: true,
    description: 'Media gallery search and filter toolbar',
  },
];

/**
 * FlagsManager - Central singleton for querying and managing feature flags anywhere in the application.
 * Usage:
 *   const isEnabled: boolean = FlagsManager.IsActive('first-frame-thumbnail-generation');
 *   const isEnabled: boolean = FlagsManager.IsActive('first_frame_thumbnail_generation');
 */
class FlagsManagerSingleton {
  private flagsMap: Map<string, FeatureFlag> = new Map();
  private listeners: Set<(flags: FeatureFlag[]) => void> = new Set();
  private isInitialized = false;

  constructor() {
    this.init();
  }

  public init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.loadFromStorage();

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
          this.loadFromStorage();
          this.notify();
        }
      });
    }
  }

  public loadFromStorage(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.flagsMap.clear();
          for (const item of parsed) {
            if (item && item.key) {
              const normKey = normalizeFlagKey(item.key);
              this.flagsMap.set(normKey, {
                ...item,
                key: item.key,
                classNames: Array.isArray(item.classNames)
                  ? item.classNames.map(normalizeClassName).filter(Boolean)
                  : [],
                isEnabled: Boolean(item.isEnabled),
              });
            }
          }
          this.applyCssRules();
          return;
        }
      }
    } catch (e) {
      console.warn('[FlagsManager] Failed to load from storage:', e);
    }

    // Default presets fallback
    this.flagsMap.clear();
    for (const p of DEFAULT_FEATURE_FLAG_PRESETS) {
      const normKey = normalizeFlagKey(p.key);
      this.flagsMap.set(normKey, {
        ...p,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    this.applyCssRules();
  }

  public persist(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const arr = Array.from(this.flagsMap.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      this.applyCssRules();
      this.notify();
    } catch (e) {
      console.warn('[FlagsManager] Failed to persist flags:', e);
    }
  }

  /**
   * Main check function: returns boolean whether the flag key is active.
   * Matches keys case-insensitively and treats dashes/underscores interchangeably.
   * Example: FlagsManager.IsActive('first-frame-thumbnail-generation')
   */
  public IsActive(key: string, defaultValue = true): boolean {
    if (!key) return defaultValue;
    const norm = normalizeFlagKey(key);
    const flag = this.flagsMap.get(norm);
    if (flag !== undefined) {
      return Boolean(flag.isEnabled);
    }
    return defaultValue;
  }

  /**
   * Alias for IsActive (camelCase)
   */
  public isActive(key: string, defaultValue = true): boolean {
    return this.IsActive(key, defaultValue);
  }

  /**
   * Check if a CSS class name is currently enabled across all feature flags.
   */
  public isClassEnabled(className: string): boolean {
    const norm = normalizeClassName(className);
    if (!norm) return true;
    for (const flag of this.flagsMap.values()) {
      if (!flag.isEnabled && flag.classNames.some((c) => normalizeClassName(c) === norm)) {
        return false;
      }
    }
    return true;
  }

  public getFlags(): FeatureFlag[] {
    return Array.from(this.flagsMap.values());
  }

  public getFlag(key: string): FeatureFlag | undefined {
    return this.flagsMap.get(normalizeFlagKey(key));
  }

  public setFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): boolean {
    const cleanKey = flag.key.trim();
    if (!cleanKey) return false;

    const normKey = normalizeFlagKey(cleanKey);
    const normalizedClasses = Array.from(
      new Set(flag.classNames.map(normalizeClassName).filter(Boolean))
    );

    const now = Date.now();
    const existing = this.flagsMap.get(normKey);

    const newFlag: FeatureFlag = {
      key: cleanKey,
      classNames: normalizedClasses,
      isEnabled: flag.isEnabled ?? true,
      description: flag.description?.trim() || '',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.flagsMap.set(normKey, newFlag);
    this.persist();
    return true;
  }

  public toggleFlag(key: string): boolean {
    const normKey = normalizeFlagKey(key);
    const flag = this.flagsMap.get(normKey);
    if (!flag) return false;

    flag.isEnabled = !flag.isEnabled;
    flag.updatedAt = Date.now();
    this.persist();
    return true;
  }

  public removeFlag(key: string): boolean {
    const normKey = normalizeFlagKey(key);
    const deleted = this.flagsMap.delete(normKey);
    if (deleted) {
      this.persist();
    }
    return deleted;
  }

  public resetToDefaults(): void {
    this.flagsMap.clear();
    const now = Date.now();
    for (const p of DEFAULT_FEATURE_FLAG_PRESETS) {
      const normKey = normalizeFlagKey(p.key);
      this.flagsMap.set(normKey, {
        ...p,
        createdAt: now,
        updatedAt: now,
      });
    }
    this.persist();
  }

  public clearAll(): void {
    this.flagsMap.clear();
    this.persist();
  }

  public subscribe(listener: (flags: FeatureFlag[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const all = this.getFlags();
    this.listeners.forEach((fn) => fn(all));
  }

  public applyCssRules(): void {
    if (typeof document === 'undefined') return;

    const disabledClassesSet = new Set<string>();
    for (const flag of this.flagsMap.values()) {
      if (!flag.isEnabled) {
        for (const cls of flag.classNames) {
          const normalized = normalizeClassName(cls);
          if (normalized) {
            disabledClassesSet.add(normalized);
          }
        }
      }
    }

    let styleEl = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ELEMENT_ID;
      document.head.appendChild(styleEl);
    }

    if (disabledClassesSet.size === 0) {
      styleEl.textContent = '/* Feature flags: all active classes enabled */';
    } else {
      const rules = Array.from(disabledClassesSet).map(
        (cls) => `.${CSS.escape ? CSS.escape(cls) : cls} { display: none !important; }`
      );
      styleEl.textContent = `/* Feature flags disabled class rules */\n${rules.join('\n')}`;
    }
  }
}

export const FlagsManager = new FlagsManagerSingleton();

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

export const FeatureFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flags, setFlags] = useState<FeatureFlag[]>(() => FlagsManager.getFlags());

  // Subscribe to FlagsManager changes
  useEffect(() => {
    return FlagsManager.subscribe((updatedFlags) => {
      setFlags(updatedFlags);
    });
  }, []);

  const addFlag = useCallback((flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>) => {
    return FlagsManager.setFlag(flag);
  }, []);

  const updateFlag = useCallback(
    (key: string, updates: Partial<Omit<FeatureFlag, 'key'>>) => {
      const existing = FlagsManager.getFlag(key);
      if (!existing) return false;
      return FlagsManager.setFlag({
        ...existing,
        ...updates,
      });
    },
    []
  );

  const toggleFlag = useCallback((key: string) => {
    return FlagsManager.toggleFlag(key);
  }, []);

  const removeFlag = useCallback((key: string) => {
    return FlagsManager.removeFlag(key);
  }, []);

  const resetToDefaults = useCallback(() => {
    FlagsManager.resetToDefaults();
  }, []);

  const clearAllFlags = useCallback(() => {
    FlagsManager.clearAll();
  }, []);

  const isFeatureEnabled = useCallback((key: string) => {
    return FlagsManager.IsActive(key);
  }, []);

  const isClassEnabled = useCallback((className: string) => {
    return FlagsManager.isClassEnabled(className);
  }, []);

  const hasFlag = useCallback((key: string) => {
    return FlagsManager.getFlag(key) !== undefined;
  }, []);

  const disabledClassesCount = useMemo(() => {
    const set = new Set<string>();
    for (const flag of flags) {
      if (!flag.isEnabled) {
        for (const cls of flag.classNames) {
          const norm = normalizeClassName(cls);
          if (norm) set.add(norm);
        }
      }
    }
    return set.size;
  }, [flags]);

  const value = useMemo(
    () => ({
      flags,
      addFlag,
      updateFlag,
      toggleFlag,
      removeFlag,
      resetToDefaults,
      clearAllFlags,
      isFeatureEnabled,
      isClassEnabled,
      hasFlag,
      disabledClassesCount,
    }),
    [
      flags,
      addFlag,
      updateFlag,
      toggleFlag,
      removeFlag,
      resetToDefaults,
      clearAllFlags,
      isFeatureEnabled,
      isClassEnabled,
      hasFlag,
      disabledClassesCount,
    ]
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
};

export function useFeatureFlags(): FeatureFlagsContextValue {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  return ctx;
}
