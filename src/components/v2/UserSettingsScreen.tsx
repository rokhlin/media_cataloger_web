import React, { useState, useEffect } from 'react';
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
  FolderPlus,
} from 'lucide-react';
import { useAuth } from '../../services/authContext';

export const UserSettingsScreen: React.FC = () => {
  const { currentUser } = useAuth();
  const [expandedSection, setExpandedSection] = useState<string | null>('account');
  const [configuredFolders, setConfiguredFolders] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && Array.isArray(data.input_folders)) {
          setConfiguredFolders(data.input_folders);
        }
      })
      .catch(() => {});
  }, []);

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  const sections = [
    {
      id: 'account',
      title: 'Учётная запись и профиль',
      subtitle: 'Имя пользователя, адрес электронной почты и аватар',
      icon: User,
      renderContent: () => (
        <div className="space-y-4 pt-3">
          {/* New User Configuration Prompt if zero folders configured */}
          {configuredFolders.length === 0 && (
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-foreground">Начало работы: каталоги не настроены</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Укажите папки на диске с фотографиями и видеозаписями для запуска каталогизатора.
                </p>
              </div>
              <Link
                to="/onboarding"
                className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs shrink-0 flex items-center gap-1.5"
              >
                <FolderPlus size={14} />
                <span>Настроить папки</span>
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Имя пользователя
              </label>
              <input
                type="text"
                defaultValue={currentUser?.username || 'Anton Rokhlin'}
                className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Email
              </label>
              <input
                type="email"
                defaultValue="user@example.local"
                className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs"
            >
              <Save size={14} />
              <span>Сохранить изменения</span>
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
      id: 'ai-features',
      title: 'Функции искусственного интеллекта',
      subtitle: 'Распознавание лиц, векторизация CLIP, поиск дубликатов',
      icon: Sparkles,
      renderContent: () => (
        <div className="space-y-3 pt-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" defaultChecked className="rounded text-primary focus:ring-primary" />
            <span className="text-foreground font-medium">
              Кластеризация лиц и распознавание людей на фото
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" defaultChecked className="rounded text-primary focus:ring-primary" />
            <span className="text-foreground font-medium">
              Семантический поиск по описаниям сцен (CLIP)
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
          <div className="max-w-md space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Текущий пароль
              </label>
              <input
                type="password"
                className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Новый пароль
              </label>
              <input
                type="password"
                className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-sm outline-none"
              />
            </div>
            <button
              type="button"
              className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs"
            >
              Обновить пароль
            </button>
          </div>
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
          Конфигурация профиля, дискового пространства, искусственного интеллекта и безопасности.
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
