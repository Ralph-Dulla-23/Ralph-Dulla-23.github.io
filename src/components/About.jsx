import React from 'react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const About = () => {
    const animRef = useScrollAnimation();

    return (
        <section id="about" className="py-12 border-b border-border dark:border-gray-800 space-y-6" ref={animRef} data-animate>
            <h2 className="text-lg font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider">About</h2>

            <div className="prose prose-neutral max-w-none text-secondary dark:text-gray-400 leading-relaxed space-y-4">
                <p>
                    Hi, I'm Ralph. An Undergraduate Computer Science student passionate about the world in Technology.
                    I love exploring the world of coding and building whatever I imagine.
                </p>
                <p>
                    Beyond coding, I enjoy<b> gaming</b>, <b>watching movies</b>, and <b>listening to music</b>, I also enjoy <b>reading books</b> and I just started collecting books
                </p>
            </div>
        </section>
    );
};

export default About;
