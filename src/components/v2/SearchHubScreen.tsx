import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, MapPin, Smile, Sparkles, ArrowRight, Folder } from 'lucide-react';

export const SearchHubScreen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState('all');
  const [realPersons, setRealPersons] = useState<{ id: string; name: string; count?: number }[]>([]);

  useEffect(() => {
    fetch('/api/faces/persons')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setRealPersons(data);
        }
      })
      .catch(() => {});
  }, []);

  const categories = [
    { id: 'all', label: 'Все категории' },
    { id: 'people', label: 'Люди и лица', link: '/people' },
    { id: 'places', label: 'Гео-локации', link: '/map' },
    { id: 'albums', label: 'Альбомы', link: '/albums' },
    { id: 'favorites', label: 'Избранное', link: '/favorites' },
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (queryInput.trim()) {
      navigate(`/photos?q=${encodeURIComponent(queryInput.trim())}`);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Search Header Banner */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-border/80 rounded-3xl p-6 sm:p-8">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles size={14} />
            Интеллектуальный поиск V2
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            Поиск по всей медиатеке
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Ищите фотографии по именам файлов, распознанным лицам, каталогам или метаданным.
          </p>

          {/* Integrated Search Input Form */}
          <form onSubmit={handleSearchSubmit} className="mt-4 flex items-center gap-2 max-w-lg">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Поиск по имени файла, папке или тегам..."
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-card/90 border border-border/80 rounded-xl text-sm outline-none focus:border-primary shadow-xs"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-xs shrink-0"
            >
              Искать
            </button>
          </form>

          {initialQuery && (
            <div className="mt-4 flex items-center gap-2 text-sm bg-card border border-border/80 rounded-xl px-4 py-2 w-fit">
              <Search size={16} className="text-primary" />
              <span>Результаты по запросу:</span>
              <span className="font-semibold text-primary">«{initialQuery}»</span>
            </div>
          )}
        </div>

        {/* Category Navigation Pills */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveCategory(cat.id);
                if (cat.link) navigate(cat.link);
              }}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-card border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* People Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smile className="text-primary h-5 w-5" />
            <h2 className="text-lg font-bold text-foreground">Распознанные лица</h2>
          </div>
          <Link
            to="/people"
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <span>Посмотреть все лица</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {realPersons.length === 0 ? (
          <div className="p-8 text-center bg-card/60 border border-border/70 rounded-2xl">
            <p className="text-xs text-muted-foreground">
              Нет распознанных лиц в медиатеке. Запустите индексацию для автоматической кластеризации лиц.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {realPersons.slice(0, 5).map((person) => (
              <Link
                key={person.id || person.name}
                to={`/photos?person=${encodeURIComponent(person.name)}`}
                className="bg-card border border-border/70 hover:border-primary/50 rounded-2xl p-4 flex flex-col items-center text-center group transition-all hover:shadow-md"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl mb-3 group-hover:scale-105 transition-transform">
                  👤
                </div>
                <span className="font-semibold text-sm text-foreground truncate w-full">
                  {person.name}
                </span>
                {person.count !== undefined && (
                  <span className="text-xs text-muted-foreground mt-0.5">
                    {person.count} фото
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Places & Directories Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="text-[#2dc071] h-5 w-5" />
            <h2 className="text-lg font-bold text-foreground">Места и гео-локации</h2>
          </div>
          <Link
            to="/map"
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <span>Открыть интерактивную карту</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Link
            to="/map"
            className="bg-card border border-border/70 hover:border-primary/40 rounded-2xl p-5 flex items-center gap-4 transition-all hover:shadow-xs"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <MapPin size={24} />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">Интерактивная карта мира</p>
              <p className="text-xs text-muted-foreground mt-0.5">Кластеризация снимков по координатам GPS</p>
            </div>
          </Link>

          <Link
            to="/albums"
            className="bg-card border border-border/70 hover:border-primary/40 rounded-2xl p-5 flex items-center gap-4 transition-all hover:shadow-xs"
          >
            <div className="w-12 h-12 rounded-xl bg-[#f3cd03]/10 text-[#f3cd03] flex items-center justify-center shrink-0">
              <Folder size={24} />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">Коллекции и папки</p>
              <p className="text-xs text-muted-foreground mt-0.5">Группировка по структуре директорий</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default SearchHubScreen;
