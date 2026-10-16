import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  HardDrive,
  Sparkles,
  ShieldCheck,
  Lock,
  ChevronDown,
  ChevronUp,
  Save,
  Folder,
  Plus,
  Trash2,
  Cpu,
  Eye,
  EyeOff,
  CheckCircle2,
  RefreshCw,
  Server,
  Video,
  Play,
  Scissors,
  RotateCcw,
  Sliders,
  Film,
  Crop,
  RotateCw,
  ZoomIn,
  FolderLock,
  KeyRound,
  Mail,
  Languages,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../services/authContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { useVault } from '@/services/vaultContext';

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const UserSettingsScreen: React.FC = () => {
  const { currentUser, authFetch, refreshProfile } = useAuth();
  const [expandedSection, setExpandedSection] = useState<string | null>('account');
  const [configuredFolders, setConfiguredFolders] = useState<string[]>([]);
  const [newFolderInput, setNewFolderInput] = useState('');

  // Account profile state
  const [username, setUsername] = useState(() => currentUser?.displayName || currentUser?.username || '');
  const [email, setEmail] = useState(() => currentUser?.email || '');
  const [avatarUrl, setAvatarUrl] = useState(() => currentUser?.avatarUrl || '');
  const [avatarType, setAvatarType] = useState<'image' | 'video'>(() => currentUser?.avatarType || 'image');
  const [avatarVideoUrl, setAvatarVideoUrl] = useState(() => currentUser?.avatarVideoUrl || '');
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);

  // Photo Avatar Cropping Modal State
  const [photoCropModalOpen, setPhotoCropModalOpen] = useState(false);
  const [, setSelectedPhotoFile] = useState<File | null>(null);
  const [selectedPhotoObjectUrl, setSelectedPhotoObjectUrl] = useState<string | null>(null);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoPanX, setPhotoPanX] = useState(0);
  const [photoPanY, setPhotoPanY] = useState(0);
  const [photoRotation, setPhotoRotation] = useState(0);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const photoImageRef = useRef<HTMLImageElement | null>(null);

  // Video Avatar Trimming Modal State
  const [trimModalOpen, setTrimModalOpen] = useState(false);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [selectedVideoObjectUrl, setSelectedVideoObjectUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimDuration, setTrimDuration] = useState(4); // 3 to 10 seconds loop
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // AI Configuration
  const [aiProvider, setAiProvider] = useState<'gemini' | 'local'>('gemini');
  const [aiModel, setAiModel] = useState<'gemini-3.8-flash' | 'gemini-3.1-pro-preview' | 'local-model' | string>('gemini-3.8-flash');
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiFaceClustering, setAiFaceClustering] = useState(true);
  const [aiClipSearch, setAiClipSearch] = useState(true);
  const [aiOcrRecognition, setAiOcrRecognition] = useState(true);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [maxWorkers, setMaxWorkers] = useState(3);
  const [visionPromptTemplate, setVisionPromptTemplate] = useState('');
  const [defaultVisionPromptTemplate, setDefaultVisionPromptTemplate] = useState('');
  const [folderStatus, setFolderStatus] = useState<string | null>(null);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [pipelineFeedback, setPipelineFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Storage Telemetry State
  const [storageTelemetry, setStorageTelemetry] = useState<{
    totalDiskBytes: number;
    freeDiskBytes: number;
    usedDiskBytes: number;
    photosBytes: number;
    photosCount: number;
    videosBytes: number;
    videosCount: number;
    databaseBytes: number;
    cacheBytes: number;
  } | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);

  // LM Studio Local Models state
  const [localModels, setLocalModels] = useState<Array<{
    id: string;
    name: string;
    isVision: boolean;
    isLoaded: boolean;
    arch?: string;
    size?: string;
    params?: string;
  }>>([]);
  const [loadingLocalModels, setLoadingLocalModels] = useState(false);
  const [localModelsError, setLocalModelsError] = useState<string | null>(null);
  const [isLmStudioConnected, setIsLmStudioConnected] = useState<boolean | null>(null);
  const [isCustomLocalModel, setIsCustomLocalModel] = useState(false);
  const [loadingModelIntoRam, setLoadingModelIntoRam] = useState(false);
  const [preloadStatus, setPreloadStatus] = useState<string | null>(null);

  // Password change state
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPasswordUpdating, setIsPasswordUpdating] = useState(false);

  // System language
  const { language, setLanguage } = useLanguage();

  // Vault context and settings state
  const {
    isConfigured: isVaultConfigured,
    isUnlocked: isVaultUnlocked,
    remainingSeconds: vaultRemainingSeconds,
    changePin: changeVaultPin,
    requestPinRecovery: requestVaultRecovery,
    resetPinWithRecovery: resetVaultPinWithRecovery,
    fetchVaultStatus,
  } = useVault();

  const [vaultCurrentPin, setVaultCurrentPin] = useState('');
  const [vaultNewPin, setVaultNewPin] = useState('');
  const [vaultConfirmPin, setVaultConfirmPin] = useState('');
  const [vaultPinStatus, setVaultPinStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isVaultPinUpdating, setIsVaultPinUpdating] = useState(false);

  const [vaultRecoveryEmailInput, setVaultRecoveryEmailInput] = useState('');
  const [vaultRecoveryCodeInput, setVaultRecoveryCodeInput] = useState('');
  const [vaultRecoveryNewPinInput, setVaultRecoveryNewPinInput] = useState('');
  const [vaultRecoveryConfirmPinInput, setVaultRecoveryConfirmPinInput] = useState('');
  const [vaultRecoveryStep, setVaultRecoveryStep] = useState<'request' | 'reset'>('request');
  const [vaultRecoveryStatus, setVaultRecoveryStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isVaultRecoveryLoading, setIsVaultRecoveryLoading] = useState(false);

  // Sync profile when currentUser updates
  useEffect(() => {
    if (currentUser) {
      setUsername(currentUser.displayName || currentUser.username || '');
      setEmail(currentUser.email || '');
      setAvatarUrl(currentUser.avatarUrl || '');
      setAvatarType(currentUser.avatarType || 'image');
      setAvatarVideoUrl(currentUser.avatarVideoUrl || '');
    }
  }, [currentUser]);

  // Fetch settings & storage telemetry on mount
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.input_folders)) {
          setConfiguredFolders(data.input_folders);
        }
        if (data?.gemini_api_key) {
          setGeminiApiKey(data.gemini_api_key);
        }
        const prov = data?.model_provider || data?.ai_provider;
        if (prov) {
          setAiProvider(prov);
        }
        const mod = data?.gemini_model || data?.local_model_name || data?.ai_model;
        if (mod) {
          setAiModel(mod);
        }
        if (data?.gemini_max_workers) {
          setMaxWorkers(Number(data.gemini_max_workers));
        }
        if (data?.vision_prompt_template) {
          setVisionPromptTemplate(data.vision_prompt_template);
        }
        if (data?.default_vision_prompt_template) {
          setDefaultVisionPromptTemplate(data.default_vision_prompt_template);
        }
      })
      .catch(() => {});

    fetchStorageTelemetry();
  }, []);

  const fetchStorageTelemetry = useCallback(async () => {
    setLoadingStorage(true);
    try {
      const res = await authFetch('/api/storage/telemetry');
      if (res.ok) {
        const data = await res.json();
        setStorageTelemetry({
          totalDiskBytes: data.disk?.total ?? data.totalDiskBytes ?? 0,
          freeDiskBytes: data.disk?.free ?? data.freeDiskBytes ?? 0,
          usedDiskBytes: data.disk?.used ?? data.usedDiskBytes ?? 0,
          photosBytes: data.breakdown?.photos?.bytes ?? data.photosBytes ?? 0,
          photosCount: data.breakdown?.photos?.count ?? data.photosCount ?? 0,
          videosBytes: data.breakdown?.videos?.bytes ?? data.videosBytes ?? 0,
          videosCount: data.breakdown?.videos?.count ?? data.videosCount ?? 0,
          databaseBytes: data.breakdown?.database?.bytes ?? data.databaseBytes ?? 0,
          cacheBytes: data.breakdown?.cacheAndThumbnails?.bytes ?? data.cacheBytes ?? 0,
        });
      }
    } catch (e) {
      console.warn('Failed to fetch storage telemetry:', e);
    } finally {
      setLoadingStorage(false);
    }
  }, [authFetch]);

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
    if (id === 'storage' && !storageTelemetry) {
      fetchStorageTelemetry();
    }
  };

  const handleSaveAccount = async () => {
    setSavingAccount(true);
    setAccountStatus(null);
    try {
      const res = await authFetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: username.trim(),
          email: email.trim(),
          avatarUrl: avatarUrl.trim(),
          avatarType,
          avatarVideoUrl: avatarVideoUrl.trim(),
        }),
      });

      if (res.ok) {
        await refreshProfile();
        localStorage.setItem('user_avatar_url', avatarUrl.trim());
        window.dispatchEvent(
          new CustomEvent('user_avatar_updated', {
            detail: {
              avatarUrl: avatarUrl.trim(),
              avatarType,
              avatarVideoUrl: avatarVideoUrl.trim(),
            },
          })
        );
        setAccountStatus('Профиль и резервная почта успешно сохранены в базе данных');
      } else {
        const err = await res.json().catch(() => ({}));
        setAccountStatus(`Ошибка сохранения: ${err.message || 'сервер отклонил запрос'}`);
      }
    } catch (err: any) {
      setAccountStatus(`Ошибка сети: ${err.message || 'не удалось связаться с сервером'}`);
    } finally {
      setSavingAccount(false);
      setTimeout(() => setAccountStatus(null), 4000);
    }
  };

  const handlePhotoFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите файл изображения (JPEG, PNG, WebP)');
      return;
    }
    if (selectedPhotoObjectUrl) {
      URL.revokeObjectURL(selectedPhotoObjectUrl);
    }
    const url = URL.createObjectURL(file);
    setSelectedPhotoFile(file);
    setSelectedPhotoObjectUrl(url);
    setPhotoZoom(1);
    setPhotoPanX(0);
    setPhotoPanY(0);
    setPhotoRotation(0);
    setPhotoCropModalOpen(true);
    e.target.value = '';
  };

  const handleConfirmCropAndUpload = async () => {
    if (!selectedPhotoObjectUrl) return;
    setIsUploadingPhoto(true);

    try {
      const img = new Image();
      img.src = selectedPhotoObjectUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image for cropping'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context');

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 512, 512);

      ctx.save();
      ctx.translate(256, 256);
      ctx.rotate((photoRotation * Math.PI) / 180);
      ctx.scale(photoZoom, photoZoom);

      const aspect = img.width / img.height;
      let drawW = 512;
      let drawH = 512;
      if (aspect > 1) {
        drawW = 512 * aspect;
        drawH = 512;
      } else {
        drawW = 512;
        drawH = 512 / aspect;
      }

      ctx.drawImage(img, -drawW / 2 + photoPanX, -drawH / 2 + photoPanY, drawW, drawH);
      ctx.restore();

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Canvas export failed');

      const formData = new FormData();
      formData.append('photo', blob, 'avatar.jpg');

      const res = await authFetch('/api/auth/avatar-photo', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const newUrl = data.avatarUrl;
        setAvatarUrl(newUrl);
        setAvatarType('image');
        setPhotoCropModalOpen(false);

        await authFetch('/api/auth/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            avatarType: 'image',
            avatarUrl: newUrl,
          }),
        });

        await refreshProfile();
        localStorage.setItem('user_avatar_url', newUrl);
        window.dispatchEvent(
          new CustomEvent('user_avatar_updated', {
            detail: { avatarType: 'image', avatarUrl: newUrl },
          })
        );
        setAccountStatus('Фото-аватар успешно обрезан, загружен и сохранён!');
        setTimeout(() => setAccountStatus(null), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Ошибка загрузки: ${err.message || 'сервер отклонил загрузку фотографии'}`);
      }
    } catch (err: any) {
      alert(`Ошибка обрезки фото: ${err.message}`);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleTriggerAnalysis = async (force: boolean) => {
    const modes: string[] = [];
    if (aiFaceClustering) modes.push('faces');
    if (aiClipSearch || aiOcrRecognition) modes.push('vision');

    if (modes.length === 0) {
      alert('Пожалуйста, выберите хотя бы один модуль анализа (Кластеризация лиц, Семантический поиск или OCR).');
      return;
    }

    setIsRunningPipeline(true);
    setPipelineFeedback(null);
    try {
      const res = await authFetch(`/api/run?force=${force}&modes=${encodeURIComponent(modes.join(','))}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modes,
          force,
          ocr: aiOcrRecognition,
          vision: aiClipSearch || aiOcrRecognition,
          faces: aiFaceClustering,
        }),
      });

      if (res.ok) {
        setPipelineFeedback({
          type: 'success',
          message: force
            ? `Запущен полный переанализ всех файлов (${modes.join(', ')}). Обработка выполняется в фоновом режиме.`
            : `Запущен выборочный анализ файлов без метаданных (${modes.join(', ')}). Обработка выполняется в фоновом режиме.`,
        });
      } else {
        const err = await res.json().catch(() => ({}));
        setPipelineFeedback({
          type: 'error',
          message: err.message || 'Ошибка запуска конвейера анализа',
        });
      }
    } catch (e: any) {
      setPipelineFeedback({
        type: 'error',
        message: e.message || 'Ошибка сети при запуске анализа',
      });
    } finally {
      setIsRunningPipeline(false);
      setTimeout(() => setPipelineFeedback(null), 8000);
    }
  };

  const handleVideoFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      alert('Пожалуйста, выберите видеофайл (MP4, WebM, MOV)');
      return;
    }
    const url = URL.createObjectURL(file);
    setSelectedVideoFile(file);
    setSelectedVideoObjectUrl(url);
    setTrimStart(0);
    setTrimDuration(4);
    setTrimModalOpen(true);
  };

  const handleConfirmTrimAndUpload = async () => {
    if (!selectedVideoFile) return;
    setIsUploadingVideo(true);
    try {
      const formData = new FormData();
      formData.append('video', selectedVideoFile);
      formData.append('startTime', String(trimStart));
      formData.append('duration', String(trimDuration));

      const res = await authFetch('/api/auth/avatar-video', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setAvatarVideoUrl(data.videoUrl);
        setAvatarType('video');
        setTrimModalOpen(false);

        // Auto-save to database profile
        await authFetch('/api/auth/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            avatarType: 'video',
            avatarVideoUrl: data.videoUrl,
          }),
        });

        await refreshProfile();
        window.dispatchEvent(
          new CustomEvent('user_avatar_updated', {
            detail: { avatarType: 'video', avatarVideoUrl: data.videoUrl },
          })
        );
        setAccountStatus('Видео-аватар успешно загружен и зациклен!');
        setTimeout(() => setAccountStatus(null), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Ошибка загрузки: ${err.message || 'не удалось загрузить видео'}`);
      }
    } catch (err: any) {
      alert(`Ошибка сети: ${err.message}`);
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handlePlayLoopPreview = () => {
    if (!videoPreviewRef.current) return;
    const vid = videoPreviewRef.current;
    vid.currentTime = trimStart;
    vid.play();

    const checkTime = () => {
      if (vid.currentTime >= trimStart + trimDuration) {
        vid.currentTime = trimStart;
      }
    };
    vid.ontimeupdate = checkTime;
  };

  const handleAddFolder = () => {
    const trimmed = newFolderInput.trim();
    if (trimmed && !configuredFolders.includes(trimmed)) {
      setConfiguredFolders([...configuredFolders, trimmed]);
      setNewFolderInput('');
    }
  };

  const handleRemoveFolder = (folder: string) => {
    setConfiguredFolders(configuredFolders.filter((f) => f !== folder));
  };

  const handleSaveFolders = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('media_cataloger_jwt_token')
            ? { Authorization: `Bearer ${localStorage.getItem('media_cataloger_jwt_token')}` }
            : {}),
        },
        body: JSON.stringify({ input_folders: configuredFolders }),
      });
      if (res.ok) {
        setFolderStatus('Папки и источники сохранены');
      } else {
        setFolderStatus('Ошибка при сохранении папок');
      }
    } catch {
      setFolderStatus('Каталоги сохранены локально');
    }
    setTimeout(() => setFolderStatus(null), 3000);
  };

  const fetchLocalModels = useCallback(async () => {
    setLoadingLocalModels(true);
    setLocalModelsError(null);
    try {
      const res = await fetch('/api/models/local', {
        headers: localStorage.getItem('media_cataloger_jwt_token')
          ? { Authorization: `Bearer ${localStorage.getItem('media_cataloger_jwt_token')}` }
          : {},
      });
      if (res.ok) {
        const data = await res.json();
        setIsLmStudioConnected(Boolean(data?.connected));
        if (data && Array.isArray(data.models)) {
          setLocalModels(data.models);
          if (data.activeModel && (!aiModel || aiModel === 'local-model')) {
            setAiModel(data.activeModel);
          } else if (data.models.length > 0 && (!aiModel || aiModel === 'local-model')) {
            const loadedModel = data.models.find((m: any) => m.isLoaded);
            setAiModel(loadedModel ? loadedModel.id : data.models[0].id);
          }
        }
      } else {
        setIsLmStudioConnected(false);
        setLocalModelsError('LM Studio сервер не отвечает (проверьте порт :1234)');
      }
    } catch {
      setIsLmStudioConnected(false);
      setLocalModelsError('Не удалось подключиться к LM Studio. Убедитесь, что LM Studio запущен.');
    } finally {
      setLoadingLocalModels(false);
    }
  }, [aiModel]);

  const handleLoadModelIntoRam = async (targetId: string) => {
    if (!targetId || loadingModelIntoRam) return;
    setLoadingModelIntoRam(true);
    setPreloadStatus(`Инициализация загрузки "${targetId}" в RAM LM Studio...`);
    try {
      const res = await fetch('/api/models/local/load', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('media_cataloger_jwt_token')
            ? { Authorization: `Bearer ${localStorage.getItem('media_cataloger_jwt_token')}` }
            : {}),
        },
        body: JSON.stringify({ model_id: targetId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setPreloadStatus(`Модель "${targetId}" успешно загружена в память LM Studio!`);
        fetchLocalModels();
      } else {
        setPreloadStatus(`Ошибка загрузки: ${data?.message || data?.detail || 'Не удалось загрузить модель'}`);
      }
    } catch (err: any) {
      setPreloadStatus(`Ошибка вызова LM Studio: ${err?.message || 'сеть недоступна'}`);
    } finally {
      setLoadingModelIntoRam(false);
      setTimeout(() => setPreloadStatus(null), 5000);
    }
  };

  const handleSaveAi = async () => {
    localStorage.setItem('gemini_api_key', geminiApiKey.trim());
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('media_cataloger_jwt_token')
            ? { Authorization: `Bearer ${localStorage.getItem('media_cataloger_jwt_token')}` }
            : {}),
        },
        body: JSON.stringify({
          gemini_api_key: geminiApiKey.trim(),
          model_provider: aiProvider,
          gemini_model: aiModel,
          local_model_name: aiModel,
          ai_provider: aiProvider,
          ai_model: aiModel,
          gemini_max_workers: maxWorkers,
          vision_prompt_template: visionPromptTemplate.trim(),
        }),
      });
      window.dispatchEvent(new CustomEvent('ai_settings_updated'));
      setAiStatus('Параметры AI, промпт и лимит параллельных потоков сохранены');
    } catch {
      window.dispatchEvent(new CustomEvent('ai_settings_updated'));
      setAiStatus('Параметры AI сохранены локально');
    }
    setTimeout(() => setAiStatus(null), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (!currentPasswordInput) {
      setPasswordStatus({ type: 'error', message: 'Введите текущий пароль' });
      return;
    }
    if (!newPasswordInput || newPasswordInput.length < 4) {
      setPasswordStatus({ type: 'error', message: 'Новый пароль должен содержать минимум 4 символа' });
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordStatus({ type: 'error', message: 'Подтверждение нового пароля не совпадает' });
      return;
    }

    setIsPasswordUpdating(true);
    try {
      const res = await authFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentPasswordInput,
          newPassword: newPasswordInput,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setPasswordStatus({ type: 'success', message: 'Пароль успешно обновлён!' });
        setCurrentPasswordInput('');
        setNewPasswordInput('');
        setConfirmPasswordInput('');
      } else {
        setPasswordStatus({
          type: 'error',
          message: data?.message || (res.status === 400 ? 'Текущий пароль неверен' : 'Ошибка при обновлении пароля'),
        });
      }
    } catch {
      setPasswordStatus({ type: 'error', message: 'Не удалось связаться с сервером' });
    } finally {
      setIsPasswordUpdating(false);
    }
  };

  const insertPromptPlaceholder = (token: string) => {
    setVisionPromptTemplate((prev) => `${prev} ${token} `);
  };

  const handleChangeVaultPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setVaultPinStatus(null);
    if (!vaultCurrentPin) {
      setVaultPinStatus({ type: 'error', message: 'Введите текущий PIN-код' });
      return;
    }
    if (vaultNewPin.length < 4) {
      setVaultPinStatus({ type: 'error', message: 'Новый PIN-код должен содержать минимум 4 цифры' });
      return;
    }
    if (vaultNewPin !== vaultConfirmPin) {
      setVaultPinStatus({ type: 'error', message: 'Подтверждение нового PIN-кода не совпадает' });
      return;
    }
    setIsVaultPinUpdating(true);
    const res = await changeVaultPin(vaultCurrentPin, vaultNewPin);
    setIsVaultPinUpdating(false);
    if (res.success) {
      setVaultPinStatus({ type: 'success', message: 'PIN-код личной папки успешно изменён!' });
      setVaultCurrentPin('');
      setVaultNewPin('');
      setVaultConfirmPin('');
    } else {
      setVaultPinStatus({ type: 'error', message: res.error || 'Неверный текущий PIN-код' });
    }
  };

  const handleVaultRecoveryRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setVaultRecoveryStatus(null);
    if (!vaultRecoveryEmailInput.trim()) {
      setVaultRecoveryStatus({ type: 'error', message: 'Укажите e-mail адрес' });
      return;
    }
    setIsVaultRecoveryLoading(true);
    const res = await requestVaultRecovery(vaultRecoveryEmailInput.trim());
    setIsVaultRecoveryLoading(false);
    if (res.success) {
      setVaultRecoveryStatus({
        type: 'success',
        message: res.message + (res.codeHint ? ` (Код: ${res.codeHint})` : ''),
      });
      setVaultRecoveryStep('reset');
    } else {
      setVaultRecoveryStatus({ type: 'error', message: res.error || 'Не удалось отправить проверочный код' });
    }
  };

  const handleVaultRecoveryReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setVaultRecoveryStatus(null);
    if (!vaultRecoveryCodeInput.trim()) {
      setVaultRecoveryStatus({ type: 'error', message: 'Введите код подтверждения' });
      return;
    }
    if (vaultRecoveryNewPinInput.length < 4) {
      setVaultRecoveryStatus({ type: 'error', message: 'PIN-код должен быть от 4 цифр' });
      return;
    }
    if (vaultRecoveryNewPinInput !== vaultRecoveryConfirmPinInput) {
      setVaultRecoveryStatus({ type: 'error', message: 'Подтверждение PIN-кода не совпадает' });
      return;
    }
    setIsVaultRecoveryLoading(true);
    const res = await resetVaultPinWithRecovery(vaultRecoveryEmailInput.trim(), vaultRecoveryCodeInput.trim(), vaultRecoveryNewPinInput);
    setIsVaultRecoveryLoading(false);
    if (res.success) {
      setVaultRecoveryStatus({ type: 'success', message: 'PIN-код успешно сброшен!' });
      setVaultRecoveryCodeInput('');
      setVaultRecoveryNewPinInput('');
      setVaultRecoveryConfirmPinInput('');
      setVaultRecoveryStep('request');
      fetchVaultStatus();
    } else {
      setVaultRecoveryStatus({ type: 'error', message: res.error || 'Не удалось сбросить PIN-код' });
    }
  };

  const sections = [
    {
      id: 'account',
      title: 'Учётная запись и профиль',
      subtitle: 'Имя пользователя, резервная почта, фото или зацикленный видео-аватар',
      icon: User,
      renderContent: () => (
        <div className="space-y-5 pt-3">
          {accountStatus && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs">
              <CheckCircle2 size={15} />
              <span>{accountStatus}</span>
            </div>
          )}

          {/* Avatar Settings & Preview */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 bg-muted/20 border border-border/70 rounded-2xl">
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-[#23a6f0] to-[#2091f9] text-white font-bold text-2xl flex items-center justify-center overflow-hidden shrink-0 shadow-md border-2 border-primary/30">
              {avatarType === 'video' && avatarVideoUrl ? (
                <video
                  src={avatarVideoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={username}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <span>{(username || 'U').charAt(0).toUpperCase()}</span>
              )}
              {avatarType === 'video' && (
                <span className="absolute bottom-1 right-1 bg-black/70 text-white p-1 rounded-full text-[9px] shadow-xs">
                  <Film size={10} />
                </span>
              )}
            </div>

            <div className="flex-1 space-y-2.5 w-full">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-foreground">Формат аватара:</span>
                <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/50 text-xs">
                  <button
                    type="button"
                    onClick={() => setAvatarType('image')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      avatarType === 'image'
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Фотография
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarType('video')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      avatarType === 'video'
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Film size={12} />
                    <span>Видео (Loop)</span>
                  </button>
                </div>
              </div>

              {avatarType === 'image' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="file"
                      ref={photoInputRef}
                      onChange={handlePhotoFileSelected}
                      accept="image/png,image/jpeg,image/webp,image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
                    >
                      <Crop size={14} />
                      <span>Выбрать локальное фото с обрезкой</span>
                    </button>
                    {avatarUrl && avatarUrl.startsWith('/api/auth/avatar-photo/') && (
                      <span className="text-[11px] text-emerald-500 font-mono">
                        ✓ Локальное фото сохранено
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      Либо укажите прямой URL фотографии:
                    </label>
                    <input
                      type="text"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://example.com/avatar.jpg или /api/auth/avatar-photo/..."
                      className="w-full px-3 py-1.5 bg-muted/40 border border-border/70 rounded-xl text-xs outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={videoInputRef}
                      onChange={handleVideoFileSelected}
                      accept="video/mp4,video/webm,video/quicktime,video/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
                    >
                      <Video size={14} />
                      <span>Выбрать локальное видео для нарезки (3-10 сек)</span>
                    </button>
                    {avatarVideoUrl && (
                      <span className="text-[11px] text-emerald-500 font-mono">
                        ✓ Видео загружено
                      </span>
                    )}
                  </div>
                  {avatarVideoUrl && (
                    <input
                      type="text"
                      value={avatarVideoUrl}
                      onChange={(e) => setAvatarVideoUrl(e.target.value)}
                      placeholder="/api/auth/avatar-video/..."
                      className="w-full px-3 py-1 bg-muted/40 border border-border/70 rounded-xl text-[11px] text-muted-foreground font-mono outline-none"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Имя пользователя / Отображаемое имя
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Резервный адрес электронной почты (Email)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Используется для восстановления доступа и системных уведомлений.
              </p>
            </div>

            {/* Language Selector in User Profile */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Languages size={14} className="text-primary" />
                <span>Язык системы и метаданных (Language)</span>
              </label>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <button
                  type="button"
                  onClick={() => setLanguage('ru')}
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                    language === 'ru'
                      ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/20 shadow-xs'
                      : 'border-border/70 bg-card text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  <span className="text-base">🇷🇺</span>
                  <span>Русский (Russian)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                    language === 'en'
                      ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/20 shadow-xs'
                      : 'border-border/70 bg-card text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  <span className="text-base">🇬🇧</span>
                  <span>English (Английский)</span>
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Переключает язык интерфейса и приоритет отображения двуязычных описаний AI (summary_ru / description_ru).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSaveAccount}
              disabled={savingAccount}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save size={14} className={savingAccount ? 'animate-spin' : ''} />
              <span>{savingAccount ? 'Сохранение...' : 'Сохранить изменения профиля'}</span>
            </button>
          </div>

          {/* Setup Wizard Relocated Card */}
          <div className="mt-6 pt-4 border-t border-border/50">
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Sparkles size={16} className="text-primary" />
                  <span>Мастер начальной настройки системы</span>
                </h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                  Позволяет повторно пройти пошаговое подключение каталогов, выбор провайдера искусственного интеллекта и конфигурацию хранилища.
                </p>
              </div>
              <Link
                to="/onboarding"
                className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs shrink-0"
              >
                Запустить мастер настройки
              </Link>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'ai-features',
      title: 'Искусственный интеллект и распознавание',
      subtitle: 'Провайдеры Gemini и LM Studio, промпт анализа и параллельные воркеры',
      icon: Sparkles,
      renderContent: () => (
        <div className="space-y-5 pt-3">
          {aiStatus && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs">
              <CheckCircle2 size={15} />
              <span>{aiStatus}</span>
            </div>
          )}

          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">
              Основной движок анализа изображений
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setAiProvider('gemini')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  aiProvider === 'gemini'
                    ? 'border-primary bg-primary/10 text-foreground shadow-xs'
                    : 'border-border/70 bg-card hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <Sparkles size={16} className="text-primary" />
                  <span>Google Gemini API (Облачный SOTA)</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Продвинутый мультимодальный анализ через gemini-3.8-flash и gemini-3.1-pro-preview.
                </p>
              </div>

              <div
                onClick={() => setAiProvider('local')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  aiProvider === 'local'
                    ? 'border-primary bg-primary/10 text-foreground shadow-xs'
                    : 'border-border/70 bg-card hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <Cpu size={16} className="text-[#f3cd03]" />
                  <span>Локальная нейросеть (LM Studio)</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Локальная обработка на вашем GPU без отправки данных во внешние сети через LM Studio.
                </p>
              </div>
            </div>
          </div>

          {/* Model Selector & Credentials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              {aiProvider === 'gemini' ? (
                <>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Используемая модель
                  </label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-xs outline-none focus:border-primary"
                  >
                    <option value="gemini-3.8-flash">gemini-3.8-flash (Быстрая, мультимодальная, рекомендуется)</option>
                    <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Глубокий визуальный анализ)</option>
                  </select>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Локальная модель LM Studio
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={fetchLocalModels}
                        disabled={loadingLocalModels}
                        className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={11} className={loadingLocalModels ? 'animate-spin' : ''} />
                        <span>{loadingLocalModels ? 'Запрос...' : 'Обновить'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCustomLocalModel(!isCustomLocalModel)}
                        className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer underline"
                      >
                        {isCustomLocalModel ? 'Список' : 'Вручную'}
                      </button>
                    </div>
                  </div>

                  {isCustomLocalModel ? (
                    <input
                      type="text"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      placeholder="например, qwen2.5-vl-7b-instruct"
                      className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-xs outline-none focus:border-primary font-mono"
                    />
                  ) : (
                    <select
                      value={aiModel}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomLocalModel(true);
                        } else {
                          setAiModel(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-xs outline-none focus:border-primary"
                    >
                      {loadingLocalModels ? (
                        <option disabled>Загрузка моделей из LM Studio...</option>
                      ) : localModels.length === 0 ? (
                        <option value="">
                          {isLmStudioConnected === false
                            ? 'LM Studio недоступен (нажмите Обновить)'
                            : 'Модели не найдены в LM Studio'}
                        </option>
                      ) : (
                        <option value="">-- Выберите модель LM Studio --</option>
                      )}
                      {localModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.isVision ? '👁️ ' : '💬 '}
                          {m.name || m.id}
                          {m.isLoaded ? ' (● В памяти RAM)' : ''}
                        </option>
                      ))}
                      {aiModel && !localModels.some((m) => m.id === aiModel) && (
                        <option value={aiModel}>⚙️ {aiModel}</option>
                      )}
                      <option value="__custom__">✏️ Ввести ID модели вручную...</option>
                    </select>
                  )}

                  <div className="mt-2 flex items-center justify-between text-[11px] min-h-[24px]">
                    {(() => {
                      const selectedModel = localModels.find((m) => m.id === aiModel);
                      if (selectedModel?.isLoaded) {
                        return (
                          <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Активна в оперативной памяти LM Studio
                          </span>
                        );
                      }
                      if (aiModel && aiModel !== 'custom' && aiModel !== '__custom__') {
                        return (
                          <button
                            type="button"
                            onClick={() => handleLoadModelIntoRam(aiModel)}
                            disabled={loadingModelIntoRam}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-lg font-medium cursor-pointer transition-colors disabled:opacity-50"
                          >
                            <Cpu size={12} />
                            <span>{loadingModelIntoRam ? 'Загрузка в память...' : '⚡ Загрузить в RAM LM Studio'}</span>
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </>
              )}
            </div>

            {aiProvider === 'gemini' ? (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Токен / Ключ доступа Gemini API (gemini_api_key)
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full pl-3 pr-9 py-2 bg-muted/40 border border-border/70 rounded-xl text-xs font-mono outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-muted/30 border border-border/60 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <Server size={14} className="text-primary" />
                    Подключение к LM Studio
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      isLmStudioConnected
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : isLmStudioConnected === false
                        ? 'bg-rose-500/15 text-rose-500'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isLmStudioConnected ? 'В сети' : isLmStudioConnected === false ? 'Недоступен' : 'Проверка...'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {isLmStudioConnected
                    ? `LM Studio подключен. Обнаружено моделей: ${localModels.length}.`
                    : 'Запустите LM Studio и включите Local Server на порту 1234.'}
                </p>
                {preloadStatus && (
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="shrink-0" />
                    <span>{preloadStatus}</span>
                  </div>
                )}
                {localModelsError && (
                  <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px]">
                    {localModelsError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Parallel Concurrent Workers Slider */}
          <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Sliders size={14} className="text-primary" />
                <span>Параллельные воркеры анализа (Parallel Concurrent Workers)</span>
              </span>
              <span className="font-mono text-primary font-bold px-2 py-0.5 bg-primary/10 rounded-lg">
                {maxWorkers} {maxWorkers === 1 ? 'поток' : maxWorkers < 5 ? 'потока' : 'потоков'}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={maxWorkers}
              onChange={(e) => setMaxWorkers(Number(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
            <p className="text-[11px] text-muted-foreground">
              Определяет количество одновременных запросов к модели при массовом анализе каталога (рекомендуется 2-4 для соблюдения лимитов).
            </p>
          </div>

          {/* Vision Prompt Template Card */}
          <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles size={14} className="text-primary" />
                <span>Шаблон промпта визуального анализа (Vision Prompt Template)</span>
              </label>
              {defaultVisionPromptTemplate && (
                <button
                  type="button"
                  onClick={() => setVisionPromptTemplate(defaultVisionPromptTemplate)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                  title="Восстановить заводской шаблон"
                >
                  <RotateCcw size={11} />
                  <span>Сбросить по умолчанию</span>
                </button>
              )}
            </div>

            <textarea
              rows={4}
              value={visionPromptTemplate}
              onChange={(e) => setVisionPromptTemplate(e.target.value)}
              placeholder="Опишите детально сцену, объекты, настроение и людей..."
              className="w-full p-3 bg-muted/40 border border-border/70 rounded-xl text-xs font-mono outline-none focus:border-primary resize-y leading-relaxed"
            />

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-muted-foreground font-semibold">Вставить переменные:</span>
              {[
                { token: '{media_type}', label: '{media_type}' },
                { token: '{people}', label: '{people}' },
                { token: '{faces_count}', label: '{faces_count}' },
                { token: '{date}', label: '{date}' },
                { token: '{location}', label: '{location}' },
              ].map((item) => (
                <button
                  key={item.token}
                  type="button"
                  onClick={() => insertPromptPlaceholder(item.token)}
                  className="px-2 py-0.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-[11px] font-mono transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI Feature Toggles */}
          <div className="pt-2 border-t border-border/50 space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={aiFaceClustering}
                onChange={(e) => setAiFaceClustering(e.target.checked)}
                className="rounded text-primary focus:ring-primary"
              />
              <span className="text-foreground font-medium text-xs">
                Кластеризация лиц и распознавание людей на фото и видео
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={aiClipSearch}
                onChange={(e) => setAiClipSearch(e.target.checked)}
                className="rounded text-primary focus:ring-primary"
              />
              <span className="text-foreground font-medium text-xs">
                Семантический поиск по описаниям сцен (CLIP)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={aiOcrRecognition}
                onChange={(e) => setAiOcrRecognition(e.target.checked)}
                className="rounded text-primary focus:ring-primary"
              />
              <span className="text-foreground font-medium text-xs">
                OCR распознавание текста и надписей на изображениях
              </span>
            </label>
          </div>

          {/* Action buttons: Save, Force Re-analyze, and Analyze Only Without Metadata */}
          <div className="pt-3 border-t border-border/50 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSaveAi}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
            >
              <Save size={14} />
              <span>Сохранить параметры AI и промпт</span>
            </button>

            <button
              type="button"
              onClick={() => handleTriggerAnalysis(true)}
              disabled={isRunningPipeline}
              className="flex items-center gap-2 px-4 py-2 border border-rose-500/50 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              title="Принудительно запустить анализ всех медиафайлов заново, перезаписывая существующие метаданные"
            >
              <RefreshCw size={14} className={isRunningPipeline ? 'animate-spin' : ''} />
              <span>Переанализировать все файлы (игнорируя метаданные)</span>
            </button>

            <button
              type="button"
              onClick={() => handleTriggerAnalysis(false)}
              disabled={isRunningPipeline}
              className="flex items-center gap-2 px-4 py-2 border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              title="Запустить анализ только по тем файлам, для которых метаданные еще не сформированы"
            >
              <Sparkles size={14} className={isRunningPipeline ? 'animate-spin' : ''} />
              <span>Анализировать файлы без метаданных</span>
            </button>
          </div>

          {pipelineFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
                pipelineFeedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
              }`}
            >
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{pipelineFeedback.message}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'storage',
      title: 'Квота дискового хранилища',
      subtitle: 'Реальная телеметрия ОС, занятое место и детализация по типам файлов',
      icon: HardDrive,
      renderContent: () => {
        const total = storageTelemetry?.totalDiskBytes || 1;
        const used = storageTelemetry?.usedDiskBytes || 0;
        const free = storageTelemetry?.freeDiskBytes || 0;
        const percentUsed = Math.min(100, Math.max(0, Math.round((used / total) * 100)));

        return (
          <div className="space-y-5 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Фактическое состояние хост-накопителя
              </span>
              <button
                type="button"
                onClick={fetchStorageTelemetry}
                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <RefreshCw size={12} className={loadingStorage ? 'animate-spin' : ''} />
                <span>{loadingStorage ? 'Обновление...' : 'Обновить телеметрию'}</span>
              </button>
            </div>

            {/* Storage Meter Bar */}
            <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-foreground">
                  Занято {formatBytes(used)} из {formatBytes(total)}
                </span>
                <span className="font-mono text-primary font-bold">{percentUsed}%</span>
              </div>

              <div className="w-full h-3 bg-muted/60 rounded-full overflow-hidden flex shadow-inner">
                <div
                  className="h-full bg-[#23a6f0] transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(2, (storageTelemetry?.photosBytes || 0) / total * 100))}%` }}
                  title={`Фотографии: ${formatBytes(storageTelemetry?.photosBytes)}`}
                />
                <div
                  className="h-full bg-[#f3cd03] transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(1, (storageTelemetry?.videosBytes || 0) / total * 100))}%` }}
                  title={`Видеозаписи: ${formatBytes(storageTelemetry?.videosBytes)}`}
                />
                <div
                  className="h-full bg-[#10b981] transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(1, (storageTelemetry?.databaseBytes || 0) / total * 100))}%` }}
                  title={`База данных SQLite: ${formatBytes(storageTelemetry?.databaseBytes)}`}
                />
                <div
                  className="h-full bg-[#a855f7] transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(1, (storageTelemetry?.cacheBytes || 0) / total * 100))}%` }}
                  title={`Кэш миниатюр: ${formatBytes(storageTelemetry?.cacheBytes)}`}
                />
              </div>

              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Свободно на диске: <strong className="text-foreground">{formatBytes(free)}</strong></span>
                <span className="text-[10px] text-muted-foreground/80">Метрика fs.statfs</span>
              </div>
            </div>

            {/* Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 bg-muted/30 border border-border/60 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#23a6f0]" />
                  <span>Фотографии</span>
                </div>
                <div className="text-base font-extrabold text-foreground font-mono">
                  {formatBytes(storageTelemetry?.photosBytes)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {storageTelemetry?.photosCount ?? 0} файлов
                </p>
              </div>

              <div className="p-3.5 bg-muted/30 border border-border/60 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f3cd03]" />
                  <span>Видеозаписи</span>
                </div>
                <div className="text-base font-extrabold text-foreground font-mono">
                  {formatBytes(storageTelemetry?.videosBytes)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {storageTelemetry?.videosCount ?? 0} роликов
                </p>
              </div>

              <div className="p-3.5 bg-muted/30 border border-border/60 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  <span>База данных</span>
                </div>
                <div className="text-base font-extrabold text-foreground font-mono">
                  {formatBytes(storageTelemetry?.databaseBytes)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  .db, WAL и SHM файлы
                </p>
              </div>

              <div className="p-3.5 bg-muted/30 border border-border/60 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" />
                  <span>Кэш миниатюр</span>
                </div>
                <div className="text-base font-extrabold text-foreground font-mono">
                  {formatBytes(storageTelemetry?.cacheBytes)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Оптимизированные превью
                </p>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'sources',
      title: 'Папки и источники медиа',
      subtitle: 'Подключенные локальные и сетевые папки',
      icon: Folder,
      renderContent: () => (
        <div className="space-y-4 pt-3">
          {folderStatus && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs">
              <CheckCircle2 size={15} />
              <span>{folderStatus}</span>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={newFolderInput}
              onChange={(e) => setNewFolderInput(e.target.value)}
              placeholder="C:\Users\Username\Pictures\Photos или /media/nas"
              className="flex-1 px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-xs outline-none focus:border-primary font-mono"
            />
            <button
              type="button"
              onClick={handleAddFolder}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs"
            >
              <Plus size={14} />
              <span>Добавить</span>
            </button>
          </div>

          <div className="space-y-2">
            {configuredFolders.map((folder) => (
              <div
                key={folder}
                className="flex items-center justify-between p-3 bg-muted/30 border border-border/60 rounded-xl text-xs"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Folder size={16} className="text-primary shrink-0" />
                  <span className="font-mono text-foreground truncate">{folder}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFolder(folder)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-muted transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSaveFolders}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs"
          >
            <Save size={14} />
            <span>Сохранить список каталогов</span>
          </button>
        </div>
      ),
    },
    {
      id: 'password',
      title: 'Безопасность и смена пароля',
      subtitle: 'Изменение текущего пароля учётной записи',
      icon: Lock,
      renderContent: () => (
        <form onSubmit={handleChangePassword} className="space-y-4 pt-3 max-w-md">
          {passwordStatus && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                passwordStatus.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
              }`}
            >
              {passwordStatus.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
              <span>{passwordStatus.message}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Текущий пароль
            </label>
            <input
              type="password"
              value={currentPasswordInput}
              onChange={(e) => setCurrentPasswordInput(e.target.value)}
              className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Новый пароль
            </label>
            <input
              type="password"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Подтверждение нового пароля
            </label>
            <input
              type="password"
              value={confirmPasswordInput}
              onChange={(e) => setConfirmPasswordInput(e.target.value)}
              className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
            />
          </div>

          <button
            type="submit"
            id="btn-submit-change-password"
            disabled={isPasswordUpdating}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
          >
            <Lock size={14} />
            <span>{isPasswordUpdating ? 'Обновление...' : 'Обновить пароль'}</span>
          </button>
        </form>
      ),
    },
    {
      id: 'vault',
      title: 'Личная защищённая папка',
      subtitle: 'Управление PIN-кодом, смена пароля и восстановление через e-mail',
      icon: FolderLock,
      renderContent: () => (
        <div className="space-y-6 pt-3">
          {/* Vault Status Summary */}
          <div className="p-4 rounded-2xl bg-muted/20 border border-border/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-foreground">Статус личной папки</h4>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    isVaultUnlocked
                      ? 'bg-[#2dc071]/15 text-[#2dc071]'
                      : isVaultConfigured
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isVaultUnlocked
                    ? `Разблокирована (${Math.floor(vaultRemainingSeconds / 60)} мин)`
                    : isVaultConfigured
                      ? 'Заблокирована'
                      : 'Не настроена'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Медиафайлы и метаданные личной папки изолированы в отдельной защищенной БД storage/.vault/vault_history.db.
              </p>
            </div>

            <Link
              to="/locked-folder"
              className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs flex items-center gap-1.5"
            >
              <FolderLock size={14} />
              <span>Перейти в личную папку</span>
            </Link>
          </div>

          {/* Form 1: Change Vault PIN */}
          <div className="p-4 rounded-2xl bg-card border border-border/70 space-y-4 max-w-md">
            <div className="flex items-center gap-2">
              <KeyRound size={16} className="text-primary" />
              <h5 className="font-bold text-xs text-foreground uppercase tracking-wider">
                Смена PIN-кода личной папки
              </h5>
            </div>

            <form onSubmit={handleChangeVaultPin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Текущий PIN-код
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={vaultCurrentPin}
                  onChange={(e) => setVaultCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm font-mono tracking-widest outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Новый PIN-код (от 4 до 6 цифр)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={vaultNewPin}
                  onChange={(e) => setVaultNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm font-mono tracking-widest outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Подтверждение нового PIN-кода
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={vaultConfirmPin}
                  onChange={(e) => setVaultConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm font-mono tracking-widest outline-none focus:border-primary"
                />
              </div>

              {vaultPinStatus && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                    vaultPinStatus.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                  }`}
                >
                  {vaultPinStatus.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{vaultPinStatus.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVaultPinUpdating}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
              >
                <Save size={14} className={isVaultPinUpdating ? 'animate-spin' : ''} />
                <span>{isVaultPinUpdating ? 'Сохранение...' : 'Обновить PIN-код'}</span>
              </button>
            </form>
          </div>

          {/* Form 2: Recovery / Reset Vault PIN via Email */}
          <div className="p-4 rounded-2xl bg-card border border-border/70 space-y-4 max-w-md">
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-primary" />
              <h5 className="font-bold text-xs text-foreground uppercase tracking-wider">
                Сброс и восстановление PIN-кода по e-mail
              </h5>
            </div>

            {vaultRecoveryStep === 'request' ? (
              <form onSubmit={handleVaultRecoveryRequest} className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Забыли PIN-код? Укажите ваш e-mail для получения одноразового кода восстановления.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    E-mail адрес
                  </label>
                  <input
                    type="email"
                    required
                    value={vaultRecoveryEmailInput}
                    onChange={(e) => setVaultRecoveryEmailInput(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-xs outline-none focus:border-primary"
                  />
                </div>

                {vaultRecoveryStatus && (
                  <div
                    className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                      vaultRecoveryStatus.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                    }`}
                  >
                    {vaultRecoveryStatus.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                    <span>{vaultRecoveryStatus.message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isVaultRecoveryLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
                >
                  <Mail size={14} className={isVaultRecoveryLoading ? 'animate-spin' : ''} />
                  <span>{isVaultRecoveryLoading ? 'Отправка...' : 'Отправить проверочный код'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleVaultRecoveryReset} className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Введите код подтверждения и задайте новый PIN-код.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Код из письма
                  </label>
                  <input
                    type="text"
                    required
                    value={vaultRecoveryCodeInput}
                    onChange={(e) => setVaultRecoveryCodeInput(e.target.value.trim())}
                    placeholder="6-значный код"
                    className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-xs font-mono outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Новый PIN-код (от 4 до 6 цифр)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={vaultRecoveryNewPinInput}
                    onChange={(e) => setVaultRecoveryNewPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-xs font-mono tracking-widest outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Подтвердите новый PIN-код
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={vaultRecoveryConfirmPinInput}
                    onChange={(e) => setVaultRecoveryConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-xs font-mono tracking-widest outline-none focus:border-primary"
                  />
                </div>

                {vaultRecoveryStatus && (
                  <div
                    className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                      vaultRecoveryStatus.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                    }`}
                  >
                    {vaultRecoveryStatus.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                    <span>{vaultRecoveryStatus.message}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setVaultRecoveryStep('request')}
                    className="px-3 py-2 border border-border/70 rounded-xl text-xs text-muted-foreground hover:bg-muted"
                  >
                    Назад
                  </button>
                  <button
                    type="submit"
                    disabled={isVaultRecoveryLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
                  >
                    <KeyRound size={14} className={isVaultRecoveryLoading ? 'animate-spin' : ''} />
                    <span>{isVaultRecoveryLoading ? 'Сброс...' : 'Сбросить PIN-код'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Настройки пользователя и системы</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Конфигурация учётной записи, AI-движков, хранилища и параметров приватности.
        </p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSection === section.id;

          return (
            <div
              key={section.id}
              className="bg-card border border-border/70 rounded-2xl overflow-hidden shadow-xs transition-all"
            >
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">{section.title}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{section.subtitle}</p>
                  </div>
                </div>
                <div className="text-muted-foreground">
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-5 sm:px-5 sm:pb-6 border-t border-border/50">
                  {section.renderContent()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Video Avatar Interactive Trimming Modal */}
      {trimModalOpen && selectedVideoObjectUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border border-border/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Scissors className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Нарезка видео-аватара (Loop 3-10 сек)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTrimModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                ✕
              </button>
            </div>

            <div className="aspect-square max-h-64 w-full bg-black rounded-xl overflow-hidden relative flex items-center justify-center">
              <video
                ref={videoPreviewRef}
                src={selectedVideoObjectUrl}
                onLoadedMetadata={(e) => {
                  const dur = (e.target as HTMLVideoElement).duration || 10;
                  setVideoDuration(dur);
                }}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1 text-muted-foreground">
                  <span>Начало фрагмента: <strong>{trimStart.toFixed(1)}s</strong></span>
                  <span>Длительность: <strong>{trimDuration.toFixed(1)}s</strong></span>
                </div>
                <label className="block text-[11px] text-muted-foreground mb-1">
                  Смещение старта (сек):
                </label>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, videoDuration - 3)}
                  step={0.5}
                  value={trimStart}
                  onChange={(e) => setTrimStart(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">
                  Длина зацикленного фрагмента (3 — 10 сек):
                </label>
                <input
                  type="range"
                  min={3}
                  max={Math.min(10, Math.max(3, videoDuration - trimStart))}
                  step={0.5}
                  value={trimDuration}
                  onChange={(e) => setTrimDuration(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handlePlayLoopPreview}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 hover:bg-muted text-foreground font-semibold"
                >
                  <Play size={13} />
                  <span>Предпросмотр лупа</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTrimModalOpen(false)}
                    className="px-3 py-1.5 rounded-xl border border-border/80 text-muted-foreground hover:bg-muted font-medium"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmTrimAndUpload}
                    disabled={isUploadingVideo}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 shadow-xs disabled:opacity-50"
                  >
                    <Save size={13} />
                    <span>{isUploadingVideo ? 'Сохранение...' : 'Применить видео-аватар'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Avatar Cropping Modal */}
      {photoCropModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border/70 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Crop className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Обрезка фото-аватара (Квадрат 1:1)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPhotoCropModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Interactive Square Crop Viewport */}
            <div
              className="aspect-square max-h-72 w-full bg-black/90 rounded-2xl overflow-hidden relative flex items-center justify-center border-2 border-primary/30 select-none cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => {
                setIsDraggingPhoto(true);
                setDragStartPos({ x: e.clientX - photoPanX, y: e.clientY - photoPanY });
              }}
              onMouseMove={(e) => {
                if (isDraggingPhoto) {
                  setPhotoPanX(e.clientX - dragStartPos.x);
                  setPhotoPanY(e.clientY - dragStartPos.y);
                }
              }}
              onMouseUp={() => setIsDraggingPhoto(false)}
              onMouseLeave={() => setIsDraggingPhoto(false)}
            >
              {selectedPhotoObjectUrl && (
                <img
                  ref={photoImageRef}
                  src={selectedPhotoObjectUrl}
                  alt="Crop preview"
                  draggable={false}
                  style={{
                    transform: `translate(${photoPanX}px, ${photoPanY}px) scale(${photoZoom}) rotate(${photoRotation}deg)`,
                    transformOrigin: 'center center',
                    transition: isDraggingPhoto ? 'none' : 'transform 0.1s ease-out',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                  }}
                />
              )}

              {/* Circular Avatar Guide Overlay */}
              <div className="absolute inset-0 pointer-events-none rounded-full border border-dashed border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>

            {/* Controls: Zoom & Rotate */}
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1 text-muted-foreground">
                  <span className="flex items-center gap-1 font-semibold">
                    <ZoomIn size={13} className="text-primary" />
                    <span>Масштаб (Zoom):</span>
                  </span>
                  <span className="font-mono">{photoZoom.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={3.0}
                  step={0.05}
                  value={photoZoom}
                  onChange={(e) => setPhotoZoom(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setPhotoRotation((r) => (r + 90) % 360)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 hover:bg-muted text-foreground font-semibold cursor-pointer"
                >
                  <RotateCw size={13} />
                  <span>Повернуть 90°</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPhotoZoom(1);
                    setPhotoPanX(0);
                    setPhotoPanY(0);
                    setPhotoRotation(0);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                >
                  Сбросить позицию
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setPhotoCropModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-border/80 text-muted-foreground hover:bg-muted font-medium cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCropAndUpload}
                  disabled={isUploadingPhoto}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Save size={13} className={isUploadingPhoto ? 'animate-spin' : ''} />
                  <span>{isUploadingPhoto ? 'Сохранение...' : 'Применить фото-аватар'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSettingsScreen;
