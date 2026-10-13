import { useState, useEffect } from 'react';

const STORAGE_KEY = 'media_catalog_favorites';

type Listener = (favorites: string[]) => void;

class FavoritesService {
  private favorites: Set<string> = new Set();
  private listeners: Set<Listener> = new Set();
  private initialized: boolean = false;

  constructor() {
    this.init();
  }

  private init(): void {
    if (this.initialized) return;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            this.favorites = new Set(parsed);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load favorites from localStorage:', e);
    }
    this.initialized = true;
  }

  private persist(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(Array.from(this.favorites))
        );
      }
    } catch (e) {
      console.warn('Failed to persist favorites to localStorage:', e);
    }
    this.notify();
  }

  private notify(): void {
    const list = this.getFavorites();
    this.listeners.forEach((listener) => {
      try {
        listener(list);
      } catch (e) {
        console.error('Error notifying favorites listener:', e);
      }
    });
  }

  isFavorite(pathOrId: string | undefined | null): boolean {
    if (!pathOrId) return false;
    return this.favorites.has(pathOrId);
  }

  toggleFavorite(pathOrId: string | undefined | null): boolean {
    if (!pathOrId) return false;
    if (this.favorites.has(pathOrId)) {
      this.favorites.delete(pathOrId);
      this.persist();
      return false;
    } else {
      this.favorites.add(pathOrId);
      this.persist();
      return true;
    }
  }

  setFavorite(pathOrId: string | undefined | null, isFav: boolean): void {
    if (!pathOrId) return;
    if (isFav) {
      this.favorites.add(pathOrId);
    } else {
      this.favorites.delete(pathOrId);
    }
    this.persist();
  }

  getFavorites(): string[] {
    return Array.from(this.favorites);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const favoritesService = new FavoritesService();

/**
 * React hook to reactively subscribe to the favorites list and check/toggle favorites.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => favoritesService.getFavorites());

  useEffect(() => {
    return favoritesService.subscribe((updated) => {
      setFavorites([...updated]);
    });
  }, []);

  const isFavorite = (pathOrId: string | undefined | null): boolean => {
    return favoritesService.isFavorite(pathOrId);
  };

  const toggleFavorite = (pathOrId: string | undefined | null): boolean => {
    return favoritesService.toggleFavorite(pathOrId);
  };

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    favoritesCount: favorites.length,
  };
}
