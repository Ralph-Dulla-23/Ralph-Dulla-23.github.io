import React, { useEffect, useState, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Lenis from 'lenis';
import Layout from './components/Layout';
import Hero from './components/Hero';
import About from './components/About';
import Experience from './components/Experience';
import Projects from './components/Projects';
import Certificates from './components/Certificates';
import Library from './components/Library';
import Contact from './components/Contact';
import { AuthProvider } from './context/AuthContext';
import RequireAuth from './components/auth/RequireAuth';

const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const GamesPage = lazy(() => import('./pages/app/GamesPage'));
const BooksPage = lazy(() => import('./pages/app/BooksPage'));

// eslint-disable-next-line react-refresh/only-export-components
export const lenisRef = { current: null };

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
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

function HomePage({ darkMode, setDarkMode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenisRef.current = lenis;

    let rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return (
    <Layout darkMode={darkMode} setDarkMode={setDarkMode}>
      <Hero />
      <About />
      <Experience />
      <Projects />
      <Certificates />
      <Library />
      <Contact />
    </Layout>
  );
}

function RootRoute({ darkMode, setDarkMode }) {
  // If running inside Capacitor native Android wrapper, redirect root to /app/games
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    return <Navigate to="/app/games" replace />;
  }
  return <HomePage darkMode={darkMode} setDarkMode={setDarkMode} />;
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
      <HashRouter>
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Portfolio */}
            <Route path="/" element={<RootRoute darkMode={darkMode} setDarkMode={setDarkMode} />} />
            <Route path="/portfolio" element={<HomePage darkMode={darkMode} setDarkMode={setDarkMode} />} />

            {/* Public Stats & Shelf */}
            <Route path="/library" element={<LibraryPage darkMode={darkMode} setDarkMode={setDarkMode} initialTab="books" />} />
            <Route path="/stats" element={<LibraryPage darkMode={darkMode} setDarkMode={setDarkMode} initialTab="games" />} />

            {/* Owner Sign In */}
            <Route path="/login" element={<LoginPage darkMode={darkMode} setDarkMode={setDarkMode} />} />

            {/* Protected Owner Diary App */}
            <Route path="/app" element={<Navigate to="/app/games" replace />} />
            <Route
              path="/app/games"
              element={
                <RequireAuth>
                  <GamesPage darkMode={darkMode} setDarkMode={setDarkMode} />
                </RequireAuth>
              }
            />
            <Route
              path="/app/books"
              element={
                <RequireAuth>
                  <BooksPage darkMode={darkMode} setDarkMode={setDarkMode} />
                </RequireAuth>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;