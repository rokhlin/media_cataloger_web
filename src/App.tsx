import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import ExecutionControls from './components/ExecutionControls';
import InputSourcesGallery, { type GalleryMediaFile } from './components/InputSourcesGallery';
import FaceRegistry, {
  type FaceRegistryFace,
  type FaceRegistryPerson,
  type FaceRegistryGroup,
} from './components/FaceRegistry';
import PipelineLogs from './components/PipelineLogs';
import SettingsModal, { type SettingsTab } from './components/SettingsModal';
import { FamilyTreeTab, setTreeStore } from './packages/family-tree/index.js';
import type { StatusInfo, SettingsData, UISettings } from './models';
import './App.css';

function App() {
  const [statusInfo, setStatusInfo] = useState<StatusInfo>({
    status: 'checking',
    current_task: null,
    error: null,
    progress: null,
  });
  const [logsList, setLogsList] = useState<string[]>([]);
  const [faces, setFaces] = useState<Array<{ face_id: string; name?: string }>>([]);
  const [persons, setPersons] = useState<FaceRegistryPerson[]>([]);
  const [unrecognizedFaces, setUnrecognizedFaces] = useState<FaceRegistryFace[]>([]);
  const [unrecognizedGroups, setUnrecognizedGroups] = useState<FaceRegistryGroup[]>([]);
  const [facesLoading, setFacesLoading] = useState(false);
  const [facesError, setFacesError] = useState<string | null>(null);

  // Media files from input sources
  const [mediaFiles, setMediaFiles] = useState<GalleryMediaFile[]>([]);
  const [isMediaLoading, setIsMediaLoading] = useState(false);

  // Tab navigation: 'main' (Sources / Gallery) or 'media_library' (Face Registry & Controls)
  const [activeTab, setActiveTab] = useState<'main' | 'media_library' | string>('main');

  // Logs visibility: hidden by default
  const [showLogs, setShowLogs] = useState(false);

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('execution');
  const [pickerPending, setPickerPending] = useState(false);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);

  // UI preferences loaded from localStorage
  const [uiSettings, setUiSettings] = useState<UISettings>(() => {
    try {
      const saved = localStorage.getItem('media_cataloger_ui_settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse uiSettings from localStorage:', e);
    }
    return {
      maxImagesPerRow: 10,
      maxRows: 1,
      maxWidth: 1600,
      galleryMaxRows: 10,
    };
  });

  const handleSaveUiSettings = useCallback((newSettings: UISettings) => {
    setUiSettings(newSettings);
    try {
      localStorage.setItem('media_cataloger_ui_settings', JSON.stringify(newSettings));
    } catch (e) {
      console.warn('Failed to save uiSettings to localStorage:', e);
    }
  }, []);

  const statusRef = useRef(statusInfo.status);

  useEffect(() => {
    statusRef.current = statusInfo.status;
  }, [statusInfo.status]);

  const appendConsoleMessage = useCallback((message: string) => {
    const timeStr = new Date().toLocaleTimeString();
    setLogsList((prev) => [...prev, `[${timeStr}] ${message}`]);
  }, []);

  // Fetch logs
  const fetchLogsInternal = useCallback(async () => {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        if (data.logs) {
          const lines = (data.logs as string).split('\n').filter((l) => l.length > 0);
          setLogsList(lines);
        }
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  }, []);

  // Fetch live system status
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatusInfo(data);
        if (data.status === 'running' || data.status === 'paused') {
          // Auto-poll logs when running or paused
          fetchLogsInternal();
        }
      }
    } catch (err) {
      console.error('Error checking status:', err);
    }
  }, [fetchLogsInternal]);

  const handleRefreshLogs = async () => {
    setIsRefreshingLogs(true);
    await fetchLogsInternal();
    setIsRefreshingLogs(false);
  };

  const handleClearLogs = useCallback(async () => {
    try {
      await fetch('/api/logs/clear', { method: 'POST' });
    } catch (err) {
      console.error('Failed to clear logs on server:', err);
    }
    setLogsList([]);
  }, []);

  // Load media files from input sources
  const loadMediaFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/media/files');
      if (res.ok) {
        const data = await res.json();
        setMediaFiles(data.files || []);
      }
    } catch (err) {
      console.error('Error loading media files:', err);
    } finally {
      setIsMediaLoading(false);
    }
  }, []);

  // Load face registry, persons, unrecognized faces and groups
  const loadFaces = useCallback(async () => {
    try {
      const [resFaces, resPersons, resUnrec, resGroups] = await Promise.all([
        fetch('/api/faces'),
        fetch('/api/faces/persons'),
        fetch('/api/faces/unrecognized'),
        fetch('/api/faces/unrecognized-groups'),
      ]);

      if (resFaces.ok) {
        const data = await resFaces.json();
        setFaces(data);
      }
      if (resPersons.ok) {
        const dataPersons = await resPersons.json();
        setPersons(dataPersons);
      }
      if (resUnrec.ok) {
        const dataUnrec = await resUnrec.json();
        setUnrecognizedFaces(dataUnrec);
      }
      if (resGroups.ok) {
        const dataGroups = await resGroups.json();
        setUnrecognizedGroups(dataGroups);
      }
      setFacesError(null);
    } catch (err) {
      console.error('Error loading faces:', err);
      setFacesError('Network error loading faces');
    } finally {
      setFacesLoading(false);
    }
  }, []);

  // Rename face or person
  const handleRenameFace = async (faceId: string, newName: string) => {
    try {
      const res = await fetch('/api/faces/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ face_id: faceId, name: newName }),
      });

      if (res.ok) {
        appendConsoleMessage(`[Face Registry] Renamed ${faceId} to "${newName}"`);
        await loadFaces();
        await loadMediaFiles();
        return true;
      } else {
        const err = await res.json();
        alert(`Error: ${err.detail || 'Could not rename face'}`);
        await loadFaces();
        return false;
      }
    } catch (err) {
      console.error('Error renaming face:', err);
      alert('Network error. Could not rename face.');
      await loadFaces();
      return false;
    }
  };

  // Assign unrecognized face to person
  const handleAssignFace = async (faceId: string, personName: string) => {
    try {
      const res = await fetch('/api/faces/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ face_id: faceId, name: personName }),
      });

      if (res.ok) {
        appendConsoleMessage(`[Face Registry] Assigned ${faceId} to "${personName}" as reference sample`);
        await loadFaces();
        await loadMediaFiles();
        return true;
      } else {
        const err = await res.json();
        alert(`Error: ${err.detail || 'Could not assign face'}`);
        await loadFaces();
        return false;
      }
    } catch (err) {
      console.error('Error assigning face:', err);
      alert('Network error. Could not assign face.');
      await loadFaces();
      return false;
    }
  };

  // Assign group of faces to person
  const handleAssignGroup = async (faceIds: string[], personName: string) => {
    try {
      const res = await fetch('/api/faces/assign-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ face_ids: faceIds, name: personName }),
      });

      if (res.ok) {
        appendConsoleMessage(`[Face Registry] Assigned group of ${faceIds.length} faces to "${personName}"`);
        await loadFaces();
        await loadMediaFiles();
        return true;
      } else {
        const err = await res.json();
        alert(`Error: ${err.detail || 'Could not assign face group'}`);
        await loadFaces();
        return false;
      }
    } catch (err) {
      console.error('Error assigning group:', err);
      alert('Network error. Could not assign face group.');
      await loadFaces();
      return false;
    }
  };

  // Reset face assignment
  const handleResetFace = async (faceId: string) => {
    try {
      const res = await fetch('/api/faces/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ face_id: faceId }),
      });

      if (res.ok) {
        appendConsoleMessage(`[Face Registry] Reset assignment for face ${faceId}`);
        await loadFaces();
        await loadMediaFiles();
        return true;
      } else {
        const err = await res.json();
        alert(`Error: ${err.detail || 'Could not reset face'}`);
        await loadFaces();
        return false;
      }
    } catch (err) {
      console.error('Error resetting face:', err);
      alert('Network error. Could not reset face.');
      await loadFaces();
      return false;
    }
  };

  // Reset faces by filename
  const handleResetFacesByFilename = async (filename: string) => {
    try {
      const res = await fetch('/api/faces/reset-by-filename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });

      const data = await res.json();
      if (res.ok) {
        appendConsoleMessage(`[Face Registry] Reset ${data.reset_count || 0} faces for file "${filename}"`);
        await loadFaces();
        await loadMediaFiles();
        alert(`Successfully reset ${data.reset_count || 0} face assignment(s) for "${filename}".`);
        return true;
      } else {
        alert(`Error: ${data.detail || 'Could not reset faces by filename'}`);
        await loadFaces();
        return false;
      }
    } catch (err) {
      console.error('Error resetting faces by filename:', err);
      alert('Network error. Could not reset faces by filename.');
      await loadFaces();
      return false;
    }
  };

  // Delete face
  const handleDeleteFace = async (faceId: string) => {
    try {
      const res = await fetch('/api/faces/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ face_id: faceId }),
      });

      if (res.ok) {
        appendConsoleMessage(`[Face Registry] Deleted face ${faceId}`);
        await loadFaces();
        await loadMediaFiles();
        return true;
      } else {
        const err = await res.json();
        alert(`Error: ${err.detail || 'Could not delete face'}`);
        await loadFaces();
        return false;
      }
    } catch (err) {
      console.error('Error deleting face:', err);
      alert('Network error. Could not delete face.');
      await loadFaces();
      return false;
    }
  };

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  }, []);

  // Save settings
  const handleSaveSettings = async (settingsPayload: SettingsData) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsPayload),
      });

      const data = await res.json();
      if (res.ok) {
        appendConsoleMessage(`[Settings] Dynamic paths updated successfully: ${data.message || 'Saved'}`);
        await loadSettings();
        await loadMediaFiles();
        return true;
      } else {
        alert(`Error: ${data.detail || 'Failed to update settings'}`);
        await loadSettings();
        return false;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`Network error. Could not update settings: ${message}`);
      await loadSettings();
      return false;
    }
  };

  // Pick folder
  const handlePickFolder = async () => {
    setPickerPending(true);
    try {
      const res = await fetch('/api/select-folder', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        return (data.folder as string) || '';
      } else {
        const err = await res.json();
        alert(`Picker error: ${err.detail || 'Failed to select folder'}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`Network error: ${message}`);
    } finally {
      setPickerPending(false);
    }
    return '';
  };

  // Pick single file
  const handlePickFile = async () => {
    setPickerPending(true);
    try {
      const res = await fetch('/api/select-file', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        return (data.file as string) || '';
      } else {
        const err = await res.json();
        alert(`Picker error: ${err.detail || 'Failed to select file'}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`Network error: ${message}`);
    } finally {
      setPickerPending(false);
    }
    return '';
  };

  // Start Sync
  const handleStartSync = async (force: boolean) => {
    try {
      const res = await fetch(`/api/run?force=${Boolean(force)}`, { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        const countMsg = result.provided_files_count !== undefined ? ` (${result.provided_files_count} files sent to backend)` : '';
        appendConsoleMessage(`[API] Triggered sync successfully: ${result.message || 'Started'}${countMsg}`);
        checkStatus();
      } else {
        const errMsg = result.message || result.detail || result.error || 'Failed to start sync';
        appendConsoleMessage(`[API Error] Failed to run sync: ${errMsg}`);
        alert(`Could not start cataloging sync:\n${errMsg}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      appendConsoleMessage(`[Network Error] Connection failed: ${message}`);
      alert(`Network error connecting to server: ${message}`);
    }
  };

  // Pause Sync
  const handlePauseSync = async () => {
    try {
      const res = await fetch('/api/pause', { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        appendConsoleMessage(`[API] Execution paused: ${result.message || 'Paused'}`);
        checkStatus();
      } else {
        appendConsoleMessage(`[API Error] Failed to pause: ${result.message || result.detail || 'Error'}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      appendConsoleMessage(`[Network Error] Connection failed: ${message}`);
    }
  };

  // Resume Sync
  const handleResumeSync = async () => {
    try {
      const res = await fetch('/api/resume', { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        appendConsoleMessage(`[API] Execution resumed: ${result.message || 'Resumed'}`);
        checkStatus();
      } else {
        appendConsoleMessage(`[API Error] Failed to resume: ${result.message || result.detail || 'Error'}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      appendConsoleMessage(`[Network Error] Connection failed: ${message}`);
    }
  };

  // Stop Sync
  const handleStopSync = async () => {
    try {
      const res = await fetch('/api/stop', { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        appendConsoleMessage(`[API] Stop requested: ${result.message || 'Stopping'}`);
        checkStatus();
      } else {
        appendConsoleMessage(`[API Error] Failed to stop: ${result.message || result.detail || 'Error'}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      appendConsoleMessage(`[Network Error] Connection failed: ${message}`);
    }
  };

  // Start Single Analysis
  const handleStartSingleAnalysis = async (file: string, onSuccess?: () => void) => {
    try {
      const res = await fetch(`/api/analyze-file?file=${encodeURIComponent(file)}`, {
        method: 'POST',
      });
      const result = await res.json();
      if (res.ok) {
        appendConsoleMessage(`[API] Triggered file analysis successfully: ${result.message || 'Started'}`);
        if (onSuccess) onSuccess();
        checkStatus();
      } else {
        const errMsg = result.message || result.detail || result.error || 'Failed to start file analysis';
        appendConsoleMessage(`[API Error] Failed to start analysis: ${errMsg}`);
        alert(`Analysis Error:\n${errMsg}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      appendConsoleMessage(`[Network Error] Connection failed: ${message}`);
      alert(`Network error connecting to server: ${message}`);
    }
  };

  // Initial load
  useEffect(() => {
    checkStatus();
    loadSettings();
    loadFaces();
    loadMediaFiles();
    fetchLogsInternal();

    // Poll status every 2 seconds
    const statusInterval = setInterval(() => {
      checkStatus();
    }, 2000);

    // Poll face registry and media files every 10 seconds when idle
    const facesInterval = setInterval(() => {
      if (statusRef.current !== 'running' && statusRef.current !== 'paused') {
        loadFaces();
        loadMediaFiles();
      }
    }, 10000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(facesInterval);
    };
  }, [checkStatus, loadSettings, loadFaces, loadMediaFiles, fetchLogsInternal]);

  // Navigate to Family Tree and focus on person
  const handleViewInFamilyTree = useCallback((personName: string, personId?: string) => {
    setActiveTab('family_tree');
    if (personId) {
      setTreeStore({
        selectedPersonId: personId,
        highlightedPersonId: personId,
        isDetailDrawerOpen: true,
        drawerActiveTab: 'bio',
      });
    } else if (personName) {
      setTreeStore({
        searchQuery: personName,
      });
    }
  }, []);

  const isRunning = statusInfo.status === 'running';
  const isPaused = statusInfo.status === 'paused';

  return (
    <div
      className="app-container"
      style={{ '--max-dashboard-width': `${uiSettings.maxWidth || 1600}px` } as React.CSSProperties}
    >
      <Header
        statusInfo={statusInfo}
        onOpenSettings={() => {
          setSettingsTab('execution');
          setIsSettingsOpen(true);
        }}
        onOpenAppearanceSettings={() => {
          setSettingsTab('appearance');
          setIsSettingsOpen(true);
        }}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        showLogs={showLogs}
        onToggleLogs={() => setShowLogs((prev) => !prev)}
      />

      <main className="app-main-content">
        {activeTab === 'main' && (
          <div className="tab-pane active" id="pane-main">
            <InputSourcesGallery
              mediaFiles={mediaFiles}
              isLoading={isMediaLoading}
              onRefresh={loadMediaFiles}
              onStartSingleAnalysis={handleStartSingleAnalysis}
              onSwitchToControls={() => setActiveTab('media_library')}
              persons={persons}
              uiSettings={uiSettings}
              disabled={isRunning || isPaused}
              onReloadFaces={loadFaces}
              onViewInFamilyTree={handleViewInFamilyTree}
            />
          </div>
        )}

        {activeTab === 'media_library' && (
          <div className="tab-pane active media-library-layout" id="pane-media-library">
            <FaceRegistry
              faces={faces}
              persons={persons}
              unrecognizedFaces={unrecognizedFaces}
              unrecognizedGroups={unrecognizedGroups}
              isLoading={facesLoading}
              error={facesError}
              onRenameFace={handleRenameFace}
              onAssignFace={handleAssignFace}
              onAssignGroup={handleAssignGroup}
              onResetFace={handleResetFace}
              onResetFacesByFilename={handleResetFacesByFilename}
              onDeleteFace={handleDeleteFace}
              disabled={isRunning || isPaused}
              uiSettings={uiSettings}
              onViewInFamilyTree={handleViewInFamilyTree}
            />

            <ExecutionControls
              isRunning={isRunning}
              isPaused={isPaused}
              currentTask={statusInfo.current_task}
              onStartSync={handleStartSync}
              onPauseSync={handlePauseSync}
              onResumeSync={handleResumeSync}
              onStopSync={handleStopSync}
              onStartSingleAnalysis={handleStartSingleAnalysis}
              onPickSingleFile={handlePickFile}
              pickerPending={pickerPending}
            />
          </div>
        )}

        {activeTab === 'family_tree' && (
          <div
            className="tab-pane active"
            id="pane-family-tree"
            style={{ width: '100%', height: 'calc(100vh - 120px)', minHeight: 650, position: 'relative' }}
          >
            <FamilyTreeTab />
          </div>
        )}
      </main>

      <PipelineLogs
        isOpen={showLogs}
        onClose={() => setShowLogs(false)}
        logs={logsList}
        onRefreshLogs={handleRefreshLogs}
        onClearLogs={handleClearLogs}
        isRefreshing={isRefreshingLogs}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onPickFolder={handlePickFolder}
        isRunning={isRunning}
        isPaused={isPaused}
        currentTask={statusInfo.current_task}
        onStartSync={handleStartSync}
        onPauseSync={handlePauseSync}
        onResumeSync={handleResumeSync}
        onStopSync={handleStopSync}
        onStartSingleAnalysis={handleStartSingleAnalysis}
        onPickSingleFile={handlePickFile}
        pickerPending={pickerPending}
        uiSettings={uiSettings}
        onSaveUiSettings={handleSaveUiSettings}
        initialTab={settingsTab}
      />
    </div>
  );
}

export default App;
