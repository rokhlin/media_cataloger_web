import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../services/authContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { KeyRound, ShieldAlert, CheckCircle2, ArrowLeft } from 'lucide-react';

export interface LoginPageProps {
  initialMode?: 'login' | 'recovery';
}

export default function LoginPage({ initialMode = 'login' }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'recovery'>(initialMode);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Password Recovery state
  const [recoveryUsername, setRecoveryUsername] = useState('admin');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(username.trim(), password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'Неверный логин или пароль');
      }
    } catch {
      setError('Произошла непредвиденная ошибка при авторизации');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAdmin = () => {
    setUsername('admin');
    setPassword('Test2026');
    setError('');
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!recoveryUsername.trim()) {
      setError('Укажите имя пользователя');
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      setError('Новый пароль должен содержать не менее 4 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetPassword(recoveryUsername.trim(), newPassword, recoveryKey.trim());
      if (res.success) {
        setSuccessMessage('Пароль успешно изменён! Теперь вы можете войти в систему.');
        setUsername(recoveryUsername.trim());
        setPassword(newPassword);
        setTimeout(() => {
          setMode('login');
        }, 1500);
      } else {
        setError(res.error || 'Ошибка сброса пароля. Проверьте ключ восстановления.');
      }
    } catch {
      setError('Не удалось связаться с сервером для сброса пароля');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-card border rounded-2xl shadow-lg">
        {mode === 'login' ? (
          <>
            <div className="space-y-2 text-center">
              <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1">
                <KeyRound size={26} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Media Cataloger</h1>
              <p className="text-sm text-muted-foreground">Войдите в свою учетную запись</p>
            </div>

            {successMessage && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl text-xs">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs">
                <ShieldAlert size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Пользователь</label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  autoFocus
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">Пароль</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('recovery');
                      setError('');
                      setSuccessMessage('');
                    }}
                    className="text-xs text-primary hover:underline cursor-pointer"
                    id="btn-login-forgot-password"
                  >
                    Забыли пароль?
                  </button>
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading} id="btn-login-submit">
                {isLoading ? 'Вход...' : 'Войти'}
              </Button>

              <button
                type="button"
                onClick={handleQuickAdmin}
                className="w-full py-2 px-3 text-xs text-muted-foreground hover:text-foreground border border-dashed rounded-xl transition-colors hover:bg-muted/40 cursor-pointer"
                title="Заполнить логин admin и пароль Test2026"
              >
                🔑 Заполнить администратора (admin / Test2026)
              </button>
            </form>

            <div className="text-center text-sm pt-2 border-t border-border/60">
              <p className="text-xs text-muted-foreground">
                Нет аккаунта?{' '}
                <Link to="/register" className="text-primary hover:underline font-medium">
                  Зарегистрироваться
                </Link>
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2 text-center">
              <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1">
                <KeyRound size={26} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Восстановление пароля</h1>
              <p className="text-xs text-muted-foreground">Сброс пароля с помощью ключа восстановления</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs">
                <ShieldAlert size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl text-xs">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Имя пользователя (Логин)</label>
                <Input
                  type="text"
                  value={recoveryUsername}
                  onChange={(e) => setRecoveryUsername(e.target.value)}
                  placeholder="admin"
                  required
                  autoFocus
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Ключ восстановления / Мастер-код
                </label>
                <Input
                  type="text"
                  value={recoveryKey}
                  onChange={(e) => setRecoveryKey(e.target.value)}
                  placeholder="Введите ключ (например: Test2026)"
                  disabled={isLoading}
                />
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Для администратора системы: по умолчанию используется <span className="font-mono text-primary">Test2026</span> или мастер-ключ сервера.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Новый пароль</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Минимум 4 символа"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Подтверждение нового пароля</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Повторите новый пароль"
                  required
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading} id="btn-submit-reset-password">
                {isLoading ? 'Сброс пароля...' : 'Сбросить пароль'}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccessMessage('');
                }}
                className="w-full py-2 px-3 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 rounded-xl transition-colors hover:bg-muted/40 cursor-pointer"
                id="btn-back-to-login"
              >
                <ArrowLeft size={14} />
                <span>Вернуться к авторизации</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
