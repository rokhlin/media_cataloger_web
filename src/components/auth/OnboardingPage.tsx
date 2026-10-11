import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [folders, setFolders] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      // Typically we'd save these settings to /api/settings
      await fetch('/api/settings/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_folders: folders.split(',').map(s => s.trim()),
          openai_key: openaiKey,
          gemini_key: geminiKey
        })
      });
      // Redirect to main
      navigate('/');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="w-full max-w-lg p-8 space-y-6 bg-card border rounded-lg shadow-sm">
        
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-bold">Добро пожаловать</h1>
              <p className="text-muted-foreground">Давайте настроим ваш медиа каталог</p>
            </div>
            <p className="text-sm">
              Media Cataloger V2 поможет вам организовать ваши фотографии и видео, находить лица, и удалять дубликаты.
            </p>
            <div className="flex justify-end pt-4">
              <Button onClick={handleNext}>Начать настройку</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Папки с медиа</h2>
              <p className="text-sm text-muted-foreground">Где хранятся ваши фото и видео?</p>
            </div>
            <div className="space-y-2">
              <Input 
                type="text" 
                placeholder="C:\Photos, D:\Video"
                value={folders}
                onChange={(e) => setFolders(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Укажите абсолютные пути через запятую
              </p>
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handlePrev}>Назад</Button>
              <Button onClick={handleNext}>Далее</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">AI Интеграция</h2>
              <p className="text-sm text-muted-foreground">Ключи для нейросетей (опционально)</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">OpenAI API Key</label>
                <Input 
                  type="password" 
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Gemini API Key</label>
                <Input 
                  type="password" 
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handlePrev}>Назад</Button>
              <Button onClick={handleFinish} disabled={isLoading}>
                {isLoading ? 'Сохранение...' : 'Завершить'}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
