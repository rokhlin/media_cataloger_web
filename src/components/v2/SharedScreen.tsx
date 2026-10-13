import React, { useState } from 'react';
import { Share2, Plus, Copy, Check, ExternalLink, Calendar, Users, Eye } from 'lucide-react';

export const SharedScreen: React.FC = () => {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const sharedLinks = [
    {
      id: 1,
      title: 'Фотографии из поездки в Рим',
      itemCount: 48,
      views: 124,
      createdAt: '10 фев 2025',
      expiresAt: 'Без ограничений',
      url: 'https://immich.local/s/rome-2025-vacation',
    },
    {
      id: 2,
      title: 'Семейная встреча — Юбилей',
      itemCount: 75,
      views: 38,
      createdAt: '01 фев 2025',
      expiresAt: 'До 01 марта 2025',
      url: 'https://immich.local/s/family-anniversary-75',
    },
  ];

  const handleCopy = (id: number, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <Share2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-extrabold text-foreground">Общие ссылки и альбомы</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Управляйте публичными ссылками доступа и совместными фотоальбомами.
          </p>
        </div>

        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-white shadow-xs transition-colors"
        >
          <Plus size={16} />
          <span>Создать ссылку</span>
        </button>
      </div>

      {/* Shared Links List */}
      <div className="space-y-4">
        {sharedLinks.map((link) => (
          <div
            key={link.id}
            className="bg-card border border-border/70 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs hover:border-primary/40 transition-colors"
          >
            <div className="space-y-1">
              <h3 className="font-bold text-base text-foreground">{link.title}</h3>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users size={14} />
                  {link.itemCount} файлов
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye size={14} />
                  {link.views} просмотров
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} />
                  Истекает: {link.expiresAt}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                type="button"
                onClick={() => handleCopy(link.id, link.url)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                {copiedId === link.id ? (
                  <>
                    <Check size={14} className="text-[#2dc071]" />
                    <span>Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Скопировать</span>
                  </>
                )}
              </button>

              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Открыть ссылку"
              >
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SharedScreen;
