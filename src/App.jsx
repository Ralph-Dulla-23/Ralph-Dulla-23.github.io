import React, { useEffect, useState, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Lenis from 'lenis';
import Layout from './components/Layout';
import Hero from './components/Hero';
import About from './components/About';
import Experience from './components/Experience';
import Projects from './components/Projects';
import Certificates from './components/Certificates';
import Library from './components/Library';
import Contact from './components/Contact';
import { useLocation } from 'react-router-dom';

const LibraryPage = lazy(() => import('./pages/LibraryPage'));

export const lenisRef = { current: null };

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function HomePage({ darkMode, setDarkMode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenisRef.current = lenis;

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
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
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage darkMode={darkMode} setDarkMode={setDarkMode} />} />
        <Route
          path="/library"
          element={
            <Suspense fallback={null}>
              <LibraryPage darkMode={darkMode} setDarkMode={setDarkMode} />
            </Suspense>
          }
        />
      </Routes>
    </HashRouter>
  );
}

export default App;