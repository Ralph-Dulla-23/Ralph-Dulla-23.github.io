import React from 'react';
import PropTypes from 'prop-types';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import {
    SiPython, SiDart, SiJavascript, SiMysql,
    SiNodedotjs, SiFirebase,
    SiGit, SiGithub,
    SiReact, SiTailwindcss, SiFlutter, SiFlask, SiNextdotjs, SiTypescript, SiFigma
} from 'react-icons/si';

import { FaJava } from "react-icons/fa";
import { VscCode, VscTerminal } from "react-icons/vsc";
import { BiLogoAndroid } from "react-icons/bi";

const TECH_COLORS = {
    python: 'text-blue-500',
    java: 'text-red-500',
    dart: 'text-blue-400',
    javascript: 'text-yellow-400',
    typescript: 'text-blue-600',
    mysql: 'text-blue-600',
    nextjs: 'text-black dark:text-white',
    react: 'text-cyan-400',
    tailwind: 'text-cyan-500',
    flutter: 'text-blue-400',
    nodejs: 'text-green-500',
    firebase: 'text-orange-500',
    flask: 'text-black dark:text-white',
    vscode: 'text-blue-500',
    git: 'text-orange-600',
    github: 'text-black dark:text-white',
    android: 'text-green-400',
    figma: 'text-pink-500',
};

const skills = {
    Languages: [
        { name: 'Python', icon: SiPython, color: TECH_COLORS.python },
        { name: 'Java', icon: FaJava, color: TECH_COLORS.java },
        { name: 'Dart', icon: SiDart, color: TECH_COLORS.dart },
        { name: 'JavaScript', icon: SiJavascript, color: TECH_COLORS.javascript },
        { name: 'TypeScript', icon: SiTypescript, color: TECH_COLORS.typescript },
        { name: 'SQL', icon: SiMysql, color: TECH_COLORS.mysql },
    ],
    Frameworks: [
        { name: 'Next.js', icon: SiNextdotjs, color: TECH_COLORS.nextjs },
        { name: 'React', icon: SiReact, color: TECH_COLORS.react },
        { name: 'Tailwind CSS',icon: SiTailwindcss, color: TECH_COLORS.tailwind   },
        { name: 'Flutter',     icon: SiFlutter,     color: TECH_COLORS.flutter   },
    ],
    Backend: [
        { name: 'Node.js',     icon: SiNodedotjs,   color: TECH_COLORS.nodejs  },
        { name: 'Firebase',    icon: SiFirebase,    color: TECH_COLORS.firebase },
        { name: 'Flask',       icon: SiFlask,       color: TECH_COLORS.flask },
    ],
    Tools: [
        { name: 'VS Code',     icon: VscCode,       color: TECH_COLORS.vscode   },
        { name: 'Git',         icon: SiGit,         color: TECH_COLORS.git },
        { name: 'GitHub',      icon: SiGithub,      color: TECH_COLORS.github },
        { name: 'Android Studio', icon: BiLogoAndroid, color: TECH_COLORS.android },
        { name: 'Figma',       icon: SiFigma,       color: TECH_COLORS.figma   },
    ],
};

const experience = [
    {
        role: 'University of Immaculate Conception',
        title: 'Bachelor of Science in Computer Science',
        period: 'July 2022 – April 2026',
        location: 'Davao City, Philippines',
        description: 'Graduated with a degree in Computer Science, building a foundation in software development, problem solving, and systems thinking.'
    },
    {
        role: 'Echoverse Digital Marketing Services',
        title: 'On the Job Training',
        period: 'Jan 2026 – March 2026',
        location: 'Davao City, Philippines',
        description: 'Contributed to real agency projects as a developer — built and maintained the company website, worked on chatbot automations, and integrated tracking tools like Meta Pixel. Gained hands-on experience shipping actual work in a live business environment.'
    },
    {
        role: 'Virtual Initiative for Building Engagement (VIBE)',
        title: 'Core Member',
        period: '2024 – 2025',
        location: 'Davao City, Philippines',
        description: 'Aimed to help and guide other junior members within the club.'
    },
    {
        role: 'Society of Information Technology Education Students (SITES)',
        title: 'Property Custodian',
        period: '2024 – 2024',
        location: 'Davao City, Philippines',
        description: 'Responsible for safeguarding organizational properties and assisting fellow members with various tasks.'
    },
    
    
];

const Experience = () => {
    const skillsRef = useScrollAnimation();
    const timelineRef = useScrollAnimation();

    return (
        <section id="experience" className="py-8 border-b border-border dark:border-gray-800">
            <div className="grid grid-cols-1 md:grid-cols-1 gap-10">
                {/* Core Skills Column */}
                <div ref={skillsRef} data-animate>
                    <h2 className="text-lg font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-8">Tech Stack</h2>
                    <div className="space-y-6">
                        {Object.entries(skills).map(([category, items]) => (
                            <div key={category}>
                                <h3 className="text-sm font-medium text-secondary dark:text-gray-400 mb-3 flex items-center gap-2">
                                    <span className="w-4 h-0.5 bg-border dark:bg-gray-700 inline-block"></span>
                                    {category}
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {items.map(skill => (
                                        <span
                                            key={skill.name}
                                            className="text-xs font-medium px-3 py-1.5 bg-gray-100/50 hover:bg-gray-200/70 dark:bg-gray-800 dark:hover:bg-gray-700 text-primary dark:text-gray-200 rounded-full border border-gray-200 dark:border-gray-700 transition-all duration-200 flex items-center gap-1.5 cursor-pointer hover:-translate-y-0.5"
                                        >
                                            <skill.icon className={`w-3.5 h-3.5 ${skill.color}`} />
                                            {skill.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Experience Column */}
                <div ref={timelineRef} data-animate>
                    <h2 className="text-lg font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-8">Experience</h2>
                    <div className="relative border-l border-border dark:border-gray-800 space-y-10 pl-7">
                        {experience.map((item, index) => (
                            <div key={index} className="relative">
                                {/* Timeline Dot */}
                                <span className="absolute -left-[37px] top-1.5 w-4 h-4 rounded-full bg-border dark:bg-gray-700 border-2 border-white dark:border-gray-900 ring-1 ring-white dark:ring-gray-800 transition-colors"></span>

                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline mb-1">
                                    <h3 className="text-base font-semibold text-primary dark:text-gray-100">{item.role}</h3>
                                    <span className="text-xs text-secondary dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-100 dark:border-gray-700">{item.period}</span>
                                </div>

                                <div className="text-sm font-medium text-primary/80 dark:text-gray-300 mb-2 italic">
                                    {item.title}
                                </div>

                                <p className="text-sm text-secondary dark:text-gray-400 leading-relaxed">
                                    {item.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Experience;
