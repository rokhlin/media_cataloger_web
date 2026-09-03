import { memo, useState, useMemo } from 'react';
import { usePersonTimeline } from '../../hooks/usePersonTimeline.js';
import type { PersonEventRecord } from '../../types/event.types.js';
import { FactCard } from './FactCard.js';
import { AddEditFactModal } from './AddEditFactModal.js';
import { GalleryPhotoPicker } from './GalleryPhotoPicker.js';

interface PersonTimelineViewProps {
  personId: string;
  personName: string;
}

const CATEGORY_FILTERS = [
  { id: 'ALL', label: 'All Events' },
  { id: 'MILESTONES', label: 'Milestones (Birth/Marriage)' },
  { id: 'GRADUATION', label: '🎓 Education' },
  { id: 'RELOCATION', label: '📍 Relocation' },
  { id: 'TRAVEL', label: '✈️ Travel' },
  { id: 'CAREER', label: '💼 Career' },
  { id: 'CUSTOM', label: '📝 Custom' },
];

export const PersonTimelineView = memo(({ personId, personName }: PersonTimelineViewProps) => {
  const {
    events,
    isLoading,
    createEvent,
    updateEvent,
    deleteEvent,
    pinMediaToEvent,
    unpinMedia,
  } = usePersonTimeline(personId);

  const [activeCategory, setActiveCategory] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [factToEdit, setFactToEdit] = useState<PersonEventRecord | null>(null);
  const [pinTargetEventId, setPinTargetEventId] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    if (activeCategory === 'ALL') return events;
    if (activeCategory === 'MILESTONES') {
      return events.filter((e: PersonEventRecord) =>
        ['BIRTH', 'DEATH', 'MARRIAGE', 'DIVORCE', 'CHILD_BORN'].includes(e.event_type),
      );
    }
    return events.filter((e: PersonEventRecord) => e.event_type === activeCategory);
  }, [events, activeCategory]);

  const handleOpenAdd = () => {
    setFactToEdit(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (evt: PersonEventRecord) => {
    setFactToEdit(evt);
    setIsAddModalOpen(true);
  };

  const handleSaveFact = async (data: any) => {
    if (factToEdit) {
      await updateEvent(factToEdit.id, data);
    } else {
      await createEvent(data);
    }
  };

  const handlePinMedia = (eventId: string) => {
    setPinTargetEventId(eventId);
  };

  const handleSelectPhotosToPin = async (photos: any[]) => {
    if (!pinTargetEventId) return;
    for (const p of photos) {
      await pinMediaToEvent(pinTargetEventId, p);
    }
    setPinTargetEventId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header with "+ Add Life Fact" and Filter Pills */}
      <div style={{ padding: '0 0 14px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Chronological Life Story & Timeline
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {events.length} milestones & life facts recorded for {personName}
            </div>
          </div>

          <button
            type="button"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
            }}
            onClick={handleOpenAdd}
          >
            ➕ Add Life Fact
          </button>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {CATEGORY_FILTERS.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                style={{
                  background: isSelected ? 'var(--nav-tab-active-bg)' : 'var(--nav-tab-bg)',
                  border: isSelected ? '1px solid var(--primary-color, #6366f1)' : '1px solid var(--border-color)',
                  borderRadius: 20,
                  color: isSelected ? 'var(--primary-color, #6366f1)' : 'var(--text-secondary)',
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.1s ease',
                }}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 4px 16px 0', position: 'relative' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            Loading timeline facts...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📜</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              No facts recorded in this category
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Click &quot;Add Life Fact&quot; above to document graduations, trips, moves, or anecdotes!
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: 20 }}>
            {/* Timeline vertical guide line */}
            <div
              style={{
                position: 'absolute',
                top: 8,
                bottom: 8,
                left: 6,
                width: 2,
                background: 'linear-gradient(to bottom, var(--primary-color, #6366f1), var(--accent-color, #a855f7), var(--border-color))',
              }}
            />

            {filteredEvents.map((evt: PersonEventRecord) => (
              <div key={evt.id} style={{ position: 'relative' }}>
                {/* Node dot on timeline line */}
                <div
                  style={{
                    position: 'absolute',
                    top: 14,
                    left: -19,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: evt.is_system_generated ? '#a855f7' : '#6366f1',
                    border: '2px solid var(--card-bg-solid)',
                    boxShadow: '0 0 8px rgba(99, 102, 241, 0.6)',
                  }}
                />

                <FactCard
                  event={evt}
                  onEdit={handleOpenEdit}
                  onDelete={deleteEvent}
                  onPinMedia={handlePinMedia}
                  onUnpinMedia={unpinMedia}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Fact Modal */}
      <AddEditFactModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveFact}
        factToEdit={factToEdit}
        personName={personName}
      />

      {/* Gallery Photo Picker */}
      <GalleryPhotoPicker
        isOpen={Boolean(pinTargetEventId)}
        onClose={() => setPinTargetEventId(null)}
        defaultPersonName={personName}
        onSelectPhotos={handleSelectPhotosToPin}
      />
    </div>
  );
});

PersonTimelineView.displayName = 'PersonTimelineView';
