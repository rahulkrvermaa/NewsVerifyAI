import { useCallback, useState } from 'react';
import { Layout } from './components/Layout';
import { ToastContainer, type ToastMessage } from './components/Toast';
import { useTheme } from './hooks/useTheme';
import { AboutPage } from './pages/AboutPage';
import { EvidenceLibraryPage } from './pages/EvidenceLibraryPage';
import { HistoryPage } from './pages/HistoryPage';
import { NewInvestigationPage } from './pages/NewInvestigationPage';
import { OverviewPage } from './pages/OverviewPage';
import { ResultsPage } from './pages/ResultsPage';
import { SettingsPage } from './pages/SettingsPage';
import type { PageRoute } from './types';

export function App() {
  const { theme, toggleTheme } = useTheme();
  const [page, setPage] = useState<PageRoute>('overview');
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const openInvestigation = useCallback((articleId: string) => {
    setActiveArticleId(articleId);
    setPage('results');
  }, []);

  return (
    <Layout
      currentPage={page}
      onNavigate={setPage}
      theme={theme}
      onToggleTheme={toggleTheme}
    >
      {page === 'overview' && (
        <OverviewPage
          onNavigate={setPage}
          onOpenInvestigation={openInvestigation}
        />
      )}
      {page === 'new-investigation' && (
        <NewInvestigationPage
          onAnalysisComplete={openInvestigation}
          onNotify={notify}
        />
      )}
      {page === 'results' && activeArticleId && (
        <ResultsPage
          articleId={activeArticleId}
          onBack={() => setPage('history')}
          onNotify={notify}
        />
      )}
      {page === 'history' && (
        <HistoryPage
          onOpenInvestigation={openInvestigation}
          onStartNew={() => setPage('new-investigation')}
          onNotify={notify}
        />
      )}
      {page === 'evidence' && (
        <EvidenceLibraryPage onOpenInvestigation={openInvestigation} />
      )}
      {page === 'about' && <AboutPage />}
      {page === 'settings' && (
        <SettingsPage theme={theme} onToggleTheme={toggleTheme} />
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </Layout>
  );
}

export default App;
