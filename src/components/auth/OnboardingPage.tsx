import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User as UserIcon,
  Folder,
  Cpu,
  Rocket,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  HardDrive,
  Sparkles,
  Server,
  Cloud,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Play,
} from 'lucide-react';
import { useAuth } from '../../services/authContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '@/utils';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { currentUser, login, register, authFetch, logout } = useAuth();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Step 1: Auth form state
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('admin');
  const [confirmPassword, setConfirmPassword] = useState<string>('admin');
  const [displayName, setDisplayName] = useState<string>('Администратор');

  // Step 2: Folders state
  const [inputFolders, setInputFolders] = useState<string[]>([
    'C:\\projects\\media_catalog\\media_input',
  ]);
  const [outputFolder, setOutputFolder] = useState<string>(
    'C:\\projects\\media_catalog\\media_output'
  );
  const [preserveStructure, setPreserveStructure] = useState<boolean>(true);

  // Step 3: AI Engine state
  const [modelProvider, setModelProvider] = useState<'local' | 'gemini'>('local');
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [isGeminiKeyMasked, setIsGeminiKeyMasked] = useState<boolean>(false);
  const [engineReady, setEngineReady] = useState<boolean>(true);

  // Fetch initial settings & status from backend
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [settingsRes, statusRes] = await Promise.all([
          authFetch('/api/settings').catch(() => null),
          fetch('/api/status').catch(() => null),
        ]);

        if (settingsRes && settingsRes.ok) {
          const s = await settingsRes.json();
          if (Array.isArray(s.input_folders) && s.input_folders.length > 0) {
            setInputFolders(s.input_folders);
          } else if (Array.isArray(s.default_input_folders) && s.default_input_folders.length > 0) {
            setInputFolders(s.default_input_folders);
          }
          if (s.output_folder) {
            setOutputFolder(s.output_folder);
          } else if (s.default_output_folder) {
            setOutputFolder(s.default_output_folder);
          }
          if (s.model_provider) {
            setModelProvider(s.model_provider);
          }
          if (s.is_gemini_api_key_set) {
            setIsGeminiKeyMasked(true);
          }
        }

        if (statusRes && statusRes.ok) {
          const st = await statusRes.json();
          setEngineReady(Boolean(st.engine_ready || st.connected));
        }
      } catch (e) {
        console.warn('Onboarding fetch error:', e);
      }
    };

    fetchInitialData();
  }, []);

  // Step navigation helper
  const goToStep = (stepNumber: number) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setCurrentStep(stepNumber);
  };

  // Step 1: Submit Authentication
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      if (authMode === 'register') {
        if (password !== confirmPassword) {
          setErrorMsg('Пароли не совпадают');
          setIsSubmitting(false);
          return;
        }
        const res = await register(username, password, displayName, 'admin');
        if (res.success) {
          setSuccessMsg('Учетная запись успешно создана!');
          setTimeout(() => goToStep(2), 600);
        } else {
          // If already taken, try logging in
          if (res.error?.includes('already taken')) {
            const loginRes = await login(username, password);
            if (loginRes.success) {
              setSuccessMsg('Вход успешно выполнен под существующим пользователем!');
              setTimeout(() => goToStep(2), 600);
            } else {
              setErrorMsg(res.error || 'Ошибка регистрации');
            }
          } else {
            setErrorMsg(res.error || 'Ошибка регистрации');
          }
        }
      } else {
        const res = await login(username, password);
        if (res.success) {
          setSuccessMsg('Успешный вход в систему!');
          setTimeout(() => goToStep(2), 600);
        } else {
          setErrorMsg(res.error || 'Неверный логин или пароль');
        }
      }
    } catch {
      setErrorMsg('Сетевая ошибка при аутентификации');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2 Folder helpers
  const handleAddFolder = () => setInputFolders([...inputFolders, '']);
  const handleRemoveFolder = (idx: number) => setInputFolders(inputFolders.filter((_, i) => i !== idx));
  const handleFolderChange = (idx: number, val: string) => {
    const copy = [...inputFolders];
    copy[idx] = val;
    setInputFolders(copy);
  };

  const handleStep2Next = () => {
    const valid = inputFolders.map((f) => f.trim()).filter(Boolean);
    if (valid.length === 0) {
      setErrorMsg('Укажите хотя бы одну папку с медиафайлами для сканирования');
      return;
    }
    setErrorMsg(null);
    goToStep(3);
  };

  // Step 4: Final Save & Start Scanning
  const handleFinishAndStart = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const validFolders = inputFolders.map((f) => f.trim()).filter(Boolean);
      const payload: Record<string, any> = {
        input_folders: validFolders,
        output_folder: outputFolder.trim() || undefined,
        model_provider: modelProvider,
        preserve_structure: preserveStructure,
      };
      if (modelProvider === 'gemini' && geminiApiKey.trim()) {
        payload.gemini_api_key = geminiApiKey.trim();
      }

      // 1. Save settings
      const settingsRes = await authFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!settingsRes.ok) {
        const err = await settingsRes.json().catch(() => ({}));
        throw new Error(err.message || 'Не удалось сохранить настройки');
      }

      // 2. Trigger scan
      const runRes = await authFetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!runRes.ok) {
        const runErr = await runRes.json().catch(() => ({}));
        const msg = String(runErr.message || '');
        if (!msg.toLowerCase().includes('already running')) {
          throw new Error(msg || 'Не удалось запустить сканирование');
        }
      }

      // Mark setup completed
      localStorage.setItem('media_cataloger_setup_completed', 'true');
      setSuccessMsg('Настройки сохранены! Первичное сканирование медиатеки успешно запущено.');

      setTimeout(() => {
        navigate('/');
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка запуска процесса сканирования');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepsList = [
    { id: 1, title: 'Аккаунт', icon: UserIcon },
    { id: 2, title: 'Папки медиа', icon: Folder },
    { id: 3, title: 'ИИ Агенты', icon: Cpu },
    { id: 4, title: 'Запуск', icon: Rocket },
  ];

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-2xl bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-7">
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles size={13} />
            <span>Мастер первоначальной настройки</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Media Cataloger V2
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            Настройка системы с нуля: аккаунт администратора, источники файлов и ИИ-индексация
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between border-y border-border/60 py-3 px-2">
          {stepsList.map((st, i) => {
            const Icon = st.icon;
            const isCompleted = currentStep > st.id;
            const isCurrent = currentStep === st.id;
            return (
              <React.Fragment key={st.id}>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                      isCompleted
                        ? 'bg-[#2dc071] text-white'
                        : isCurrent
                        ? 'bg-primary text-white ring-4 ring-primary/20 shadow-xs'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isCompleted ? <Check size={14} /> : <Icon size={14} />}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-semibold hidden sm:inline',
                      isCurrent ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {st.title}
                  </span>
                </div>
                {i < stepsList.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-2 rounded-full transition-colors',
                      currentStep > st.id ? 'bg-[#2dc071]' : 'bg-muted'
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl text-xs font-semibold bg-[#e74040]/15 text-[#e74040] border border-[#e74040]/30 flex items-center gap-2 animate-in fade-in">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl text-xs font-semibold bg-[#2dc071]/15 text-[#2dc071] border border-[#2dc071]/30 flex items-center gap-2 animate-in fade-in">
            <Check size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* STEP 1: Account Setup */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {currentUser ? (
              <div className="p-5 rounded-2xl bg-muted/40 border border-border/80 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#2dc071]/15 text-[#2dc071] flex items-center justify-center">
                    <ShieldCheck size={26} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Вы вошли как: {currentUser.username}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Роль: <span className="font-semibold text-primary">{currentUser.role}</span>
                      {currentUser.displayName ? ` (${currentUser.displayName})` : ''}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ваш аккаунт готов к работе. Вы можете продолжить к выбору папок для сканирования или сменить пользователя.
                </p>
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await logout();
                      window.location.reload();
                    }}
                    className="text-xs text-muted-foreground hover:text-[#e74040] underline font-medium"
                  >
                    Сменить аккаунт
                  </button>
                  <Button onClick={() => goToStep(2)} className="flex items-center gap-1.5">
                    <span>Продолжить</span>
                    <ChevronRight size={15} />
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div className="flex items-center justify-center gap-2 p-1 bg-muted/50 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className={cn(
                      'flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all',
                      authMode === 'register' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Создать аккаунт администратора
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={cn(
                      'flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all',
                      authMode === 'login' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Войти в существующий
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Логин (Username)
                    </label>
                    <Input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      required
                    />
                  </div>

                  {authMode === 'register' && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                        Отображаемое имя
                      </label>
                      <Input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Администратор"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Пароль
                    </label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  {authMode === 'register' && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                        Подтверждение пароля
                      </label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    По умолчанию доступен аккаунт: <code className="font-mono text-primary">admin / admin</code>
                  </span>
                  <Button type="submit" disabled={isSubmitting} className="flex items-center gap-1.5">
                    <span>{authMode === 'register' ? 'Зарегистрироваться' : 'Войти'}</span>
                    <ChevronRight size={15} />
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* STEP 2: Media Folders Selection */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Папки для сканирования (Input Folders)</h3>
                  <p className="text-xs text-muted-foreground">
                    Укажите локальные каталоги с фотографиями и видео для каталогизации
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddFolder}
                  className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                >
                  <Plus size={14} />
                  <span>Добавить</span>
                </button>
              </div>

              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {inputFolders.map((folder, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <HardDrive className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={folder}
                        onChange={(e) => handleFolderChange(index, e.target.value)}
                        placeholder="C:\Photos или C:\projects\media_catalog\media_input"
                        className="w-full h-10 pl-9 pr-3 bg-muted/40 border border-border/70 rounded-xl text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    {inputFolders.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFolder(index)}
                        className="p-2 text-muted-foreground hover:text-[#e74040] hover:bg-muted rounded-xl transition-colors"
                        title="Удалить строку"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground">Быстрые пресеты:</span>
                <button
                  type="button"
                  onClick={() => setInputFolders(['C:\\projects\\media_catalog\\media_input'])}
                  className="px-2.5 py-1 rounded-lg text-[10px] bg-muted hover:bg-muted/80 text-foreground transition-colors font-mono"
                >
                  media_input (Тестовая папка)
                </button>
                <button
                  type="button"
                  onClick={() => setInputFolders(['C:\\Users\\rokhl\\Pictures'])}
                  className="px-2.5 py-1 rounded-lg text-[10px] bg-muted hover:bg-muted/80 text-foreground transition-colors font-mono"
                >
                  Pictures
                </button>
              </div>
            </div>

            {/* Output Folder */}
            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Папка метаданных (Output Folder)
              </label>
              <input
                type="text"
                value={outputFolder}
                onChange={(e) => setOutputFolder(e.target.value)}
                placeholder="C:\projects\media_catalog\media_output"
                className="w-full h-10 px-3 bg-muted/40 border border-border/70 rounded-xl text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-[11px] text-muted-foreground">
                Место, куда будут сохраняться sidecar JSON файлы и метаданные анализа
              </p>
            </div>

            {/* Preserve subfolder structure checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="preserveStructure"
                checked={preserveStructure}
                onChange={(e) => setPreserveStructure(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary/20"
              />
              <label htmlFor="preserveStructure" className="text-xs text-muted-foreground cursor-pointer">
                Сохранять структуру каталогов при анализе
              </label>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-3">
              <Button variant="outline" onClick={() => goToStep(1)} className="flex items-center gap-1">
                <ChevronLeft size={15} />
                <span>Назад</span>
              </Button>
              <Button onClick={handleStep2Next} className="flex items-center gap-1">
                <span>Далее: ИИ Агенты</span>
                <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: AI Models Configuration */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 className="text-sm font-bold text-foreground">Конфигурация ИИ Агентов</h3>
              <p className="text-xs text-muted-foreground">
                Выберите механизм распознавания объектов, лиц и транскрипции видео
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Option A: Local AI */}
              <div
                onClick={() => setModelProvider('local')}
                className={cn(
                  'p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 relative',
                  modelProvider === 'local'
                    ? 'border-primary bg-primary/5 shadow-xs'
                    : 'border-border/70 bg-card hover:border-border'
                )}
              >
                {modelProvider === 'local' && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                    <Check size={12} />
                  </div>
                )}
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Server size={18} />
                </div>
                <h4 className="text-xs font-bold text-foreground">Локальный AI Сервер</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Полная автономность (ai_engine на порту 8001). Qwen2.5-VL для OCR и объектов, Whisper для голоса.
                </p>
                <div className="pt-2 flex items-center gap-1.5 text-[10px] font-semibold">
                  <span className={cn('w-2 h-2 rounded-full', engineReady ? 'bg-[#2dc071]' : 'bg-[#e74040]')} />
                  <span className="text-foreground">
                    {engineReady ? 'ai_engine:8001 в сети' : 'Ожидание сервера'}
                  </span>
                </div>
              </div>

              {/* Option B: Google Gemini Cloud */}
              <div
                onClick={() => setModelProvider('gemini')}
                className={cn(
                  'p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 relative',
                  modelProvider === 'gemini'
                    ? 'border-primary bg-primary/5 shadow-xs'
                    : 'border-border/70 bg-card hover:border-border'
                )}
              >
                {modelProvider === 'gemini' && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                    <Check size={12} />
                  </div>
                )}
                <div className="w-9 h-9 rounded-xl bg-[#2091f9]/10 text-[#2091f9] flex items-center justify-center">
                  <Cloud size={18} />
                </div>
                <h4 className="text-xs font-bold text-foreground">Google Gemini SOTA</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Облачный Gemini 3.8 Flash API для глубокого семантического анализа и сложных сцен.
                </p>
                <div className="pt-2 text-[10px] font-semibold text-primary">
                  <span>Рекомендуется для высокой точности</span>
                </div>
              </div>
            </div>

            {/* Gemini Key Input if selected */}
            {modelProvider === 'gemini' && (
              <div className="space-y-1.5 p-3.5 rounded-2xl bg-muted/30 border border-border/70 animate-in fade-in">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Gemini API Key {isGeminiKeyMasked && '(уже сохранен на сервере)'}
                </label>
                <Input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder={isGeminiKeyMasked ? '••••••••••••••••••••' : 'Вставьте ваш AI Studio API ключ'}
                />
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-3">
              <Button variant="outline" onClick={() => goToStep(2)} className="flex items-center gap-1">
                <ChevronLeft size={15} />
                <span>Назад</span>
              </Button>
              <Button onClick={() => goToStep(4)} className="flex items-center gap-1">
                <span>Далее: Запуск</span>
                <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Review and Start Scanning */}
        {currentStep === 4 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 className="text-sm font-bold text-foreground">Итоговая конфигурация</h3>
              <p className="text-xs text-muted-foreground">
                Проверьте параметры перед стартом сканирования и каталогизации
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Пользователь:</span>
                <span className="font-semibold text-foreground font-mono">
                  {currentUser?.username || username}
                </span>
              </div>
              <div className="flex items-start justify-between pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Папки для поиска:</span>
                <span className="font-semibold text-foreground text-right max-w-[260px] truncate">
                  {inputFolders.filter(Boolean).join(', ')}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Выходная папка:</span>
                <span className="font-semibold text-foreground text-right max-w-[260px] truncate">
                  {outputFolder}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ИИ Движок:</span>
                <span className="font-semibold text-primary">
                  {modelProvider === 'local' ? 'Локальный Qwen2.5-VL / Whisper' : 'Google Gemini 3.8 Flash'}
                </span>
              </div>
            </div>

            {/* Navigation & CTA */}
            <div className="flex items-center justify-between pt-3">
              <Button variant="outline" onClick={() => goToStep(3)} className="flex items-center gap-1">
                <ChevronLeft size={15} />
                <span>Назад</span>
              </Button>
              <Button
                onClick={handleFinishAndStart}
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-white font-bold flex items-center gap-2 px-6 py-2.5 rounded-xl shadow-md"
              >
                <Play size={16} className="fill-white" />
                <span>{isSubmitting ? 'Запуск...' : 'Начать сканирование медиатеки'}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Footer skip link */}
        <div className="text-center pt-2">
          <Link
            to="/"
            onClick={() => localStorage.setItem('media_cataloger_setup_completed', 'true')}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
          >
            Перейти в медиатеку без мастера настройки
          </Link>
        </div>
      </div>
    </div>
  );
}
