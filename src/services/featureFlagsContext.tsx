import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { FeatureFlag, FeatureFlagsContextValue } from '../models/featureFlags';

const STORAGE_KEY = 'media_cataloger_feature_flags';
const STYLE_ELEMENT_ID = 'feature-flags-dynamic-styles';

// Normalize a class name string (strip leading dot, whitespace)
export function normalizeClassName(cls: string): string {
  return cls.trim().replace(/^\.+/, '');
}

export const DEFAULT_FEATURE_FLAG_PRESETS: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>[] = [
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

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

export const FeatureFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flags, setFlags] = useState<FeatureFlag[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => ({
            ...item,
            classNames: Array.isArray(item.classNames)
              ? item.classNames.map(normalizeClassName).filter(Boolean)
              : [],
          }));
        }
      }
    } catch (e) {
      console.warn('[FeatureFlags] Failed to load feature flags from localStorage:', e);
    }
    return DEFAULT_FEATURE_FLAG_PRESETS.map((p) => ({
      ...p,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  });

  // Persist flags to localStorage
  const persistFlags = useCallback((updatedFlags: FeatureFlag[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedFlags));
    } catch (e) {
      console.warn('[FeatureFlags] Failed to save feature flags to localStorage:', e);
    }
  }, []);

  // Compute disabled class names and inject dynamic CSS
  useEffect(() => {
    const disabledClassesSet = new Set<string>();

    for (const flag of flags) {
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
  }, [flags]);

  // Sync across tabs via window storage event
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setFlags(parsed);
          }
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // CRUD handlers
  const addFlag = useCallback(
    (flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): boolean => {
      const trimmedKey = flag.key.trim();
      if (!trimmedKey) return false;

      const normalizedClasses = Array.from(
        new Set(flag.classNames.map(normalizeClassName).filter(Boolean))
      );

      const now = Date.now();
      const newFlag: FeatureFlag = {
        key: trimmedKey,
        classNames: normalizedClasses,
        isEnabled: flag.isEnabled ?? true,
        description: flag.description?.trim() || '',
        createdAt: now,
        updatedAt: now,
      };

      setFlags((prev) => {
        // If key already exists, replace it, otherwise append
        const exists = prev.some((f) => f.key.toLowerCase() === trimmedKey.toLowerCase());
        const next = exists
          ? prev.map((f) => (f.key.toLowerCase() === trimmedKey.toLowerCase() ? newFlag : f))
          : [...prev, newFlag];
        persistFlags(next);
        return next;
      });

      return true;
    },
    [persistFlags]
  );

  const updateFlag = useCallback(
    (key: string, updates: Partial<Omit<FeatureFlag, 'key'>>): boolean => {
      let found = false;
      setFlags((prev) => {
        const next = prev.map((f) => {
          if (f.key === key) {
            found = true;
            const updatedClassNames = updates.classNames !== undefined
              ? Array.from(new Set(updates.classNames.map(normalizeClassName).filter(Boolean)))
              : f.classNames;

            return {
              ...f,
              ...updates,
              classNames: updatedClassNames,
              updatedAt: Date.now(),
            };
          }
          return f;
        });

        if (found) {
          persistFlags(next);
          return next;
        }
        return prev;
      });
      return found;
    },
    [persistFlags]
  );

  const toggleFlag = useCallback(
    (key: string): boolean => {
      let found = false;
      setFlags((prev) => {
        const next = prev.map((f) => {
          if (f.key === key) {
            found = true;
            return {
              ...f,
              isEnabled: !f.isEnabled,
              updatedAt: Date.now(),
            };
          }
          return f;
        });
        if (found) {
          persistFlags(next);
          return next;
        }
        return prev;
      });
      return found;
    },
    [persistFlags]
  );

  const removeFlag = useCallback(
    (key: string): boolean => {
      let removed = false;
      setFlags((prev) => {
        const next = prev.filter((f) => {
          if (f.key === key) {
            removed = true;
            return false;
          }
          return true;
        });
        if (removed) {
          persistFlags(next);
          return next;
        }
        return prev;
      });
      return removed;
    },
    [persistFlags]
  );

  const resetToDefaults = useCallback(() => {
    const now = Date.now();
    const defaults = DEFAULT_FEATURE_FLAG_PRESETS.map((p) => ({
      ...p,
      createdAt: now,
      updatedAt: now,
    }));
    setFlags(defaults);
    persistFlags(defaults);
  }, [persistFlags]);

  const clearAllFlags = useCallback(() => {
    setFlags([]);
    persistFlags([]);
  }, [persistFlags]);

  const isFeatureEnabled = useCallback(
    (key: string): boolean => {
      const found = flags.find((f) => f.key.toLowerCase() === key.toLowerCase());
      return found ? found.isEnabled : true;
    },
    [flags]
  );

  const isClassEnabled = useCallback(
    (className: string): boolean => {
      const normalized = normalizeClassName(className);
      if (!normalized) return true;
      // If ANY created flag targeting this class is disabled, it is disabled
      const isExplicitlyDisabled = flags.some(
        (f) => !f.isEnabled && f.classNames.some((c) => normalizeClassName(c) === normalized)
      );
      return !isExplicitlyDisabled;
    },
    [flags]
  );

  const hasFlag = useCallback(
    (key: string): boolean => {
      return flags.some((f) => f.key.toLowerCase() === key.toLowerCase());
    },
    [flags]
  );

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
