import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Crop, X, Check, Image as ImageIcon, User, AlertCircle, RefreshCw } from 'lucide-react';

export interface ManualFaceCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  knownPersons?: Array<{ id?: string | number; name: string; avatar_url?: string; avatarUrl?: string | null }>;
  initialPhotoPath?: string;
  onSuccess?: () => void;
}

export const ManualFaceCropModal: React.FC<ManualFaceCropModalProps> = ({
  isOpen,
  onClose,
  knownPersons = [],
  initialPhotoPath = '',
  onSuccess,
}) => {
  const [photoPath, setPhotoPath] = useState('');
  const [personName, setPersonName] = useState('');
  const [personId, setPersonId] = useState('');
  const [setAsPrimary, setSetAsPrimary] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Crop frame state in normalized percentages [0..100]
  const [crop, setCrop] = useState({ x: 25, y: 25, size: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialCrop, setInitialCrop] = useState({ x: 25, y: 25, size: 50 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPhotoPath(initialPhotoPath || '');
      setPersonName('');
      setPersonId('');
      setSetAsPrimary(true);
      setError(null);
      setCrop({ x: 25, y: 25, size: 50 });
    }
  }, [isOpen, initialPhotoPath]);

  // Handle Dragging
  const handleMouseDownCrop = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialCrop({ ...crop });
  };

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialCrop({ ...crop });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100;

    if (isDragging) {
      const newX = Math.max(0, Math.min(100 - initialCrop.size, initialCrop.x + deltaX));
      const newY = Math.max(0, Math.min(100 - initialCrop.size, initialCrop.y + deltaY));
      setCrop((prev) => ({ ...prev, x: newX, y: newY }));
    } else if (isResizing) {
      const deltaSize = Math.max(deltaX, deltaY);
      const maxSize = Math.min(100 - initialCrop.x, 100 - initialCrop.y);
      const newSize = Math.max(15, Math.min(maxSize, initialCrop.size + deltaSize));
      setCrop((prev) => ({ ...prev, size: newSize }));
    }
  }, [isDragging, isResizing, dragStart, initialCrop]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoPath.trim()) {
      setError('Укажите путь к исходной фотографии');
      return;
    }
    if (!personName.trim()) {
      setError('Укажите имя персоны');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const img = imageRef.current;
      const naturalWidth = img?.naturalWidth || 1000;
      const naturalHeight = img?.naturalHeight || 1000;

      // Convert percentage crop to actual pixel coordinates
      const pixelBox = {
        x: Math.round((crop.x / 100) * naturalWidth),
        y: Math.round((crop.y / 100) * naturalHeight),
        width: Math.round((crop.size / 100) * naturalWidth),
        height: Math.round((crop.size / 100) * naturalHeight),
      };

      const res = await fetch('/api/faces/manual-crop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_path: photoPath.trim(),
          crop_box: pixelBox,
          person_id: personId || undefined,
          person_name: personName.trim(),
          set_as_primary: setAsPrimary,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Ошибка сервера: ${res.status}`);
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Не удалось сохранить вырезанное лицо');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="manual-face-crop-modal"
      data-testid="manual-face-crop-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#111827] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#162032]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Вырезать лицо из фото вручную</h3>
              <p className="text-xs text-gray-400">
                Интерактивное кадрирование 1:1 для регистрации персон или обновления обложки
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 text-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Source Photo Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Путь к исходному фото
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                <ImageIcon className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={photoPath}
                onChange={(e) => setPhotoPath(e.target.value)}
                placeholder="/app/media_input/family/photo_2026.jpg"
                className="w-full pl-9 pr-4 py-2 bg-[#1F2937] border border-white/10 rounded-xl text-white text-xs font-mono placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Interactive Crop Canvas Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Область лица (1:1 Квадрат)
              </label>
              <span className="text-[11px] text-gray-400">
                Перемещайте рамку и тяните за правый нижний угол
              </span>
            </div>
            <div
              ref={containerRef}
              className="relative w-full h-72 bg-black/60 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center select-none"
            >
              {photoPath ? (
                <>
                  <img
                    ref={imageRef}
                    src={photoPath.startsWith('/') || photoPath.includes(':') ? `/api/media/stream?path=${encodeURIComponent(photoPath)}` : photoPath}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    onError={() => setError('Не удалось загрузить предпросмотр изображения по указанному пути')}
                  />
                  {/* Crop Frame Overlay */}
                  <div
                    style={{
                      left: `${crop.x}%`,
                      top: `${crop.y}%`,
                      width: `${crop.size}%`,
                      height: `${crop.size}%`,
                    }}
                    onMouseDown={handleMouseDownCrop}
                    className="absolute border-2 border-purple-500 bg-purple-500/10 cursor-move rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
                  >
                    {/* Centered Guide */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                      <div className="w-4 h-4 border-t border-l border-white" />
                    </div>
                    {/* Resize Handle */}
                    <div
                      onMouseDown={handleMouseDownResize}
                      className="absolute right-0 bottom-0 w-4 h-4 bg-purple-500 cursor-nwse-resize rounded-tl flex items-center justify-center shadow"
                    />
                  </div>
                </>
              ) : (
                <div className="text-center p-6 text-gray-500 space-y-2">
                  <ImageIcon className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-xs">Укажите путь к фото для отображения интерактивного кадрирования</p>
                </div>
              )}
            </div>
          </div>

          {/* Person Selector / Assignment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Имя персоны
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={personName}
                  onChange={(e) => {
                    setPersonName(e.target.value);
                    const match = knownPersons.find((p) => p.name.toLowerCase() === e.target.value.toLowerCase());
                    if (match) setPersonId(String(match.id || match.name));
                  }}
                  placeholder="Иван Иванов"
                  className="w-full pl-9 pr-4 py-2 bg-[#1F2937] border border-white/10 rounded-xl text-white text-xs font-medium placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Выбрать из существующих
              </label>
              <select
                value={personId}
                onChange={(e) => {
                  setPersonId(e.target.value);
                  const selected = knownPersons.find((p) => (p.id || p.name) === e.target.value);
                  if (selected) setPersonName(selected.name);
                }}
                className="w-full px-3 py-2 bg-[#1F2937] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
              >
                <option value="">-- Новая персона --</option>
                {knownPersons.map((p) => (
                  <option key={p.id || p.name} value={p.id || p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Primary Avatar Checkbox */}
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#1F2937]/50 border border-white/5 cursor-pointer hover:bg-[#1F2937] transition-colors">
            <input
              type="checkbox"
              checked={setAsPrimary}
              onChange={(e) => setSetAsPrimary(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 text-purple-600 focus:ring-purple-500 bg-[#111827]"
            />
            <div className="text-xs">
              <span className="font-semibold text-white">Сделать основным фото персоны (аватар)</span>
              <p className="text-gray-400 text-[11px]">
                Это изображение станет титульной обложкой в реестре лиц и древе
              </p>
            </div>
          </label>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !photoPath.trim() || !personName.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-900/30 flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Сохранение...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Сохранить лицо</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
