import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/authContext';
import LeftNavSidebar from './LeftNavSidebar';
import TopNavBar from './TopNavBar';
import StatusBar from './StatusBar';
import TimelineScrubber from './TimelineScrubber';

export default function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, isLoading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !currentUser) {
      navigate('/login');
    }
  }, [currentUser, isLoading, navigate]);

  const isGalleryView = location.pathname === '/' || location.pathname === '/photos';

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      {/* Persistent / Adaptive Left Drawer */}
      <LeftNavSidebar
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      {/* Main Viewport Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Top App Bar */}
        <TopNavBar onMenuToggle={() => setMobileNavOpen(true)} />

        {/* Viewport Workspace */}
        <main className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* Scrollable Page Body */}
          <div className="flex-1 overflow-y-auto min-w-0">
            <Outlet />
          </div>

          {/* Right Floating Timeline Scrubber on Gallery */}
          {isGalleryView && (
            <div className="pr-2 py-4">
              <TimelineScrubber />
            </div>
          )}
        </main>

        {/* Global Bottom Status Bar */}
        <StatusBar
          progress={45}
          title="Фоновое сканирование медиатеки"
          detail="Обработано 1,240 из 2,800 файлов (AI индексация)"
          status="running"
        />
      </div>
    </div>
  );
}
