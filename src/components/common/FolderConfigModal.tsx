import React, { useState, useEffect } from 'react';
import { Folder, HardDrive, Play, Save, X, Check, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/utils';

export interface FolderConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanStarted?: () => void;
}

export const FolderConfigModal: React.FC<FolderConfigModalProps> = ({
  isOpen,
  onClose,
  onScanStarted,
}) => {
  const [inputFolders, setInputFolders] = useState<string[]>(['']);
  const [outputFolder, setOutputFolder] = useState<string>('');
  const [modelProvider, setModelProvider] = useState<'local' | 'gemini'>('local');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load current settings from backend on open
  useEffect(() => {
    if (!isOpen) return;

    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.input_folders) && data.input_folders.length > 0) {
            setInputFolders(data.input_folders);
          } else if (Array.isArray(data.default_input_folders) && data.default_input_folders.length > 0) {
            setInputFolders(data.default_input_folders);
          }
          if (data.output_folder) {
            setOutputFolder(data.output_folder);
          } else if (data.default_output_folder) {
            setOutputFolder(data.default_output_folder);
          }
          if (data.model_provider) {
            setModelProvider(data.model_provider);
          }
        }
      } catch (e) {
        console.warn('Failed to load settings from /api/settings:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddFolder = () => {
    setInputFolders([...inputFolders, '']);
  };

  const handleRemoveFolder = (index: number) => {
    setInputFolders(inputFolders.filter((_, i) => i !== index));
  };

  const handleFolderChange = (index: number, value: string) => {
    const updated = [...inputFolders];
    updated[index] = value;
    setInputFolders(updated);
  };

  const handleSave = async (andScan = false) => {
    setIsLoading(true);
    setStatusMessage(null);

    const validFolders = inputFolders.map((f) => f.trim()).filter(Boolean);
    if (validFolders.length === 0) {
      setStatusMessage({ type: 'error', text: 'Укажите хотя бы одну папку для сканирования' });
      setIsLoading(false);
      return;
    }

    try {
      const payload: Record<string, any> = {
        input_folders: validFolders,
      };
      if (outputFolder.trim()) {
        payload.output_folder = outputFolder.trim();
      }
      if (modelProvider) {
        payload.model_provider = modelProvider;
      }

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Ошибка сохранения настроек');
      }

      if (andScan) {
        // Trigger pipeline run
        const runRes = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!runRes.ok) {
          const runErr = await runRes.json().catch(() => ({}));
          throw new Error(runErr.message || 'Не удалось запустить сканирование');
        }

        setStatusMessage({ type: 'success', text: 'Настройки сохранены, сканирование запущено!' });
        onScanStarted?.();
        setTimeout(() => onClose(), 1200);
      } else {
        setStatusMessage({ type: 'success', text: 'Настройки успешно сохранены!' });
        setTimeout(() => onClose(), 1000);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Ошибка выполнения операции' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-card border border-border/80 rounded-3xl p-6 sm:p-7 shadow-2xl relative space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Folder size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Настройка папок и подключения</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Укажите директории на диске, в которых хранятся фото и видео для каталогизации
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Input Folders List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Папки для сканирования (Input Folders)
            </label>
            <button
              type="button"
              onClick={handleAddFolder}
              className="flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
            >
              <Plus size={14} />
              <span>Добавить папку</span>
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {inputFolders.map((folder, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <HardDrive className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={folder}
                    onChange={(e) => handleFolderChange(index, e.target.value)}
                    placeholder="Например: C:\Photos или C:\projects\media_catalog\media_input"
                    className="w-full h-10 pl-9 pr-3 bg-muted/40 border border-border/70 rounded-xl text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {inputFolders.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFolder(index)}
                    className="p-2 text-muted-foreground hover:text-[#e74040] hover:bg-muted rounded-xl transition-colors"
                    title="Удалить строку"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-muted-foreground mr-1">Быстрые пресеты:</span>
            <button
              type="button"
              onClick={() => setInputFolders(['C:\\projects\\media_catalog\\media_input'])}
              className="px-2 py-1 rounded-lg text-[10px] bg-muted hover:bg-muted/80 text-foreground transition-colors font-mono"
            >
              media_input
            </button>
            <button
              type="button"
              onClick={() => setInputFolders(['C:\\Users\\rokhl\\Pictures'])}
              className="px-2 py-1 rounded-lg text-[10px] bg-muted hover:bg-muted/80 text-foreground transition-colors font-mono"
            >
              Pictures
            </button>
          </div>
        </div>

        {/* Output Folder */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Выходная папка метаданных (Output Folder)
          </label>
          <input
            type="text"
            value={outputFolder}
            onChange={(e) => setOutputFolder(e.target.value)}
            placeholder="C:\projects\media_catalog\media_output"
            className="w-full h-10 px-3 bg-muted/40 border border-border/70 rounded-xl text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={cn(
              'p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in',
              statusMessage.type === 'success'
                ? 'bg-[#2dc071]/15 text-[#2dc071] border border-[#2dc071]/30'
                : 'bg-[#e74040]/15 text-[#e74040] border border-[#e74040]/30'
            )}
          >
            {statusMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border/80 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Отмена
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleSave(false)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-primary/50 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
          >
            <Save size={15} />
            <span>Сохранить настройки</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleSave(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Play size={15} className="fill-white" />
            <span>Сохранить и запустить сканирование</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FolderConfigModal;
