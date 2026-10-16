import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock,
  Unlock,
  KeyRound,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Mail,
  CheckCircle2,
  Shield,
  Eye,
  EyeOff,
  FolderLock,
  Play,
  FileImage,
} from 'lucide-react';
import { cn } from '@/utils';
import { useVault } from '@/services/vaultContext';
import { useAuth } from '@/services/authContext';
import MediaViewerModal from '@/components/gallery/MediaViewerModal';
import type { GalleryMediaFile } from '@/models';

export const LockedFolderScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    isUnlocked,
    isConfigured,
    isLoading,
    remainingSeconds,
    vaultMediaFiles,
    loadingVaultFiles,
    vaultToken,
    setupVault,
    unlockVault,
    lockVault,
    requestPinRecovery,
    resetPinWithRecovery,
    fetchVaultMediaItems,
  } = useVault();

  const { currentUser } = useAuth();
  // Recovery email is bound to the logged-in user's profile email
  const userEmail = currentUser?.email?.trim() || null;

  // Unlock state
  const [pinDigits, setPinDigits] = useState(['', '', '', '', '', '']);
  const [showPinText, setShowPinText] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isSubmittingUnlock, setIsSubmittingUnlock] = useState(false);
  const [shake, setShake] = useState(false);

  // First-time setup state
  const [setupPin, setSetupPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [autoLockMinutes, setAutoLockMinutes] = useState(15);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSubmittingSetup, setIsSubmittingSetup] = useState(false);

  // Recovery modal state
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<'email' | 'code'>('email');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [recoveryNewPin, setRecoveryNewPin] = useState('');
  const [recoveryConfirmPin, setRecoveryConfirmPin] = useState('');
  const [recoveryMsg, setRecoveryMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // Selected file for lightbox preview
  const [selectedFile, setSelectedFile] = useState<GalleryMediaFile | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isConfigured && !isUnlocked) {
      inputRefs.current[0]?.focus();
    }
  }, [isConfigured, isUnlocked]);

  // Handle segmented PIN input
  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);

    const newPin = [...pinDigits];
    newPin[index] = digit;
    setPinDigits(newPin);
    setUnlockError(null);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newPin.every((d) => d !== '')) {
      const fullPin = newPin.join('');
      executeUnlock(fullPin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const executeUnlock = async (pin: string) => {
    if (!pin || pin.trim().length < 4) {
      setUnlockError('PIN-код должен содержать минимум 4 цифры');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setIsSubmittingUnlock(true);
    setUnlockError(null);

    const res = await unlockVault(pin);
    setIsSubmittingUnlock(false);

    if (res.success) {
      setPinDigits(['', '', '', '', '', '']);
    } else {
      setUnlockError(res.error || 'Неверный PIN-код. Попробуйте снова.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPinDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const executeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);

    if (setupPin.length < 4) {
      setSetupError('PIN-код должен содержать от 4 до 6 цифр');
      return;
    }
    if (setupPin !== confirmPin) {
      setSetupError('Подтверждение PIN-кода не совпадает');
      return;
    }

    setIsSubmittingSetup(true);
    const res = await setupVault(setupPin, undefined, autoLockMinutes, recoveryEmail.trim() || undefined);
    setIsSubmittingSetup(false);

    if (res.success) {
      // Auto unlock after setup
      await unlockVault(setupPin);
    } else {
      setSetupError(res.error || 'Не удалось создать личную папку');
    }
  };

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail) {
      setRecoveryMsg({ text: 'E-mail не привязан к профилю пользователя. Восстановление недоступно.', isError: true });
      return;
    }

    setRecoveryLoading(true);
    setRecoveryMsg(null);

    const res = await requestPinRecovery(userEmail);
    setRecoveryLoading(false);

    if (res.success) {
      setRecoveryMsg({
        text: res.message + (res.codeHint ? ` (Код: ${res.codeHint})` : ''),
        isError: false,
      });
      setRecoveryStep('code');
    } else {
      setRecoveryMsg({ text: res.error || 'Не удалось отправить код восстановления', isError: true });
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCodeInput.trim()) {
      setRecoveryMsg({ text: 'Введите код восстановления', isError: true });
      return;
    }
    if (recoveryNewPin.length < 4) {
      setRecoveryMsg({ text: 'Новый PIN-код должен быть от 4 цифр', isError: true });
      return;
    }
    if (recoveryNewPin !== recoveryConfirmPin) {
      setRecoveryMsg({ text: 'Подтверждение PIN-кода не совпадает', isError: true });
      return;
    }

    setRecoveryLoading(true);
    setRecoveryMsg(null);

    const res = await resetPinWithRecovery(userEmail || '', recoveryCodeInput.trim(), recoveryNewPin);
    setRecoveryLoading(false);

    if (res.success) {
      setShowRecoveryModal(false);
      setRecoveryStep('email');
      setRecoveryMsg(null);
      // Auto unlock with new PIN
      await unlockVault(recoveryNewPin);
    } else {
      setRecoveryMsg({ text: res.error || 'Не удалось сбросить PIN-код', isError: true });
    }
  };

  // Convert vault files to GalleryMediaFile shape
  const formattedVaultFiles: GalleryMediaFile[] = useMemo(() => {
    return vaultMediaFiles.map((item) => {
      const filePath = item.filePath || item.file_path || item.filename;
      const isVideo =
        item.is_video ||
        /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(filePath || '');

      return {
        id: item.id || filePath,
        filename: item.filename || filePath.split(/[/\\]/).pop() || 'file',
        file_path: filePath,
        filePath: filePath,
        is_video: Boolean(isVideo),
        is_vault: true,
        size_bytes: item.size_bytes || item.file_size || 0,
        media_date: item.media_date || item.capture_date || item.created_at,
        capture_date: item.capture_date || item.media_date,
        summary: item.summary,
        summary_ru: item.summary_ru,
        description: item.description,
        description_ru: item.description_ru,
        tags: item.tags || [],
        rating: item.rating || 0,
        favorite: Boolean(item.favorite),
        status: item.status || 'PROCESSED',
        environment: item.environment,
        lighting: item.lighting,
        lighting_ru: item.lighting_ru,
        weather: item.weather,
        weather_ru: item.weather_ru,
        time_of_day: item.time_of_day,
        ocr_text: item.ocr_text,
        exif_analysis: item.exif_analysis,
        transcription: item.transcription,
        faces: item.faces || [],
      };
    });
  }, [vaultMediaFiles]);

  // Loading indicator
  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px-36px)] w-full flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="animate-spin text-primary" size={28} />
          <p className="text-sm">Проверка состояния личной папки...</p>
        </div>
      </div>
    );
  }

  // 1. FIRST TIME SETUP SCREEN
  if (!isConfigured) {
    return (
      <div className="min-h-[calc(100vh-64px-36px)] w-full flex items-center justify-center p-4 bg-gradient-to-br from-indigo-900/10 via-background to-primary/5 select-none animate-in fade-in duration-300">
        <div className="w-full max-w-md bg-card/95 backdrop-blur-md border border-border/80 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shadow-xs">
            <FolderLock size={32} />
          </div>

          <h1 className="text-xl font-extrabold text-foreground">
            Создание личной папки
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Задайте цифровой PIN-код для защиты ваших приватных файлов. Они будут изолированы в отдельной базе данных и скрыты от общего просмотра.
          </p>

          <form onSubmit={executeSetup} className="w-full mt-6 space-y-4 text-left">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Новый PIN-код (от 4 до 6 цифр)
              </label>
              <div className="relative">
                <input
                  type={showPinText ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={setupPin}
                  onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-muted/30 text-foreground text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPinText(!showPinText)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPinText ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Подтверждение PIN-кода
              </label>
              <input
                type={showPinText ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-muted/30 text-foreground text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                E-mail для восстановления пароля (рекомендуется)
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-border/80 bg-muted/30 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Используется для сброса PIN-кода, если вы его забудете.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Время автоблокировки при бездействии
              </label>
              <select
                value={autoLockMinutes}
                onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-muted/30 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value={5}>5 минут</option>
                <option value={15}>15 минут (рекомендуется)</option>
                <option value={30}>30 минут</option>
                <option value={60}>1 час</option>
              </select>
            </div>

            {setupError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20 animate-in fade-in">
                <AlertCircle size={15} />
                <span>{setupError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex-1 py-2.5 rounded-xl border border-border/80 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-center"
              >
                Отмена
              </button>

              <button
                type="submit"
                disabled={isSubmittingSetup}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                {isSubmittingSetup ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    <span>Создание...</span>
                  </>
                ) : (
                  <span>Создать папку</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 2. UNLOCKED VIEW: REAL MEDIA ITEMS
  if (isUnlocked) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
        {/* Unlocked Banner */}
        <div className="bg-[#2dc071]/10 border border-[#2dc071]/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2dc071]/20 flex items-center justify-center text-[#2dc071] shrink-0">
              <Unlock size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-foreground text-sm">Личная папка разблокирована</h2>
                {remainingSeconds > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-[#2dc071]/20 text-[#2dc071] border border-[#2dc071]/30">
                    Автоблокировка через: {Math.floor(remainingSeconds / 60)}:
                    {(remainingSeconds % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Медиафайлы защищены в изолированной базе данных vault_history.db и скрыты от общей галереи и поисков.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => fetchVaultMediaItems()}
              title="Обновить содержимое"
              disabled={loadingVaultFiles}
              className="p-2 rounded-xl text-xs font-semibold bg-card border border-border/80 hover:bg-muted text-foreground transition-colors"
            >
              <RefreshCw size={14} className={loadingVaultFiles ? 'animate-spin' : ''} />
            </button>

            <button
              type="button"
              onClick={() => lockVault()}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-card border border-border/80 hover:bg-muted text-foreground transition-colors flex items-center gap-2"
            >
              <Lock size={14} />
              <span>Заблокировать</span>
            </button>
          </div>
        </div>

        {/* Private Media Files Grid */}
        {loadingVaultFiles ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-2xl bg-muted/40 animate-pulse border border-border/50"
              />
            ))}
          </div>
        ) : formattedVaultFiles.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/80 p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto my-8">
            <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-4">
              <FolderLock size={32} />
            </div>
            <h3 className="text-base font-bold text-foreground">В личной папке пока нет файлов</h3>
            <p className="text-xs text-muted-foreground mt-2 max-w-sm leading-relaxed">
              Чтобы переместить фото или видео в личную папку, откройте его в галерее и нажмите кнопку
              <strong className="text-foreground"> «Переместить в личную папку»</strong>. Файл будет изолирован и доступен только здесь после ввода PIN-кода.
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-6 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 transition-colors"
            >
              Перейти в галерею
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {formattedVaultFiles.map((file, idx) => {
              const thumbUrl = `/api/media/thumbnail?file=${encodeURIComponent(file.file_path || file.filename)}${vaultToken ? `&vault_token=${encodeURIComponent(vaultToken)}` : ''}`;

              return (
                <div
                  key={file.file_path || file.filename || idx}
                  onClick={() => setSelectedFile(file)}
                  className="group aspect-square rounded-2xl overflow-hidden bg-card border border-border/70 relative flex items-center justify-center text-muted-foreground shadow-xs hover:border-primary transition-all cursor-pointer"
                >
                  <img
                    src={thumbUrl}
                    alt={file.filename}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />

                  {/* Fallback icon if image fails or loading */}
                  <div className="absolute inset-0 -z-10 flex flex-col items-center justify-center bg-muted/20 text-muted-foreground">
                    {file.is_video ? <Play size={24} /> : <FileImage size={24} />}
                  </div>

                  {/* Video Badge */}
                  {file.is_video && (
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold flex items-center gap-1">
                      <Play size={10} fill="currentColor" />
                      <span>ВИДЕО</span>
                    </div>
                  )}

                  {/* File Info Overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end">
                    <p className="font-semibold truncate text-[11px]">{file.filename}</p>
                    <p className="text-[10px] text-white/70">
                      {file.media_date || file.capture_date || 'Без даты'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Media Viewer Lightbox Modal */}
        {selectedFile && (
          <MediaViewerModal
            isOpen={true}
            mediaFile={selectedFile}
            onClose={() => setSelectedFile(null)}
            currentIndex={formattedVaultFiles.indexOf(selectedFile)}
            totalFiles={formattedVaultFiles.length}
            onPrev={() => {
              const idx = formattedVaultFiles.indexOf(selectedFile);
              if (idx > 0) setSelectedFile(formattedVaultFiles[idx - 1]);
            }}
            onNext={() => {
              const idx = formattedVaultFiles.indexOf(selectedFile);
              if (idx < formattedVaultFiles.length - 1) setSelectedFile(formattedVaultFiles[idx + 1]);
            }}
            hasPrev={formattedVaultFiles.indexOf(selectedFile) > 0}
            hasNext={formattedVaultFiles.indexOf(selectedFile) < formattedVaultFiles.length - 1}
            onRefresh={fetchVaultMediaItems}
            vaultToken={vaultToken}
            onMediaUpdated={(updated: any) => {
              if (updated && !updated.is_vault) {
                // Was removed from vault
                setSelectedFile(null);
                fetchVaultMediaItems();
              }
            }}
          />
        )}
      </div>
    );
  }

  // 3. UNLOCK SCREEN WITH RECOVERY OPTION
  return (
    <div className="min-h-[calc(100vh-64px-36px)] w-full flex items-center justify-center p-4 bg-gradient-to-br from-indigo-900/10 via-background to-primary/5 select-none animate-in fade-in duration-300">
      <div
        className={cn(
          'w-full max-w-md bg-card/95 backdrop-blur-md border border-border/80 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center transition-transform',
          shake && 'animate-shake'
        )}
      >
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shadow-xs">
          <KeyRound size={30} />
        </div>

        <h1 className="text-xl font-extrabold text-foreground">
          Личная защищённая папка
        </h1>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Введите ваш PIN-код для доступа к личным медиафайлам (по умолчанию: <span className="font-mono font-bold text-primary">123456</span>)
        </p>

        {/* 6-Digit Segmented PIN Inputs */}
        <div className="flex items-center gap-2.5 my-8">
          {pinDigits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              className={cn(
                'w-11 h-14 text-center text-xl font-bold rounded-2xl border bg-muted/30 text-foreground transition-all duration-200 outline-none',
                digit ? 'border-primary ring-2 ring-primary/20 bg-background' : 'border-border/80',
                unlockError && 'border-destructive ring-2 ring-destructive/20'
              )}
            />
          ))}
        </div>

        {/* Error Notification */}
        {unlockError && (
          <div className="flex items-center gap-1.5 text-xs text-destructive font-semibold mb-4 animate-in fade-in">
            <AlertCircle size={14} />
            <span>{unlockError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex-1 py-3 rounded-xl border border-border/80 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft size={14} />
            <span>Отмена</span>
          </button>

          <button
            type="button"
            disabled={isSubmittingUnlock}
            onClick={() => executeUnlock(pinDigits.join(''))}
            className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2"
          >
            {isSubmittingUnlock ? (
              <>
                <RefreshCw className="animate-spin" size={14} />
                <span>Проверка...</span>
              </>
            ) : (
              <span>Разблокировать</span>
            )}
          </button>
        </div>

        {/* Forgot PIN / Recovery Link */}
        <div className="mt-4 pt-3 border-t border-border/60 w-full flex items-center justify-center">
          <button
            type="button"
            onClick={() => {
              setShowRecoveryModal(true);
              setRecoveryStep('email');
              setRecoveryMsg(null);
            }}
            className="text-xs text-primary hover:underline font-medium flex items-center gap-1.5"
          >
            <Mail size={13} />
            <span>Забыли PIN-код? Восстановить через e-mail</span>
          </button>
        </div>
      </div>

      {/* Recovery Modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-card border border-border/80 rounded-3xl p-6 shadow-2xl relative text-left">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Shield size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Восстановление PIN-кода</h3>
                <p className="text-[11px] text-muted-foreground">Сброс PIN-кода личной папки</p>
              </div>
            </div>

            {recoveryStep === 'email' ? (
              <form onSubmit={handleRequestRecovery} className="space-y-3.5 mt-4">
                <p className="text-xs text-muted-foreground">
                  Код восстановления будет отправлен на e-mail, привязанный к вашему профилю.
                </p>

                {userEmail ? (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-muted/30">
                    <Mail size={14} className="text-primary shrink-0" />
                    <span className="text-xs font-mono text-foreground truncate">{userEmail}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs">
                    <AlertCircle size={14} />
                    <span>E-mail не привязан к профилю пользователя. Восстановление через e-mail недоступно.</span>
                  </div>
                )}

                {recoveryMsg && (
                  <div
                    className={cn(
                      'text-xs p-2.5 rounded-xl border font-medium flex items-center gap-1.5',
                      recoveryMsg.isError
                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : 'bg-[#2dc071]/10 text-[#2dc071] border-[#2dc071]/20'
                    )}
                  >
                    {recoveryMsg.isError ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                    <span>{recoveryMsg.text}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRecoveryModal(false)}
                    className="flex-1 py-2 rounded-xl border border-border/80 text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={recoveryLoading || !userEmail}
                    className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {recoveryLoading ? <RefreshCw className="animate-spin" size={13} /> : null}
                    <span>Отправить код</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPin} className="space-y-3 mt-3">
                <p className="text-xs text-muted-foreground">
                  Код подтверждения отправлен. Введите его и задайте новый PIN-код.
                </p>

                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Код из письма
                  </label>
                  <input
                    type="text"
                    required
                    value={recoveryCodeInput}
                    onChange={(e) => setRecoveryCodeInput(e.target.value.trim())}
                    placeholder="6-значный код"
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-muted/30 text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Новый PIN-код
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={recoveryNewPin}
                    onChange={(e) => setRecoveryNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-muted/30 text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Подтвердите новый PIN-код
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={recoveryConfirmPin}
                    onChange={(e) => setRecoveryConfirmPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-3 py-2 rounded-xl border border-border/80 bg-muted/30 text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {recoveryMsg && (
                  <div
                    className={cn(
                      'text-xs p-2.5 rounded-xl border font-medium flex items-center gap-1.5',
                      recoveryMsg.isError
                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : 'bg-[#2dc071]/10 text-[#2dc071] border-[#2dc071]/20'
                    )}
                  >
                    {recoveryMsg.isError ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                    <span>{recoveryMsg.text}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRecoveryStep('email')}
                    className="flex-1 py-2 rounded-xl border border-border/80 text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    Назад
                  </button>
                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 flex items-center justify-center gap-1.5"
                  >
                    {recoveryLoading ? <RefreshCw className="animate-spin" size={13} /> : null}
                    <span>Сбросить PIN</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LockedFolderScreen;
