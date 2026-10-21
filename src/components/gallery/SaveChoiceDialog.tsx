import { useState } from 'react';
import { X, Copy, Save, RotateCcw } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export interface SaveChoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (choice: 'copy' | 'overwrite' | 'cancel') => void;
  fileName?: string;
  isSaving?: boolean;
}

export default function SaveChoiceDialog({
  isOpen,
  onClose,
  onConfirm,
  fileName = 'photo.jpg',
  isSaving = false,
}: SaveChoiceDialogProps) {
  const { language } = useLanguage();
  const [selectedChoice, setSelectedChoice] = useState<'copy' | 'overwrite' | 'cancel'>('copy');

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700/80 p-6 shadow-2xl space-y-5 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              {language === 'ru' ? 'Сохранение изменений' : 'Save Changes'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {language === 'ru'
                ? 'Выберите способ сохранения отредактированной фотографии:'
                : 'Choose how to save the edited photo:'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Options List */}
        <div className="space-y-3">
          {/* Option 1: Save as Copy (Default) */}
          <div
            onClick={() => setSelectedChoice('copy')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
              selectedChoice === 'copy'
                ? 'bg-primary/10 border-primary ring-1 ring-primary/40'
                : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/80'
            }`}
          >
            <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
              selectedChoice === 'copy' ? 'border-primary' : 'border-slate-500'
            }`}>
              {selectedChoice === 'copy' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Copy size={14} className="text-primary" />
                <span className="font-bold text-sm text-foreground">
                  {language === 'ru' ? 'Сохранить как копию' : 'Save as copy'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
                  {language === 'ru' ? 'По умолчанию' : 'Default'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {language === 'ru'
                  ? `Создать новый файл рядом с оригиналом (${fileName.replace(/\.[^/.]+$/, '')}_edited). Исходный снимок останется без изменений.`
                  : `Create a new file with _edited suffix. Original file remains untouched.`}
              </p>
            </div>
          </div>

          {/* Option 2: Overwrite Original */}
          <div
            onClick={() => setSelectedChoice('overwrite')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
              selectedChoice === 'overwrite'
                ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500/40'
                : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/80'
            }`}
          >
            <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
              selectedChoice === 'overwrite' ? 'border-amber-500' : 'border-slate-500'
            }`}>
              {selectedChoice === 'overwrite' && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Save size={14} className="text-amber-400" />
                <span className="font-bold text-sm text-foreground">
                  {language === 'ru' ? 'Сохранить в оригинал' : 'Save to original'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {language === 'ru'
                  ? 'Перезаписать исходный файл на диске. Исходная версия будет заменена отредактированной.'
                  : 'Overwrite original file on disk. The original file will be replaced.'}
              </p>
            </div>
          </div>

          {/* Option 3: Cancel */}
          <div
            onClick={() => setSelectedChoice('cancel')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
              selectedChoice === 'cancel'
                ? 'bg-rose-500/10 border-rose-500 ring-1 ring-rose-500/40'
                : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/80'
            }`}
          >
            <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
              selectedChoice === 'cancel' ? 'border-rose-500' : 'border-slate-500'
            }`}>
              {selectedChoice === 'cancel' && <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <RotateCcw size={14} className="text-rose-400" />
                <span className="font-bold text-sm text-rose-400">
                  {language === 'ru' ? 'Отменить' : 'Cancel'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {language === 'ru'
                  ? 'Закрыть без сохранения и отменить все внесенные изменения.'
                  : 'Discard all changes and exit edit mode without saving.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-colors"
          >
            {language === 'ru' ? 'Назад' : 'Back'}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedChoice)}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-xs font-bold text-white transition-all shadow-lg shadow-primary/25 disabled:opacity-50"
          >
            {isSaving
              ? (language === 'ru' ? 'Сохранение...' : 'Saving...')
              : (language === 'ru' ? 'Подтвердить' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
