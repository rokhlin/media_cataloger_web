import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AppRouter from './AppRouter';
import { LanguageProvider } from './i18n/LanguageContext';
import { ThemeProvider } from './theme/ThemeContext';
import { FeatureFlagsProvider } from './services/featureFlagsContext';

import { AuthProvider } from './services/authContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider>
          <FeatureFlagsProvider>
            <AppRouter />
          </FeatureFlagsProvider>
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  </StrictMode>
);
