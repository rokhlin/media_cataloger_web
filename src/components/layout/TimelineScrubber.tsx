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
          const f = file as any;
          const raw = f.date_taken || f.creation_time || f.created_at || f.timestamp || f.modified_time;
          if (raw) {
            const yr = new Date(raw).getFullYear();
            if (!isNaN(yr) && yr >= 1970 && yr <= 2035) {
              set.add(yr);
            }
          }
        }
        if (set.size > 0) {
          setDetectedYears(Array.from(set).sort((a, b) => b - a));
        }
      }
    };

    computeYears();
    window.addEventListener('media_uploaded', computeYears);
    return () => window.removeEventListener('media_uploaded', computeYears);
  }, []);

  const defaultYears = [2025, 2024, 2023, 2022, 2020, 2018, 2015, 2012, 2008];
  const effectiveYears = propYears || (detectedYears.length > 0 ? detectedYears : defaultYears);
  const effectiveActiveYear = propActiveYear || effectiveYears[0] || 2025;

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
