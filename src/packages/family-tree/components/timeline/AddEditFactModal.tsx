import { useState, useEffect } from 'react';
import type { PersonEventRecord, EventType } from '../../types/event.types.js';
import { GalleryPhotoPicker } from './GalleryPhotoPicker.js';

interface AddEditFactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    event_type: EventType;
    title: string;
    description?: string;
    event_date?: string;
    date_is_approximate?: boolean;
    location_name?: string;
    latitude?: number;
    longitude?: number;
    pinned_media?: Array<{ media_id?: string; media_file_path: string; caption?: string }>;
  }) => Promise<void>;
  factToEdit?: PersonEventRecord | null;
  personName?: string;
}

const CATEGORIES: Array<{ type: EventType; label: string; icon: string }> = [
  { type: 'GRADUATION', label: 'Education & Graduation', icon: '🎓' },
  { type: 'RELOCATION', label: 'Relocation & Living Place', icon: '📍' },
  { type: 'TRAVEL', label: 'Travel & Expeditions', icon: '✈️' },
  { type: 'CAREER', label: 'Career & Achievements', icon: '💼' },
  { type: 'MILITARY', label: 'Military Service', icon: '🎖️' },
  { type: 'CUSTOM', label: 'Custom Life Event / Story', icon: '📝' },
];

export const AddEditFactModal = ({
  isOpen,
  onClose,
  onSave,
  factToEdit,
  personName,
}: AddEditFactModalProps) => {
  const [eventType, setEventType] = useState<EventType>('GRADUATION');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [dateApprox, setDateApprox] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [pinnedPhotos, setPinnedPhotos] = useState<Array<{ media_file_path: string; caption?: string }>>([]);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (factToEdit) {
      setEventType(factToEdit.event_type);
      setTitle(factToEdit.title);
      setDescription(factToEdit.description || '');
      setEventDate(factToEdit.event_date || '');
      setDateApprox(factToEdit.date_is_approximate === 1);
      setLocationName(factToEdit.location_name || '');
      setPinnedPhotos(factToEdit.pinned_media?.map((p: any) => ({ media_file_path: p.media_file_path, caption: p.caption || undefined })) || []);
    } else {
      setEventType('GRADUATION');
      setTitle('');
      setDescription('');
      setEventDate('');
      setDateApprox(false);
      setLocationName('');
      setPinnedPhotos([]);
    }
  }, [isOpen, factToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        event_type: eventType,
        title: title.trim(),
        description: description.trim() || undefined,
        event_date: eventDate.trim() || undefined,
        date_is_approximate: dateApprox,
        location_name: locationName.trim() || undefined,
        pinned_media: pinnedPhotos,
      });
      onClose();
    } catch {
      // ignore
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--input-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 4,
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
          padding: 20,
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: 'var(--modal-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 580,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-modal)',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {factToEdit ? 'Edit Life Fact' : 'Add Life Fact or Milestone'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {personName ? `Documenting life story for ${personName}` : 'Add a milestone to timeline'}
              </div>
            </div>
            <button
              type="button"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: 16,
                cursor: 'pointer',
              }}
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Category selection */}
            <div>
              <label style={labelStyle}>Fact Category</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {CATEGORIES.map((cat) => {
                  const isSelected = eventType === cat.type;
                  return (
                    <button
                      key={cat.type}
                      type="button"
                      style={{
                        background: isSelected ? 'var(--nav-tab-active-bg)' : 'var(--card-bg)',
                        border: isSelected ? '1.5px solid var(--primary-color, #6366f1)' : '1px solid var(--border-color)',
                        borderRadius: 8,
                        padding: '8px 6px',
                        color: isSelected ? 'var(--primary-color, #6366f1)' : 'var(--text-secondary)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        textAlign: 'center',
                      }}
                      onClick={() => setEventType(cat.type)}
                    >
                      <span style={{ fontSize: 16 }}>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label style={labelStyle}>Event Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Master's Degree in Computer Science from MIT"
                style={inputStyle}
              />
            </div>

            {/* Date and Approximate check */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
              <div>
                <label style={labelStyle}>Date (YYYY, YYYY-MM, or YYYY-MM-DD)</label>
                <input
                  type="text"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  placeholder="e.g. 2018-06-15"
                  style={inputStyle}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  marginTop: 20,
                }}
              >
                <input
                  type="checkbox"
                  checked={dateApprox}
                  onChange={(e) => setDateApprox(e.target.checked)}
                />
                <span>Approximate / Circa</span>
              </label>
            </div>

            {/* Location */}
            <div>
              <label style={labelStyle}>Location</label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g. Cambridge, MA, United States"
                style={inputStyle}
              />
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Story & Notes</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details, memories, achievements, or anecdotes about this milestone..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
              />
            </div>

            {/* Gallery Photos Pinning Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={labelStyle}>Attached Gallery Photos ({pinnedPhotos.length})</label>
                <button
                  type="button"
                  style={{
                    background: 'rgba(99, 102, 241, 0.2)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    color: '#c7d2fe',
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onClick={() => setIsPhotoPickerOpen(true)}
                >
                  📷 Browse Gallery
                </button>
              </div>

              {pinnedPhotos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {pinnedPhotos.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        width: 60,
                        height: 60,
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={`/api/media/file?file=${encodeURIComponent(p.media_file_path)}`}
                        alt="Pinned preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        style={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          background: 'rgba(0, 0, 0, 0.7)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '50%',
                          width: 16,
                          height: 16,
                          fontSize: 10,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          setPinnedPhotos((prev) => prev.filter((_, i) => i !== idx));
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                style={{
                  background: 'var(--nav-tab-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
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
                type="submit"
                disabled={isSubmitting}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                }}
              >
                {isSubmitting ? 'Saving...' : factToEdit ? 'Update Fact' : 'Create Fact'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <GalleryPhotoPicker
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        defaultPersonName={personName}
        onSelectPhotos={(photos) => {
          setPinnedPhotos((prev) => [...prev, ...photos]);
        }}
      />
    </>
  );
};
