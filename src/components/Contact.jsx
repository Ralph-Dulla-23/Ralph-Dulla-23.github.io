import React, { useState, useRef } from 'react';
import emailjs from '@emailjs/browser';

const Contact = () => {
    const form = useRef();
    const [status, setStatus] = useState('');

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
                setTimeout(() => setStatus(''), 5000); // Clear success message after 5s
            }, (error) => {
                console.log(error.text);
                setStatus('error');
                setTimeout(() => setStatus(''), 5000);
            });
    };

    return (
        <section className="py-12 flex flex-col items-center text-center">
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-2">Get in Touch</h2>
                <p className="text-secondary dark:text-gray-400 text-sm max-w-sm mx-auto">
                    Whatever you need, I'm here.
                </p>
            </div>

            <form ref={form} onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
                <div className="space-y-1 text-left">
                    <input
                        type="text"
                        name="name" // Changed to match common EmailJS template
                        required
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-sm text-sm focus:outline-none focus:border-primary dark:focus:border-gray-500 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-600 dark:text-gray-200"
                        placeholder="Name"
                    />
                </div>

                <div className="space-y-1 text-left">
                    <input
                        type="email"
                        name="email" // Changed to match common EmailJS template
                        required
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-sm text-sm focus:outline-none focus:border-primary dark:focus:border-gray-500 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-600 dark:text-gray-200"
                        placeholder="Email"
                    />
                </div>

                <div className="space-y-1 text-left">
                    <textarea
                        name="message"
                        rows="3"
                        required
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-sm text-sm focus:outline-none focus:border-primary dark:focus:border-gray-500 transition-colors resize-none placeholder:text-gray-400 dark:placeholder:text-gray-600 dark:text-gray-200"
                        placeholder="Message"
                    ></textarea>
                </div>

                <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="w-full px-4 py-2 bg-primary dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-sm hover:bg-black/80 dark:hover:bg-gray-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                >
                    {status === 'sending' ? 'Sending...' : 'Send Message'}
                </button>

                {status === 'success' && (
                    <p className="text-green-600 dark:text-green-400 text-xs mt-2">Message sent successfully!</p>
                )}
                {status === 'error' && (
                    <p className="text-red-600 dark:text-red-400 text-xs mt-2">Failed to send message. Please try again.</p>
                )}
            </form>
        </section>
    );
};



export default Contact;
