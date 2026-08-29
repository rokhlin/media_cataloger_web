import { useState, useEffect, useMemo } from 'react';

interface GalleryPhotoPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPhotos: (photos: Array<{ media_id?: string; media_file_path: string; thumbnail_url?: string; caption?: string }>) => void;
  defaultPersonName?: string;
}

export const GalleryPhotoPicker = ({
  isOpen,
  onClose,
  onSelectPhotos,
  defaultPersonName,
}: GalleryPhotoPickerProps) => {
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const loadMedia = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/media/files');
        if (res.ok) {
          const data = await res.json();
          setMediaFiles(data.files || []);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };

    loadMedia();
    setSelectedPaths(new Set());
    setCaption('');
  }, [isOpen]);

  const filteredMedia = useMemo(() => {
    return mediaFiles.filter((m) => {
      if (!m.is_image) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = m.face_names?.some((fn: string) => fn.toLowerCase().includes(q));
        const matchesFile = m.filename.toLowerCase().includes(q);
        const matchesDesc = m.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesFile && !matchesDesc) return false;
      }

      return true;
    });
  }, [mediaFiles, searchQuery]);

  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleConfirm = () => {
    const selected = Array.from(selectedPaths).map((p) => ({
      media_file_path: p,
      caption: caption || undefined,
    }));
    onSelectPhotos(selected);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(10px)',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 720,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🖼️</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                Select Gallery Photos to Pin
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Attach visual memories and documents from your Media Cataloger library
              </div>
            </div>
          </div>
          <button
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: 16,
              cursor: 'pointer',
            }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ padding: '12px 20px', display: 'flex', gap: 10, borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by photo name, tagged person, description..."
            style={{
              flex: 1,
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#f8fafc',
              fontSize: 13,
              outline: 'none',
            }}
          />

          {defaultPersonName && !searchQuery && (
            <button
              type="button"
              style={{
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                color: '#c7d2fe',
                borderRadius: 8,
                padding: '0 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => setSearchQuery(defaultPersonName)}
            >
              Filter by {defaultPersonName}
            </button>
          )}
        </div>

        {/* Media Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              Loading media library...
            </div>
          ) : filteredMedia.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              No photos found matching your search.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 12,
              }}
            >
              {filteredMedia.map((m) => {
                const isSelected = selectedPaths.has(m.file_path);
                const thumbUrl = `/api/media/file?file=${encodeURIComponent(m.file_path)}`;

                return (
                  <div
                    key={m.file_path}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: 10,
                      overflow: 'hidden',
                      border: isSelected ? '3px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, border 0.15s ease',
                      boxShadow: isSelected ? '0 0 15px rgba(99, 102, 241, 0.5)' : 'none',
                    }}
                    onClick={() => toggleSelect(m.file_path)}
                  >
                    <img
                      src={thumbUrl}
                      alt={m.filename}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />

                    {/* Selection Checkmark */}
                    {isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          background: '#6366f1',
                          color: '#ffffff',
                          borderRadius: '50%',
                          width: 22,
                          height: 22,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 700,
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
                        }}
                      >
                        ✓
                      </div>
                    )}

                    {/* Filename footer */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        insetInline: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
                        padding: '12px 6px 4px',
                        fontSize: 10,
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {m.filename}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with caption input and submit */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(30, 41, 59, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Optional caption for pinned photo(s)..."
            style={{
              flex: 1,
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#f8fafc',
              fontSize: 13,
              outline: 'none',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                cursor: 'pointer',
              }}
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="button"
              style={{
                background: selectedPaths.size > 0 ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'rgba(255, 255, 255, 0.08)',
                color: selectedPaths.size > 0 ? '#ffffff' : '#64748b',
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: selectedPaths.size > 0 ? 'pointer' : 'not-allowed',
                boxShadow: selectedPaths.size > 0 ? '0 4px 14px rgba(99, 102, 241, 0.4)' : 'none',
              }}
              disabled={selectedPaths.size === 0}
              onClick={handleConfirm}
            >
              Pin {selectedPaths.size} Photo{selectedPaths.size === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
