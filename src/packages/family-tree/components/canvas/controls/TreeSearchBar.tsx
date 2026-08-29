import { memo, useState, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useFamilyTreeStore } from '../../../state/useFamilyTreeStore.js';
import type { AutocompletePersonItem } from '../../../types/tree.types.js';

export const TreeSearchBar = memo(() => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AutocompletePersonItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { fitView } = useReactFlow();
  const { selectPerson, setHighlightedPersonId, activeTreeId } = useFamilyTreeStore();
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      setHighlightedPersonId(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/family-tree/public/autocomplete?query=${encodeURIComponent(query)}&treeId=${encodeURIComponent(activeTreeId)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setIsOpen(data.length > 0);
        }
      } catch {
        // ignore
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, activeTreeId, setHighlightedPersonId]);

  // Click outside listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelect = (item: AutocompletePersonItem) => {
    setQuery(item.fullName);
    setIsOpen(false);
    selectPerson(item.id, true);
    setHighlightedPersonId(item.id);
    fitView({
      nodes: [{ id: `p_${item.id}` }],
      duration: 600,
      maxZoom: 1.2,
    });
  };

  return (
    <div
      ref={searchRef}
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 20,
        width: 280,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 10,
          padding: '6px 12px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        <span style={{ marginRight: 8, fontSize: 14, color: '#94a3b8' }}>🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search family member..."
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#f8fafc',
            fontSize: 13,
            width: '100%',
          }}
        />
        {query && (
          <button
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 12,
            }}
            onClick={() => {
              setQuery('');
              setHighlightedPersonId(null);
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 10,
            maxHeight: 280,
            overflowY: 'auto',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
            padding: '4px',
          }}
        >
          {results.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'background 0.1s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              onClick={() => handleSelect(p)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {p.avatarUrl ? (
                  <img
                    src={p.avatarUrl}
                    alt={p.fullName}
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#ffffff',
                    }}
                  >
                    {p.firstName[0]}
                  </div>
                )}

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {p.fullName}
                  </div>
                  {p.birthYear && (
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {p.isLiving ? `b. ${p.birthYear}` : `Lifespan info`}
                    </div>
                  )}
                </div>
              </div>

              {p.kinshipTerm && (
                <span
                  style={{
                    background: 'rgba(99, 102, 241, 0.2)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    color: '#c7d2fe',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.kinshipTerm}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

TreeSearchBar.displayName = 'TreeSearchBar';
