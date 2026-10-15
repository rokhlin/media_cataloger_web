import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings,
  User,
  HardDrive,
  Key,
  Smartphone,
  UploadCloud,
  Sparkles,
  Bell,
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
} from 'lucide-react';
import { useAuth } from '../../services/authContext';

export const UserSettingsScreen: React.FC = () => {
  const { currentUser, authFetch } = useAuth();
  const [expandedSection, setExpandedSection] = useState<string | null>('account');
  const [configuredFolders, setConfiguredFolders] = useState<string[]>([]);
  const [newFolderInput, setNewFolderInput] = useState('');

  // Account profile avatar
  const [avatarUrl, setAvatarUrl] = useState(() => localStorage.getItem('user_avatar_url') || '');
  const [username, setUsername] = useState(() => currentUser?.username || 'Anton Rokhlin');
  const [email, setEmail] = useState('user@example.local');
  const [accountStatus, setAccountStatus] = useState<string | null>(null);

  // AI Configuration
  const [aiProvider, setAiProvider] = useState<'gemini' | 'local'>('gemini');
  const [aiModel, setAiModel] = useState<'gemini-3.8-flash' | 'gemini-3.1-pro-preview' | 'local-model' | string>('gemini-3.8-flash');
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiFaceClustering, setAiFaceClustering] = useState(true);
  const [aiClipSearch, setAiClipSearch] = useState(true);
  const [aiOcrRecognition, setAiOcrRecognition] = useState(true);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [folderStatus, setFolderStatus] = useState<string | null>(null);

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
      })
      .catch(() => {});
  }, []);

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  const handleSaveAccount = () => {
    localStorage.setItem('user_avatar_url', avatarUrl.trim());
    window.dispatchEvent(new CustomEvent('user_avatar_updated', { detail: { avatarUrl: avatarUrl.trim() } }));
    setAccountStatus('Профиль успешно обновлён');
    setTimeout(() => setAccountStatus(null), 3000);
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
          ...(localStorage.getItem('auth_token') ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } : {}),
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
        headers: localStorage.getItem('auth_token') ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setIsLmStudioConnected(Boolean(data?.connected));
        if (data && Array.isArray(data.models)) {
          setLocalModels(data.models);
          // If active model is reported and current model is generic or empty, select active
          if (data.activeModel && (!aiModel || aiModel === 'local-model')) {
            setAiModel(data.activeModel);
          } else if (data.models.length > 0 && (!aiModel || aiModel === 'local-model')) {
            const loadedModel = data.models.find((m: any) => m.isLoaded);
            setAiModel(loadedModel ? loadedModel.id : data.models[0].id);
          }
        } else {
          setLocalModels([]);
        }
      } else {
        setIsLmStudioConnected(false);
        setLocalModelsError(`Не удалось получить список моделей LM Studio (HTTP ${res.status})`);
      }
    } catch (err: any) {
      setIsLmStudioConnected(false);
      setLocalModelsError(`LM Studio недоступен: ${err?.message || 'ошибка сети'}`);
    } finally {
      setLoadingLocalModels(false);
    }
  }, [aiModel]);

  useEffect(() => {
    if (aiProvider === 'local') {
      fetchLocalModels();
    }
  }, [aiProvider, fetchLocalModels]);

  const handleLoadModelIntoRam = async (modelIdToLoad?: string) => {
    const targetId = (modelIdToLoad || aiModel || '').trim();
    if (!targetId || targetId === 'custom' || targetId === '__custom__') return;
    setLoadingModelIntoRam(true);
    setPreloadStatus(null);
    try {
      const res = await fetch('/api/models/local/load', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('auth_token') ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } : {}),
        },
        body: JSON.stringify({ model_id: targetId, modelId: targetId, model: targetId }),
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
          ...(localStorage.getItem('auth_token') ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } : {}),
        },
        body: JSON.stringify({
          gemini_api_key: geminiApiKey.trim(),
          model_provider: aiProvider,
          gemini_model: aiModel,
          local_model_name: aiModel,
          ai_provider: aiProvider,
          ai_model: aiModel,
        }),
      });
      window.dispatchEvent(new CustomEvent('ai_settings_updated'));
      setAiStatus('Параметры AI успешно сохранены');
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

  const sections = [
    {
      id: 'account',
      title: 'Учётная запись и профиль',
      subtitle: 'Имя пользователя, адрес электронной почты и аватар',
      icon: User,
      renderContent: () => (
        <div className="space-y-4 pt-3">
          {accountStatus && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs">
              <CheckCircle2 size={15} />
              <span>{accountStatus}</span>
            </div>
          )}

          {/* Avatar Settings */}
          <div className="flex items-center gap-4 pb-2 border-b border-border/50">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#23a6f0] to-[#2091f9] text-white font-bold text-xl flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={username}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : null}
              <span className="absolute inset-0 flex items-center justify-center">
                {(username || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 space-y-1">
              <label className="block text-xs font-semibold text-muted-foreground">
                URL аватара пользователя
              </label>
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="w-full px-3 py-1.5 bg-muted/40 border border-border/70 rounded-xl text-xs outline-none focus:border-primary"
              />
              <p className="text-[11px] text-muted-foreground">
                Укажите прямую ссылку на фото профиля для отображения в панели навигации.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Имя пользователя
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
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSaveAccount}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
            >
              <Save size={14} />
              <span>Сохранить изменения профиля</span>
            </button>
          </div>

          {/* Setup Wizard Relocated Card */}
          <div className="mt-6 pt-4 border-t border-border/50">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
              <Sparkles size={14} className="text-[#f3cd03]" />
              <span>Мастер первоначальной настройки системы</span>
            </h4>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Пошаговый мастер настройки поможет сконфигурировать сканируемые директории, модули AI распознавания лиц и правила дубликатов.
            </p>
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border/80 text-xs font-semibold rounded-xl transition-colors"
            >
              <Sparkles size={13} className="text-[#f3cd03]" />
              <span>Запустить мастер настройки</span>
            </Link>
          </div>
        </div>
      ),
    },
    {
      id: 'folders',
      title: 'Папки и источники медиатеки',
      subtitle: 'Сканируемые директории и каталоги для каталогизации',
      icon: Folder,
      renderContent: () => (
        <div className="space-y-4 pt-3">
          {folderStatus && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs">
              <CheckCircle2 size={15} />
              <span>{folderStatus}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Укажите директории на диске, в которых находятся ваши фото и видеоматериалы для автоматического сканирования и распознавания.
          </p>

          {/* List of configured folders */}
          <div className="space-y-2">
            {configuredFolders.length === 0 ? (
              <div className="p-3 border border-dashed rounded-xl text-xs text-muted-foreground text-center">
                Нет добавленных папок. Каталогизатор будет использовать директорию по умолчанию (media_input/).
              </div>
            ) : (
              configuredFolders.map((folder) => (
                <div
                  key={folder}
                  className="flex items-center justify-between p-2.5 bg-muted/30 border border-border/60 rounded-xl text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder size={14} className="text-primary shrink-0" />
                    <span className="font-mono truncate">{folder}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFolder(folder)}
                    className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                    title="Удалить папку из сканирования"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add folder input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newFolderInput}
              onChange={(e) => setNewFolderInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddFolder();
              }}
              placeholder="C:\Photos или /media/external/photos"
              className="flex-1 px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-xs outline-none focus:border-primary font-mono"
            />
            <button
              type="button"
              onClick={handleAddFolder}
              className="flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border/80 text-xs font-semibold rounded-xl transition-colors shrink-0"
            >
              <Plus size={14} />
              <span>Добавить</span>
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSaveFolders}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs"
            >
              <Save size={14} />
              <span>Сохранить каталоги</span>
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'ai-features',
      title: 'Функции искусственного интеллекта и AI-ассистент',
      subtitle: 'Выбор провайдера (Gemini / Local LLM), модели и токена API',
      icon: Sparkles,
      renderContent: () => (
        <div className="space-y-4 pt-3 text-xs">
          {aiStatus && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs">
              <CheckCircle2 size={15} />
              <span>{aiStatus}</span>
            </div>
          )}

          {/* AI Provider Selector */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-2">
              Провайдер искусственного интеллекта
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setAiProvider('gemini')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  aiProvider === 'gemini'
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/70 bg-card hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <Sparkles size={16} className="text-primary" />
                  <span>Google Gemini API (Облачный SOTA)</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Продвинутый мультимодальный анализ, мгновенное описание сцен и распознавание лиц через модели gemini-3.8-flash и gemini-3.1-pro-preview.
                </p>
              </div>

              <div
                onClick={() => setAiProvider('local')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  aiProvider === 'local'
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/70 bg-card hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <Cpu size={16} className="text-[#f3cd03]" />
                  <span>Локальная нейросеть (Local LLM / LM Studio)</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Локальная обработка на вашем оборудовании без отправки данных во внешние сети через LM Studio или Ollama.
                </p>
              </div>
            </div>
          </div>

          {/* Model Selector */}
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
                        title="Запросить установленные модели из LM Studio"
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
                          {m.size ? ` [${m.size}]` : ''}
                        </option>
                      ))}
                      {aiModel && !localModels.some((m) => m.id === aiModel) && (
                        <option value={aiModel}>⚙️ {aiModel}</option>
                      )}
                      <option value="__custom__">✏️ Ввести ID модели вручную...</option>
                    </select>
                  )}

                  {/* Status indicator under model dropdown */}
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
                            title="Предварительно загрузить выбранную модель в память LM Studio"
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

            {/* Right Column: Gemini API Token or LM Studio Server Status */}
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
                    {isLmStudioConnected
                      ? 'В сети'
                      : isLmStudioConnected === false
                      ? 'Недоступен'
                      : 'Проверка...'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {isLmStudioConnected
                    ? `LM Studio подключен. Обнаружено моделей: ${localModels.length}. Доступно мгновенное переключение.`
                    : 'Запустите LM Studio, откройте вкладку Developer / Local Server и убедитесь, что сервер включен (0.0.0.0 или 127.0.0.1:1234).'}
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

          {/* AI Feature Toggles */}
          <div className="pt-2 border-t border-border/50 space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={aiFaceClustering}
                onChange={(e) => setAiFaceClustering(e.target.checked)}
                className="rounded text-primary focus:ring-primary"
              />
              <span className="text-foreground font-medium">
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
              <span className="text-foreground font-medium">
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
              <span className="text-foreground font-medium">
                OCR распознавание текста и надписей на изображениях
              </span>
            </label>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleSaveAi}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs"
            >
              <Save size={14} />
              <span>Сохранить параметры AI</span>
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'storage',
      title: 'Квота дискового хранилища',
      subtitle: 'Использование пространства, управление кэшем и лимиты',
      icon: HardDrive,
      renderContent: () => (
        <div className="space-y-4 pt-3">
          <div className="p-4 bg-muted/30 border border-border/60 rounded-xl space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-foreground">Занято 25.5 GiB из 100 GiB</span>
              <span className="font-mono text-muted-foreground">25.5%</span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden flex">
              <div className="h-full bg-[#23a6f0]" style={{ width: '20%' }} />
              <div className="h-full bg-[#f3cd03]" style={{ width: '5.5%' }} />
            </div>
          </div>
          <button
            type="button"
            className="px-3.5 py-2 text-xs font-semibold border border-border/80 rounded-xl hover:bg-muted text-foreground transition-colors"
          >
            Очистить локальный кэш миниатюр (340 МБ)
          </button>
        </div>
      ),
    },
    {
      id: 'api-keys',
      title: 'API ключи и токены доступа',
      subtitle: 'Токены для интеграции с мобильными приложениями и CLI',
      icon: Key,
      renderContent: () => (
        <div className="space-y-4 pt-3">
          <p className="text-xs text-muted-foreground">
            Создавайте персональные ключи API для загрузки медиа через скрипты или фоновую синхронизацию.
          </p>
          <button
            type="button"
            className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs"
          >
            Сгенерировать новый API ключ
          </button>
        </div>
      ),
    },
    {
      id: 'devices',
      title: 'Авторизованные устройства и сессии',
      subtitle: 'Управление подключенными браузерами и приложениями',
      icon: Smartphone,
      renderContent: () => (
        <div className="space-y-3 pt-3 text-xs">
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
            <div>
              <p className="font-semibold text-foreground">Chrome на Windows 11 (Текущая сессия)</p>
              <p className="text-muted-foreground text-[11px]">IP: 127.0.0.1 • Активно сейчас</p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#2dc071]/15 text-[#2dc071] font-semibold text-[10px]">
              Онлайн
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'upload',
      title: 'Параметры загрузки и оптимизации',
      subtitle: 'Конвертация HEIC, генерация миниатюр, авто-ротация EXIF',
      icon: UploadCloud,
      renderContent: () => (
        <div className="space-y-3 pt-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" defaultChecked className="rounded text-primary focus:ring-primary" />
            <span className="text-foreground font-medium">
              Автоматически конвертировать HEIC / HEIF файлы в JPEG
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" defaultChecked className="rounded text-primary focus:ring-primary" />
            <span className="text-foreground font-medium">
              Извлекать геолокационные метки и координаты из EXIF
            </span>
          </label>
        </div>
      ),
    },
    {
      id: 'notifications',
      title: 'Уведомления',
      subtitle: 'Оповещения об окончании сканирования и системных событиях',
      icon: Bell,
      renderContent: () => (
        <div className="space-y-3 pt-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" defaultChecked className="rounded text-primary focus:ring-primary" />
            <span className="text-foreground font-medium">
              Оповещения в браузере при обнаружении дубликатов
            </span>
          </label>
        </div>
      ),
    },
    {
      id: 'security',
      title: 'Безопасность и смена пароля',
      subtitle: 'Обновление пароля учётной записи и двухфакторная аутентификация',
      icon: ShieldCheck,
      renderContent: () => (
        <div className="space-y-4 pt-3">
          {passwordStatus && (
            <div
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs ${
                passwordStatus.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
                  : 'bg-destructive/10 border border-destructive/20 text-destructive'
              }`}
            >
              {passwordStatus.type === 'success' ? <CheckCircle2 size={15} /> : <span>⚠️</span>}
              <span>{passwordStatus.message}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="max-w-md space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Текущий пароль
              </label>
              <input
                type="password"
                value={currentPasswordInput}
                onChange={(e) => setCurrentPasswordInput(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isPasswordUpdating}
                className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
                id="input-current-password"
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
                placeholder="Минимум 4 символа"
                required
                disabled={isPasswordUpdating}
                className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
                id="input-new-password"
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
                placeholder="Повторите новый пароль"
                required
                disabled={isPasswordUpdating}
                className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
                id="input-confirm-password"
              />
            </div>
            <button
              type="submit"
              disabled={isPasswordUpdating}
              className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              id="btn-submit-change-password"
            >
              {isPasswordUpdating ? 'Сохранение...' : 'Обновить пароль'}
            </button>
          </form>
        </div>
      ),
    },
    {
      id: 'vault-pin',
      title: 'ПИН-код личной защищённой папки',
      subtitle: 'Настройка 6-значного мастер-PIN для шифрованного хранилища',
      icon: Lock,
      renderContent: () => (
        <div className="space-y-4 pt-3">
          <p className="text-xs text-muted-foreground">
            Текущий PIN активен. Вы можете изменить 6-значный код доступа в любое время.
          </p>
          <button
            type="button"
            className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs"
          >
            Изменить 6-значный PIN
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="pb-4 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-extrabold text-foreground">Настройки учётной записи</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Конфигурация профиля, папок медиатеки, параметров AI-ассистента и безопасности.
        </p>
      </div>

      {/* Accordion Settings Cards */}
      <div className="space-y-3">
        {sections.map((section) => {
          const isExpanded = expandedSection === section.id;
          const Icon = section.icon;

          return (
            <div
              key={section.id}
              className="bg-card border border-border/70 rounded-2xl overflow-hidden shadow-xs transition-colors hover:border-primary/40"
            >
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Icon size={20} />
                  </div>
                  <div className="truncate">
                    <h3 className="font-bold text-sm sm:text-base text-foreground truncate">
                      {section.title}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {section.subtitle}
                    </p>
                  </div>
                </div>

                <div className="p-1 rounded-lg text-muted-foreground hover:text-foreground shrink-0 ml-3">
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 pt-1 border-t border-border/40 animate-in fade-in duration-150">
                  {section.renderContent()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UserSettingsScreen;
