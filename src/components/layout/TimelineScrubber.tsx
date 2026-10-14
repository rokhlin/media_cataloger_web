import React, { useState, useEffect } from 'react';
import { cn } from '@/utils';
import { mediaCacheService } from '../../services/mediaCacheService';
import { useNavigate } from 'react-router-dom';

export interface TimelineScrubberProps {
  years?: number[];
  activeYear?: number;
  onSelectYear?: (year: number) => void;
  className?: string;
}

export function extractMediaYear(file: any): number | null {
  if (!file) return null;
  const candidates = [
    file.capture_date,
    file.media_date,
    file.exif?.DateTimeOriginal,
    file.exif?.CreateDate,
    file.date_taken,
    file.created_at,
  ];
  for (const c of candidates) {
    if (c) {
      const str = String(c).trim();
      const match = str.match(/\b(19\d\d|20\d\d)\b/);
      if (match) {
        const y = parseInt(match[1], 10);
        if (y >= 1900 && y <= 2035) return y;
      }
    }
  }
  // Fallback to mtime (seconds or milliseconds)
  if (typeof file.mtime === 'number' && file.mtime > 0) {
    const ms = file.mtime < 10000000000 ? file.mtime * 1000 : file.mtime;
    const y = new Date(ms).getFullYear();
    if (!isNaN(y) && y >= 1970 && y <= 2035) return y;
  }
  return null;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  years: propYears,
  activeYear: propActiveYear,
  onSelectYear,
  className,
}) => {
  const navigate = useNavigate();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [detectedYears, setDetectedYears] = useState<number[]>([]);

  // Dynamically extract real years from mediaCacheService
  useEffect(() => {
    const computeYears = () => {
      const files = mediaCacheService.getAll();
      if (files && files.length > 0) {
        const set = new Set<number>();
        for (const file of files) {
          const yr = extractMediaYear(file);
          if (yr !== null) {
            set.add(yr);
          }
        }
        if (set.size > 0) {
          setDetectedYears(Array.from(set).sort((a, b) => b - a));
        }
      }
    };

    computeYears();
    window.addEventListener('media_uploaded', computeYears);
    window.addEventListener('media_loaded', computeYears);
    const interval = setInterval(computeYears, 2000);
    return () => {
      window.removeEventListener('media_uploaded', computeYears);
      window.removeEventListener('media_loaded', computeYears);
      clearInterval(interval);
    };
  }, []);

  const effectiveYears = propYears || detectedYears;
  const effectiveActiveYear = propActiveYear || effectiveYears[0];

  if (!effectiveYears || effectiveYears.length === 0) {
    return null;
  }

  const handleYearClick = (year: number) => {
    if (onSelectYear) {
      onSelectYear(year);
    } else {
      navigate(`/photos?q=${year}`);
    }
  };

  const months = ['Дек', 'Окт', 'Авг', 'Июн', 'Апр', 'Фев'];

  return (
    <aside
      aria-label="Временная шкала хронологии"
      className={cn(
        'hidden lg:flex flex-col items-center justify-center py-6 px-1.5 select-none z-20 shrink-0',
        className
      )}
    >
      <div className="flex flex-col items-center gap-1.5 py-3 px-1.5 rounded-full bg-card/60 backdrop-blur-md border border-border/40 shadow-xs">
        {effectiveYears.map((year, idx) => {
          const isActive = year === effectiveActiveYear;

          return (
            <React.Fragment key={year}>
              {/* Year Button */}
              <div className="relative group flex items-center">
                <button
                  type="button"
                  onClick={() => handleYearClick(year)}
                  onMouseEnter={() => setHoveredItem(`${year}`)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={cn(
                    'text-[10px] font-mono font-bold tracking-tighter px-1 py-0.5 rounded transition-all duration-150',
                    isActive
                      ? 'text-primary scale-110 font-extrabold'
                      : 'text-muted-foreground/80 hover:text-foreground hover:scale-105'
                  )}
                  aria-label={`Перейти к ${year} году`}
                >
                  {year}
                </button>

                {/* Hover Tooltip Floating to Left */}
                {hoveredItem === `${year}` && (
                  <div className="absolute right-full mr-2.5 px-2.5 py-1 bg-card border border-border shadow-md rounded-lg text-xs font-semibold text-foreground whitespace-nowrap animate-in fade-in zoom-in-95 pointer-events-none">
                    {year} год
                  </div>
                )}
              </div>

              {/* Month Dots between Years (render for first few years) */}
              {idx < 3 && (
                <div className="flex flex-col items-center gap-1 py-0.5">
                  {months.slice(0, 3).map((month) => {
                    const dotKey = `${year}-${month}`;
                    return (
                      <div key={dotKey} className="relative group flex items-center">
                        <button
                          type="button"
                          onMouseEnter={() => setHoveredItem(dotKey)}
                          onMouseLeave={() => setHoveredItem(null)}
                          onClick={() => handleYearClick(year)}
                          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 hover:bg-primary hover:scale-150 transition-all"
                          aria-label={`${month} ${year}`}
                        />
                        {hoveredItem === dotKey && (
                          <div className="absolute right-full mr-2 px-2 py-0.5 bg-card border border-border shadow-md rounded text-[11px] font-medium text-foreground whitespace-nowrap animate-in fade-in pointer-events-none">
                            {month} {year}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </aside>
  );
};

export default TimelineScrubber;
