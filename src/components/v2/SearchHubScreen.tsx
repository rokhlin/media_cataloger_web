import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, MapPin, Smile, Sparkles, Calendar, ArrowRight } from 'lucide-react';

export const SearchHubScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'Все категории' },
    { id: 'people', label: 'Люди и лица' },
    { id: 'places', label: 'Гео-локации' },
    { id: 'memories', label: 'Воспоминания' },
    { id: 'documents', label: 'Документы и текст' },
  ];

  const peopleSamples = [
    { name: 'Анна', count: 184, avatar: '👩' },
    { name: 'Михаил', count: 142, avatar: '👨' },
    { name: 'Елена', count: 96, avatar: '👱‍♀️' },
    { name: 'Дмитрий', count: 78, avatar: '🧔' },
    { name: 'Без имени', count: 24, avatar: '👤' },
  ];

  const placeSamples = [
    { name: 'Алматы, Казахстан', count: 320, photoGradient: 'from-blue-600 to-indigo-800' },
    { name: 'Рим, Италия', count: 195, photoGradient: 'from-amber-500 to-red-700' },
    { name: 'Париж, Франция', count: 142, photoGradient: 'from-purple-600 to-pink-700' },
    { name: 'Санкт-Петербург', count: 88, photoGradient: 'from-teal-600 to-cyan-800' },
  ];

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
            Ищите фотографии по лицам, географическим координатам, датам или текстовым описаниям объектов.
          </p>

          {initialQuery && (
            <div className="mt-4 flex items-center gap-2 text-sm bg-card border border-border/80 rounded-xl px-4 py-2 w-fit">
              <Search size={16} className="text-primary" />
              <span>Результаты по запросу:</span>
              <span className="font-semibold text-primary">«{initialQuery}»</span>
            </div>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
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

      {/* People Carousel Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smile className="text-primary h-5 w-5" />
            <h2 className="text-lg font-bold text-foreground">Люди</h2>
          </div>
          <Link
            to="/people"
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <span>Посмотреть все лица</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {peopleSamples.map((person) => (
            <Link
              key={person.name}
              to={`/people?filter=${encodeURIComponent(person.name)}`}
              className="bg-card border border-border/70 hover:border-primary/50 rounded-2xl p-4 flex flex-col items-center text-center group transition-all hover:shadow-md"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl mb-3 group-hover:scale-105 transition-transform">
                {person.avatar}
              </div>
              <span className="font-semibold text-sm text-foreground truncate w-full">
                {person.name}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">
                {person.count} фото
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Places Grid Section */}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {placeSamples.map((place) => (
            <Link
              key={place.name}
              to={`/map?place=${encodeURIComponent(place.name)}`}
              className="group relative overflow-hidden rounded-2xl border border-border/70 h-36 flex flex-col justify-end p-4 transition-all hover:shadow-lg"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${place.photoGradient} opacity-80 group-hover:opacity-90 group-hover:scale-105 transition-all duration-300`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="relative z-10 text-white">
                <p className="font-bold text-sm truncate">{place.name}</p>
                <p className="text-xs text-white/80 mt-0.5">{place.count} медиафайлов</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* "On This Day" Memories Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="text-[#f3cd03] h-5 w-5" />
          <h2 className="text-lg font-bold text-foreground">В этот день — Воспоминания</h2>
        </div>

        <div className="bg-card border border-border/70 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
          <div className="w-full md:w-48 h-32 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-md">
            <span className="font-extrabold text-2xl">2 года назад</span>
          </div>
          <div className="flex-1 space-y-2">
            <span className="text-xs font-bold text-[#f3cd03] uppercase tracking-wider">
              13 октября 2024
            </span>
            <h3 className="text-xl font-bold text-foreground">
              Поездка в горы и золотая осень
            </h3>
            <p className="text-sm text-muted-foreground">
              42 снимка сделаны в этот день. Альбом содержит снимки с дрона и пейзажные панорамы.
            </p>
            <div className="pt-2">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-colors"
              >
                <span>Просмотреть фотографии воспоминания</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SearchHubScreen;
