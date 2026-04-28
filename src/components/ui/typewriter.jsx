import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * A typewriter effect component that cycles through an array of labels.
 * 
 * @component
 * @param {Object} props
 * @param {string[]} props.labels - Array of strings to cycle through
 * @param {number} [props.typeSpeed=100] - Speed of typing in ms
 * @param {number} [props.backSpeed=50] - Speed of deleting in ms
 * @param {number} [props.delay=2000] - Pause duration before deleting in ms
 */
const Typewriter = ({ labels, typeSpeed = 100, backSpeed = 50, delay = 2000 }) => {
    const [displayText, setDisplayText] = useState('');
    const [labelIndex, setLabelIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        const currentLabel = labels[labelIndex];
        
        // Determine the speed based on current action
        let speed = isDeleting ? backSpeed : typeSpeed;
        if (isPaused) speed = delay;

        const handleTick = () => {
            if (isPaused) {
                setIsPaused(false);
                setIsDeleting(true);
                return;
            }

            if (!isDeleting) {
                const nextText = currentLabel.substring(0, displayText.length + 1);
                setDisplayText(nextText);

                if (nextText === currentLabel) {
                    setIsPaused(true);
                }
            } else {
                const nextText = currentLabel.substring(0, displayText.length - 1);
                setDisplayText(nextText);

                if (nextText === '') {
                    setIsDeleting(false);
                    setLabelIndex((prev) => (prev + 1) % labels.length);
                }
            }
        };

        const timeout = setTimeout(handleTick, speed);
        return () => clearTimeout(timeout);
    }, [displayText, isDeleting, isPaused, labelIndex, labels, typeSpeed, backSpeed, delay]);

    return (
        <span className="inline-flex items-center">
            {displayText}
            <span className="ml-1 border-r-2 border-current h-5 animate-pulse" aria-hidden="true"></span>
        </span>
    );
};

Typewriter.propTypes = {
    labels: PropTypes.arrayOf(PropTypes.string).isRequired,
    typeSpeed: PropTypes.number,
    backSpeed: PropTypes.number,
    delay: PropTypes.number,
};

export default Typewriter;
