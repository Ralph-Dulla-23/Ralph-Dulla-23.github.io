import React, { useEffect, useState, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ActivityTimerProvider } from './context/TimerContext';
import RequireAuth from './components/auth/RequireAuth';
import DiaryShell from './components/diary/DiaryShell';

const PortfolioPage = lazy(() => import('./pages/PortfolioHomePage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const GamesPage = lazy(() => import('./pages/app/GamesPage'));
const BooksPage = lazy(() => import('./pages/app/BooksPage'));
const DiaryHomePage = lazy(() => import('./pages/app/HomePage'));
const CalendarPage = lazy(() => import('./pages/app/CalendarPage'));
const JournalPage = lazy(() => import('./pages/app/JournalPage'));
const InsightsPage = lazy(() => import('./pages/app/InsightsPage'));
const BookDetailPage = lazy(() => import('./pages/app/BookDetailPage'));
const GameDetailPage = lazy(() => import('./pages/app/GameDetailPage'));

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    if (!location.pathname.startsWith('/app')) window.scrollTo(0, 0);
  }, [location.pathname]);
  return null;
}

function PageLoader() {
  return (
    <div
      className="min-h-screen w-full bg-[#f9f9f9] dark:bg-[#030712] flex items-center justify-center"
      aria-label="Loading..."
    >
      <div className="w-8 h-8 border-2 border-gray-300 dark:border-gray-800 border-t-primary dark:border-t-gray-200 rounded-full animate-spin" />
    </div>
  );
}

function RootRoute({ darkMode, setDarkMode }) {
  // If running inside Capacitor native Android wrapper, redirect root to /app/home
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    return <Navigate to="/app/home" replace />;
  }
  return <PortfolioPage darkMode={darkMode} setDarkMode={setDarkMode} />;
}

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.style.backgroundColor = darkMode ? '#030712' : '#f9f9f9';
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  return (
    <AuthProvider>
      <ActivityTimerProvider>
        <HashRouter>
          <ScrollToTop />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Portfolio */}
              <Route path="/" element={<RootRoute darkMode={darkMode} setDarkMode={setDarkMode} />} />
              <Route path="/portfolio" element={<PortfolioPage darkMode={darkMode} setDarkMode={setDarkMode} />} />

              {/* Public Stats & Shelf */}
              <Route path="/library" element={<LibraryPage darkMode={darkMode} setDarkMode={setDarkMode} initialTab="books" />} />
              <Route path="/stats" element={<LibraryPage darkMode={darkMode} setDarkMode={setDarkMode} initialTab="games" />} />

              {/* Owner Sign In */}
              <Route path="/login" element={<LoginPage darkMode={darkMode} setDarkMode={setDarkMode} />} />

              {/* One persistent shell and one set of timer overlays across diary routes. */}
              <Route
                path="/app"
                element={
                  <RequireAuth>
                    <DiaryShell darkMode={darkMode} setDarkMode={setDarkMode}>
                      <Outlet />
                    </DiaryShell>
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="home" replace />} />
                <Route path="home" element={<DiaryHomePage darkMode={darkMode} setDarkMode={setDarkMode} />} />
                <Route path="library" element={<Navigate to="/app/library/books" replace />} />
                <Route path="library/books" element={<BooksPage darkMode={darkMode} setDarkMode={setDarkMode} />} />
                <Route path="library/games" element={<GamesPage darkMode={darkMode} setDarkMode={setDarkMode} />} />
                <Route path="calendar" element={<CalendarPage darkMode={darkMode} setDarkMode={setDarkMode} />} />
                <Route path="journal" element={<JournalPage darkMode={darkMode} setDarkMode={setDarkMode} />} />
                <Route path="insights" element={<InsightsPage darkMode={darkMode} setDarkMode={setDarkMode} />} />
                <Route path="books/:id" element={<BookDetailPage darkMode={darkMode} setDarkMode={setDarkMode} />} />
                <Route path="games/:id" element={<GameDetailPage darkMode={darkMode} setDarkMode={setDarkMode} />} />
                <Route path="books" element={<Navigate to="/app/library/books" replace />} />
                <Route path="games" element={<Navigate to="/app/library/games" replace />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </ActivityTimerProvider>
    </AuthProvider>
  );
}

export default App;