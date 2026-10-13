import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Unlock, KeyRound, AlertCircle, ArrowLeft } from 'lucide-react';
import { cn } from '@/utils';

export const LockedFolderScreen: React.FC = () => {
  const navigate = useNavigate();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '', '', '']);
  const [hasError, setHasError] = useState(false);
  const [shake, setShake] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Auto-focus first digit on mount
    if (!isUnlocked) {
      inputRefs.current[0]?.focus();
    }
  }, [isUnlocked]);

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1); // Only allow 1 digit

    const newPin = [...pinDigits];
    newPin[index] = digit;
    setPinDigits(newPin);
    setHasError(false);

    // If entered a digit, auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 6 digits entered
    if (newPin.every((d) => d !== '')) {
      const fullPin = newPin.join('');
      validatePin(fullPin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const validatePin = (pin: string) => {
    // Valid sample pin: 123456 or 000000
    if (pin === '123456' || pin === '000000') {
      setIsUnlocked(true);
      setHasError(false);
    } else {
      setHasError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPinDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  if (isUnlocked) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
        {/* Unlocked Banner */}
        <div className="bg-[#2dc071]/10 border border-[#2dc071]/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2dc071]/20 flex items-center justify-center text-[#2dc071]">
              <Unlock size={20} />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-sm">Личная папка разблокирована</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Все файлы в этом хранилище зашифрованы и скрыты из основной галереи и поиска.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsUnlocked(false);
              setPinDigits(['', '', '', '', '', '']);
            }}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-card border border-border/80 hover:bg-muted text-foreground transition-colors flex items-center gap-2"
          >
            <Lock size={14} />
            <span>Заблокировать</span>
          </button>
        </div>

        {/* Private Media Files Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="group aspect-square rounded-2xl overflow-hidden bg-card border border-border/70 relative flex items-center justify-center text-muted-foreground shadow-xs hover:border-primary transition-colors cursor-pointer"
            >
              <div className="w-full h-full bg-gradient-to-tr from-slate-700 to-slate-900 flex flex-col items-center justify-center text-white/50">
                <Lock size={20} className="mb-2 text-primary" />
                <span className="text-[11px] font-mono">VAULT_{100 + i}.DAT</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px-36px)] w-full flex items-center justify-center p-4 bg-gradient-to-br from-indigo-900/10 via-background to-primary/5 select-none animate-in fade-in duration-300">
      {/* 6-Digit PIN Modal Card */}
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
          Введите ваш 6-значный PIN-код для доступа к зашифрованным файлам (тестовый PIN: <span className="font-mono font-bold text-primary">123456</span>)
        </p>

        {/* 6 Segmented PIN Inputs */}
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
                hasError && 'border-[#e74040] ring-2 ring-[#e74040]/20'
              )}
            />
          ))}
        </div>

        {/* Error Notification */}
        {hasError && (
          <div className="flex items-center gap-1.5 text-xs text-[#e74040] font-semibold mb-4 animate-in fade-in">
            <AlertCircle size={14} />
            <span>Неверный PIN-код. Попробуйте снова (123456)</span>
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
            onClick={() => validatePin(pinDigits.join(''))}
            className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <span>Разблокировать</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LockedFolderScreen;
