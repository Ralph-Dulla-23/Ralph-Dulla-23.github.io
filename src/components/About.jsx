import React from 'react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const About = () => {
    const animRef = useScrollAnimation();

    return (
        <section id="about" className="py-6 border-b border-border dark:border-gray-800 space-y-6" ref={animRef} data-animate>
            <h2 className="text-lg font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider">About</h2>

            <div className="prose prose-neutral max-w-none text-secondary dark:text-gray-400 leading-relaxed space-y-4">
                <p>
                    Hi, I'm <b>Ralph</b> — a <b>Computer Science graduate</b> who loves building things and figuring out how they work.
                    I lean heavily on <b>AI</b> as part of how I code: not as a shortcut, but as a way to move faster,
                    think sharper, and tackle problems I'd otherwise spend days on.
                </p>
                <p>
                    On the frontend side, I enjoy designing in <b>Figma</b> before touching code —
                    getting the layout and feel right first makes the build a lot smoother.
                </p>
                <p>
                    Outside of code, I <b>game</b>, watch <b>movies</b>, and listen to way too much <b>music</b>.
                    I also just got into <b>collecting books</b> — turns out reading is pretty good when you're not staring at a screen.
                </p>
            </div>
        </section>
    );
};

export default About;
