import React, { useState, useRef } from 'react';
import emailjs from '@emailjs/browser';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const Contact = () => {
    const form = useRef();
    const [status, setStatus] = useState('');
    const animRef = useScrollAnimation();

    // EMAILJS CONFIGURATION
    const SERVICE_ID = 'service_s78ci6b';
    const TEMPLATE_ID = 'template_srs8y0m';
    const PUBLIC_KEY = 'RGlEFfKwYyqIePQsJ';

    const handleSubmit = (e) => {
        e.preventDefault();
        setStatus('sending');

        emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, form.current, PUBLIC_KEY)
            .then((result) => {
                console.log(result.text);
                setStatus('success');
                e.target.reset();
                setTimeout(() => setStatus(''), 5000);
            }, (error) => {
                console.log(error.text);
                setStatus('error');
                setTimeout(() => setStatus(''), 5000);
            });
    };

    const isSending = status === 'sending';

    return (
        <section id="contact" className="py-12 flex flex-col items-center text-center" ref={animRef} data-animate>
            <div className="mb-6">
                <h2 className="text-lg font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-2">Get in Touch</h2>
                <p className="text-secondary dark:text-gray-400 text-sm max-w-sm mx-auto">
                    Whatever you need, I'm here.
                </p>
            </div>

            <form ref={form} onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
                <div className="space-y-1 text-left">
                    <label htmlFor="contact-name" className="sr-only">Name</label>
                    <input
                        id="contact-name"
                        type="text"
                        name="name"
                        required
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:ring-gray-500/20 dark:focus:border-gray-500 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600 dark:text-gray-200"
                        placeholder="Name"
                    />
                </div>

                <div className="space-y-1 text-left">
                    <label htmlFor="contact-email" className="sr-only">Email</label>
                    <input
                        id="contact-email"
                        type="email"
                        name="email"
                        required
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:ring-gray-500/20 dark:focus:border-gray-500 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600 dark:text-gray-200"
                        placeholder="Email"
                    />
                </div>

                <div className="space-y-1 text-left">
                    <label htmlFor="contact-message" className="sr-only">Message</label>
                    <textarea
                        id="contact-message"
                        name="message"
                        rows="3"
                        required
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:ring-gray-500/20 dark:focus:border-gray-500 transition-all resize-none placeholder:text-gray-400 dark:placeholder:text-gray-600 dark:text-gray-200"
                        placeholder="Message"
                    ></textarea>
                </div>

                <button
                    type="submit"
                    disabled={isSending}
                    className="w-full px-4 py-2.5 bg-primary dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-md hover:bg-black/80 dark:hover:bg-gray-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2 cursor-pointer flex items-center justify-center gap-2"
                >
                    {isSending && (
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    )}
                    {isSending ? 'Sending...' : 'Send Message'}
                </button>

                {status === 'success' && (
                    <p className="text-green-600 dark:text-green-400 text-xs mt-2 animate-fade-in">
                        ✓ Message sent successfully!
                    </p>
                )}
                {status === 'error' && (
                    <p className="text-red-600 dark:text-red-400 text-xs mt-2 animate-fade-in">
                        Failed to send message. Please try again.
                    </p>
                )}
            </form>
        </section>
    );
};

export default Contact;
