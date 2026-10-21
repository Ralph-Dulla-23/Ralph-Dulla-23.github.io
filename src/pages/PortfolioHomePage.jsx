import React, { useEffect } from 'react';
import Lenis from 'lenis';
import Layout from '../components/Layout';
import Hero from '../components/Hero';
import About from '../components/About';
import Experience from '../components/Experience';
import Projects from '../components/Projects';
import Certificates from '../components/Certificates';
import Library from '../components/Library';
import Contact from '../components/Contact';
import { lenisRef } from '../lib/scrollController';

/** Lazy public-only bundle: never load portfolio graphics/Lenis in the Android diary. */
export default function PortfolioHomePage({ darkMode, setDarkMode }) {
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || window.Capacitor?.isNativePlatform?.()) return undefined;
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;
    let rafId = 0;
    function raf(time) {
      rafId = 0;
      if (document.hidden) return;
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    const onVisibility = () => {
      if (!document.hidden && !rafId) rafId = requestAnimationFrame(raf);
    };
    document.addEventListener('visibilitychange', onVisibility);
    rafId = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibility);
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
