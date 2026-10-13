import React, { useState } from 'react';
import { Trash2, RotateCcw, Image as ImageIcon } from 'lucide-react';

export const TrashScreen: React.FC = () => {
  const [items, setItems] = useState(
    Array.from({ length: 4 }).map((_, i) => ({
      id: i + 1,
      name: `TRASH_IMG_${300 + i}.JPG`,
      deletedDaysAgo: i + 2,
    }))
  );

  const handleEmptyTrash = () => {
    if (confirm('Вы уверены, что хотите безвозвратно удалить все файлы из корзины?')) {
      setItems([]);
    }
  };

  const handleRestore = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <Trash2 className="h-6 w-6 text-[#e74040]" />
            <h1 className="text-2xl font-extrabold text-foreground">Корзина</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Элементы в корзине будут автоматически удалены навсегда через 30 дней ({items.length} файлов).
          </p>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setItems([])}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-border/80 bg-card hover:bg-muted text-foreground transition-colors"
            >
              <RotateCcw size={14} className="text-primary" />
              <span>Восстановить все</span>
            </button>

            <button
              type="button"
              onClick={handleEmptyTrash}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#e74040] hover:bg-[#d63030] text-white shadow-xs transition-colors"
            >
              <Trash2 size={14} />
              <span>Очистить корзину</span>
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Trash2 size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-base text-foreground">Корзина пуста</p>
          <p className="text-xs mt-1">Здесь нет удалённых медиафайлов.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative aspect-square rounded-2xl overflow-hidden bg-card border border-border/70 shadow-xs hover:border-[#e74040]/60 transition-all cursor-pointer"
            >
              <div className="w-full h-full bg-gradient-to-tr from-stone-700 to-stone-900 flex items-center justify-center text-white/30">
                <ImageIcon size={32} />
              </div>

              <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-between">
                <div>
                  <p className="font-medium truncate max-w-[90px]">{item.name}</p>
                  <p className="text-[10px] text-white/70">Осталось {30 - item.deletedDaysAgo} дн.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(item.id)}
                  className="p-1 rounded bg-white/20 hover:bg-white/40 text-white"
                  title="Восстановить"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrashScreen;
