import React, { useState, useRef } from 'react';
import { useFamilyTreeStore } from '../../state/useFamilyTreeStore.js';
import { exportTreeToCSV, parseTreeFromCSV, getSampleTreeCSV } from '../../utils/csvTreeService.js';
import { formatTreeDate } from '../../utils/dateUtils.js';
import type { TreeGraphData, DateFormatStyle } from '../../types/tree.types.js';

interface TreeSettingsTabProps {
  graphData: TreeGraphData | null;
  refreshGraph: () => Promise<void>;
  createPerson?: (data: any) => Promise<any>;
  createUnion?: (data: any) => Promise<any>;
  addChildToUnion?: (unionId: string, data: { person_id: string; filiation?: any; birth_order?: number }) => Promise<any>;
  onBackToCanvas: () => void;
}

const COLOR_PRESETS = [
  { label: 'Pink', value: '#ec4899' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Sky', value: '#0ea5e9' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Indigo', value: '#6366f1' },
];

const ICON_PRESETS = ['🎂', '🎉', '💍', '💐', '🕯️', '⭐', '🎈', '🏆'];

export const TreeSettingsTab: React.FC<TreeSettingsTabProps> = ({
  graphData,
  refreshGraph,
  createPerson,
  createUnion,
  addChildToUnion,
  onBackToCanvas,
}) => {
  const {
    nodeViewStyle,
    setNodeViewStyle,
    dateFormatStyle,
    setDateFormatStyle,
    celebrationConfig,
    setCelebrationConfig,
    lifeFactsConfig,
    setLifeFactsConfig,
    activeTreeId,
  } = useFamilyTreeStore();

  // CSV Import State
  const [csvText, setCsvText] = useState('');
  const [importStats, setImportStats] = useState<{ personsCount: number; unionsCount: number; errors: string[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);
  const [importStatusType, setImportStatusType] = useState<'success' | 'error' | 'info'>('info');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // CSV Handlers
  // ---------------------------------------------------------------------------
  const handleExportCSV = () => {
    if (!graphData || !graphData.persons || graphData.persons.length === 0) {
      alert('Family tree is currently empty. Add members before exporting.');
      return;
    }
    const csvContent = exportTreeToCSV(graphData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `family_tree_${activeTreeId || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSample = () => {
    const sample = getSampleTreeCSV();
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_family_tree.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setCsvText(text);
        const parsed = parseTreeFromCSV(text);
        setImportStats({
          personsCount: parsed.persons.length,
          unionsCount: parsed.unions.length,
          errors: [],
        });
        setImportStatusMessage(`File loaded: ${parsed.persons.length} persons, ${parsed.unions.length} unions detected.`);
        setImportStatusType('info');
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!csvText.trim()) {
      setImportStatusMessage('Please select or paste a CSV file first.');
      setImportStatusType('error');
      return;
    }

    const parsed = parseTreeFromCSV(csvText);
    if (parsed.persons.length === 0) {
      setImportStatusMessage('No valid persons found in the CSV to import.');
      setImportStatusType('error');
      return;
    }

    setIsImporting(true);
    setImportStatusMessage('Importing family tree records...');
    setImportStatusType('info');

    try {
      // Map old CSV person IDs to new generated IDs
      const idMap = new Map<string, string>();

      // 1. Create Persons
      for (const p of parsed.persons) {
        if (createPerson) {
          const created = await createPerson({
            tree_id: activeTreeId,
            first_name: p.first_name,
            middle_name: p.middle_name,
            last_name: p.last_name,
            maiden_name: p.maiden_name,
            gender: p.gender || 'UNKNOWN',
            birth_date: p.birth_date,
            birth_place: p.birth_place,
            is_living: p.is_living,
            death_date: p.death_date,
            death_place: p.death_place,
            bio: p.bio,
          });
          if (created && created.id) {
            idMap.set(p.id, created.id);
          }
        }
      }

      // 2. Create Unions and link children
      for (const u of parsed.unions) {
        const partner1Id = idMap.get(u.partner1_id || u.partner_ids[0]);
        const partner2Id = (u.partner2_id || u.partner_ids[1]) ? idMap.get(u.partner2_id || u.partner_ids[1]) : undefined;

        if (partner1Id && createUnion) {
          const union = await createUnion({
            tree_id: activeTreeId,
            partner_1_id: partner1Id,
            partner_2_id: partner2Id,
            union_type: u.union_type || 'MARRIAGE',
            start_date: u.start_date,
            end_date: u.end_date,
            start_place: u.start_place,
            notes: u.notes,
          });

          if (union && union.id && u.children && addChildToUnion) {
            for (const childRef of u.children) {
              const mappedChildId = idMap.get(childRef.person_id);
              if (mappedChildId) {
                await addChildToUnion(union.id, {
                  person_id: mappedChildId,
                  filiation: childRef.filiation,
                  birth_order: childRef.birth_order,
                });
              }
            }
          }
        }
      }

      await refreshGraph();
      setImportStatusMessage(`Import successful! Added ${parsed.persons.length} persons and ${parsed.unions.length} unions.`);
      setImportStatusType('success');
      setCsvText('');
      setImportStats(null);
    } catch (err: any) {
      setImportStatusMessage(`Import error: ${err?.message || 'Failed to import tree'}`);
      setImportStatusType('error');
    } finally {
      setIsImporting(false);
    }
  };

  // Card header styles
  const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg-solid)',
    border: '1px solid var(--border-color)',
    borderRadius: 14,
    padding: 22,
    boxShadow: 'var(--shadow-card)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const sectionSubtextStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginTop: -8,
  };

  return (
    <div
      className="tree-settings-container"
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        padding: '24px 32px 64px',
        maxWidth: 1100,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Top Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            ⚙️ Tree Configuration & Settings
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Customize canvas node styles, celebrations, date display formats, life facts filters, and CSV backup.
          </p>
        </div>

        <button
          type="button"
          onClick={onBackToCanvas}
          style={{
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 20px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)',
          }}
        >
          ← Back to Interactive Canvas
        </button>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 1. Tree View Styles */}
      {/* --------------------------------------------------------------------- */}
      <div style={cardStyle}>
        <div>
          <div style={sectionTitleStyle}>
            <span>🎨</span> Tree Node View Style
          </div>
          <div style={sectionSubtextStyle}>
            Select how persons are rendered on the tree canvas. ELK layout dimensions adjust automatically.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* Style 1: Default */}
          <div
            onClick={() => setNodeViewStyle('default')}
            style={{
              border: nodeViewStyle === 'default' ? '2px solid var(--primary-color, #6366f1)' : '1px solid var(--border-color)',
              background: nodeViewStyle === 'default' ? 'rgba(99, 102, 241, 0.08)' : 'var(--nav-tab-bg)',
              borderRadius: 12,
              padding: 16,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                1. Default Style
              </span>
              <input type="radio" checked={nodeViewStyle === 'default'} readOnly />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Full detailed card with avatar portrait, name, maiden name, lifespan, birthplace, and quick-add actions.
            </div>
            {/* Visual Mini Mockup */}
            <div
              style={{
                height: 70,
                background: 'var(--card-bg-solid)',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                JD
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Johnathan Doe</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>1954 – 2018 • 📍 Boston</div>
              </div>
            </div>
          </div>

          {/* Style 2: Circle */}
          <div
            onClick={() => setNodeViewStyle('circle')}
            style={{
              border: nodeViewStyle === 'circle' ? '2px solid var(--primary-color, #6366f1)' : '1px solid var(--border-color)',
              background: nodeViewStyle === 'circle' ? 'rgba(99, 102, 241, 0.08)' : 'var(--nav-tab-bg)',
              borderRadius: 12,
              padding: 16,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                2. Circle Style
              </span>
              <input type="radio" checked={nodeViewStyle === 'circle'} readOnly />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Ultra-compact circular avatar showing only image and person name. Ideal for large dense genealogical trees.
            </div>
            {/* Visual Mini Mockup */}
            <div
              style={{
                height: 70,
                background: 'var(--card-bg-solid)',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#a855f7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                JD
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Johnathan Doe</div>
            </div>
          </div>

          {/* Style 3: Square */}
          <div
            onClick={() => setNodeViewStyle('square')}
            style={{
              border: nodeViewStyle === 'square' ? '2px solid var(--primary-color, #6366f1)' : '1px solid var(--border-color)',
              background: nodeViewStyle === 'square' ? 'rgba(99, 102, 241, 0.08)' : 'var(--nav-tab-bg)',
              borderRadius: 12,
              padding: 16,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                3. Square Style
              </span>
              <input type="radio" checked={nodeViewStyle === 'square'} readOnly />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Balanced card featuring a modern square portrait, full person name, and formatted birth date.
            </div>
            {/* Visual Mini Mockup */}
            <div
              style={{
                height: 70,
                background: 'var(--card-bg-solid)',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 6, background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                JD
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Johnathan Doe</div>
                <div style={{ fontSize: 10, color: '#10b981' }}>b. May 14, 1980</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. Celebration Badges */}
      {/* --------------------------------------------------------------------- */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={sectionTitleStyle}>
              <span>🎂</span> Celebration & Milestone Badges
            </div>
            <div style={sectionSubtextStyle}>
              Display celebratory badges on nodes when birthdays, wedding anniversaries, or memorial days approach.
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={celebrationConfig.enabled}
              onChange={(e) => setCelebrationConfig({ enabled: e.target.checked })}
              style={{ width: 16, height: 16 }}
            />
            Enable Badges
          </label>
        </div>

        {celebrationConfig.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
            {/* Event Types */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                Occasions to Celebrate
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={celebrationConfig.showBirthday}
                    onChange={(e) => setCelebrationConfig({ showBirthday: e.target.checked })}
                  />
                  <span>🎂 Birthdays</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={celebrationConfig.showAnniversary}
                    onChange={(e) => setCelebrationConfig({ showAnniversary: e.target.checked })}
                  />
                  <span>💍 Wedding Anniversaries</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={celebrationConfig.showMemorial}
                    onChange={(e) => setCelebrationConfig({ showMemorial: e.target.checked })}
                  />
                  <span>🕯️ Memorial Days</span>
                </label>
              </div>
            </div>

            {/* Threshold & Style */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                  Show badge within: <strong>{celebrationConfig.daysThreshold} days</strong>
                </label>
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={celebrationConfig.daysThreshold}
                  onChange={(e) => setCelebrationConfig({ daysThreshold: parseInt(e.target.value, 10) })}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)' }}>
                  <span>0 (Day of event only)</span>
                  <span>15 days</span>
                  <span>30 days ahead</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                  Badge Presentation Style
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['pill', 'glow', 'ribbon'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setCelebrationConfig({ badgeStyle: style })}
                      style={{
                        flex: 1,
                        background: celebrationConfig.badgeStyle === style ? 'var(--primary-color, #6366f1)' : 'var(--nav-tab-bg)',
                        color: celebrationConfig.badgeStyle === style ? '#ffffff' : 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Colors & Icon */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                  Badge Color & Accent
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCelebrationConfig({ badgeColor: c.value })}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: c.value,
                        border: celebrationConfig.badgeColor === c.value ? '3px solid #ffffff' : '1px solid rgba(0,0,0,0.2)',
                        boxShadow: celebrationConfig.badgeColor === c.value ? '0 0 8px ' + c.value : undefined,
                        cursor: 'pointer',
                      }}
                      title={c.label}
                    />
                  ))}
                  <input
                    type="color"
                    value={celebrationConfig.badgeColor || '#ec4899'}
                    onChange={(e) => setCelebrationConfig({ badgeColor: e.target.value })}
                    style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer' }}
                    title="Custom color"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                  Badge Picture / Icon
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {ICON_PRESETS.map((ico) => (
                    <button
                      key={ico}
                      type="button"
                      onClick={() => setCelebrationConfig({ customIcon: ico })}
                      style={{
                        fontSize: 16,
                        background: celebrationConfig.customIcon === ico ? 'var(--nav-tab-active-bg)' : 'var(--nav-tab-bg)',
                        border: celebrationConfig.customIcon === ico ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                        borderRadius: 6,
                        padding: '4px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      {ico}
                    </button>
                  ))}
                  <input
                    type="text"
                    maxLength={3}
                    value={celebrationConfig.customIcon || '🎂'}
                    onChange={(e) => setCelebrationConfig({ customIcon: e.target.value })}
                    style={{
                      width: 44,
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 6,
                      textAlign: 'center',
                      fontSize: 16,
                      color: 'var(--text-primary)',
                      padding: 4,
                    }}
                    title="Custom emoji or characters"
                  />
                </div>
              </div>
            </div>

            {/* Live Badge Preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--nav-tab-bg)', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Preview:</span>
              <div
                style={{
                  background: celebrationConfig.badgeColor || '#ec4899',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: celebrationConfig.badgeStyle === 'ribbon' ? 4 : 12,
                  boxShadow: celebrationConfig.badgeStyle === 'glow' ? `0 0 12px ${celebrationConfig.badgeColor || '#ec4899'}` : '0 2px 6px rgba(0,0,0,0.2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{celebrationConfig.customIcon || '🎂'}</span>
                <span>Birthday in 3 days</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 3. Date Formats & Display */}
      {/* --------------------------------------------------------------------- */}
      <div style={cardStyle}>
        <div>
          <div style={sectionTitleStyle}>
            <span>📅</span> Date Formats & Date Picker Configuration
          </div>
          <div style={sectionSubtextStyle}>
            Choose how dates are formatted on nodes, cards, and drawers. All common input formats are automatically recognized and converted.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
              Screen Display Format
            </label>
            <select
              value={dateFormatStyle}
              onChange={(e) => setDateFormatStyle(e.target.value as DateFormatStyle)}
              style={{
                width: '100%',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '10px 14px',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 1985-04-12, ISO Standard)</option>
              <option value="DD Month YYYY">DD Month YYYY (e.g. 12 April 1985, Written)</option>
              <option value="DD.MM.YYYY">DD.MM.YYYY (e.g. 12.04.1985, European)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 04/12/1985, US)</option>
            </select>
          </div>

          {/* Sample Format Preview */}
          <div style={{ background: 'var(--nav-tab-bg)', padding: '12px 18px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Example output on cards:</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary-color, #6366f1)' }}>
              Birth: {formatTreeDate('1985-04-12', dateFormatStyle)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 2 }}>
              Marriage: {formatTreeDate('2010-09-25', dateFormatStyle)}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(99, 102, 241, 0.06)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          💡 <strong>Smart Parser:</strong> When typing in the Date Picker, you can enter dates in <code>YYYY-MM-DD</code>, <code>YYYY-MM</code>, <code>YYYY</code>, <code>DD.MM.YYYY</code>, <code>DD.MM</code>, <code>DD</code>, <code>MM.YYYY</code>, <code>MM/DD/YYYY</code>, or <code>MM/DD</code>. The system detects the format on the fly and standardizes it automatically.
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 4. Life Facts & Relatives Configuration */}
      {/* --------------------------------------------------------------------- */}
      <div style={cardStyle}>
        <div>
          <div style={sectionTitleStyle}>
            <span>📜</span> Person Life Facts & Relatives Filtering
          </div>
          <div style={sectionSubtextStyle}>
            Configure what facts and whose milestones appear when exploring a person's life timeline.
          </div>
        </div>

        {/* Checkbox Group 1: Whose facts to show */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'block' }}>
            1. Whose Life Facts to Display in Person Timeline
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={lifeFactsConfig.showOwnFacts}
                onChange={(e) => setLifeFactsConfig({ showOwnFacts: e.target.checked })}
              />
              <span>👤 Person's Own Facts</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={lifeFactsConfig.showParentsFacts}
                onChange={(e) => setLifeFactsConfig({ showParentsFacts: e.target.checked })}
              />
              <span>👨‍👩‍👧 Parents' Facts</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={lifeFactsConfig.showSiblingsFacts}
                onChange={(e) => setLifeFactsConfig({ showSiblingsFacts: e.target.checked })}
              />
              <span>👫 Siblings' Facts</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={lifeFactsConfig.showChildrenFacts}
                onChange={(e) => setLifeFactsConfig({ showChildrenFacts: e.target.checked })}
              />
              <span>👶 Children's Facts</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={lifeFactsConfig.showGrandparentsFacts}
                onChange={(e) => setLifeFactsConfig({ showGrandparentsFacts: e.target.checked })}
              />
              <span>👴 Grandparents' Facts</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={lifeFactsConfig.showSpousesFacts}
                onChange={(e) => setLifeFactsConfig({ showSpousesFacts: e.target.checked })}
              />
              <span>💍 Spouses & Partners</span>
            </label>
          </div>
        </div>

        {/* Checkbox Group 2: Categories to include */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'block' }}>
            2. Fact Categories to Include
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {[
              { type: 'BIRTH', label: '👶 Births & Milestones' },
              { type: 'DEATH', label: '🕯️ Memorials / Passings' },
              { type: 'MARRIAGE', label: '💍 Marriages' },
              { type: 'DIVORCE', label: '💔 Divorces' },
              { type: 'RELATIONSHIP', label: '💞 Relationships' },
              { type: 'GRADUATION', label: '🎓 Education' },
              { type: 'CAREER', label: '💼 Career & Jobs' },
              { type: 'RELOCATION', label: '📍 Relocations' },
              { type: 'TRAVEL', label: '✈️ Journeys & Travels' },
              { type: 'MILITARY', label: '🎖️ Military Service' },
              { type: 'CUSTOM', label: '📝 Custom Stories' },
            ].map((cat) => {
              const isChecked = lifeFactsConfig.includedFactTypes?.includes(cat.type as any);
              return (
                <label key={cat.type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const current = lifeFactsConfig.includedFactTypes || [];
                      const next = e.target.checked
                        ? [...current, cat.type as any]
                        : current.filter((t) => t !== cat.type);
                      setLifeFactsConfig({ includedFactTypes: next });
                    }}
                  />
                  <span>{cat.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 5. Export / Import Tree (CSV) */}
      {/* --------------------------------------------------------------------- */}
      <div style={cardStyle}>
        <div>
          <div style={sectionTitleStyle}>
            <span>📁</span> Export & Import Family Tree (.csv)
          </div>
          <div style={sectionSubtextStyle}>
            Backup your genealogical tree or restore persons, unions, and child relationships from a standardized CSV spreadsheet.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Export Section */}
          <div
            style={{
              background: 'var(--nav-tab-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              📤 Export Current Tree
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Download all <strong>{graphData?.persons?.length || 0} persons</strong> and <strong>{graphData?.unions?.length || 0} family unions</strong> as a comma-separated CSV file.
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
              <button
                type="button"
                onClick={handleExportCSV}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                }}
              >
                📥 Export Tree to CSV
              </button>

              <button
                type="button"
                onClick={handleDownloadSample}
                style={{
                  background: 'var(--card-bg-solid)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="Download sample template CSV"
              >
                📄 Sample CSV
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div
            style={{
              background: 'var(--nav-tab-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              📥 Import Tree from CSV
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Select a <code>.csv</code> file or paste CSV content below to import members and unions into this tree.
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'var(--card-bg-solid)',
                  border: '1px dashed var(--primary-color, #6366f1)',
                  color: 'var(--text-primary)',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                📂 Choose .CSV File
              </button>
            </div>

            {/* Import Status / Preview */}
            {importStatusMessage && (
              <div
                style={{
                  fontSize: 12,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background:
                    importStatusType === 'success'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : importStatusType === 'error'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(99, 102, 241, 0.15)',
                  color:
                    importStatusType === 'success'
                      ? '#10b981'
                      : importStatusType === 'error'
                      ? '#ef4444'
                      : 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {importStatusMessage}
              </div>
            )}

            {importStats && importStats.personsCount > 0 && (
              <button
                type="button"
                disabled={isImporting}
                onClick={handleExecuteImport}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: 'auto',
                }}
              >
                {isImporting ? 'Importing...' : `Confirm Import (${importStats.personsCount} persons, ${importStats.unionsCount} unions)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
