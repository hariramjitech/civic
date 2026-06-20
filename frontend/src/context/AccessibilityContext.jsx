import React, { createContext, useContext, useState, useEffect } from 'react';

const AccessibilityContext = createContext(null);

export const AccessibilityProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem('civic-theme') || 'light');
  const [contrast, setContrast] = useState(() => localStorage.getItem('civic-contrast') || 'normal');
  const [textSize, setTextSize] = useState(() => localStorage.getItem('civic-text-size') || 'normal');
  const [highlightFocus, setHighlightFocus] = useState(() => localStorage.getItem('civic-highlight-focus') === 'true');
  const [narrate, setNarrate] = useState(() => localStorage.getItem('civic-narrate') === 'true');

  useEffect(() => {
    // Apply theme
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('civic-theme', theme);
  }, [theme]);

  useEffect(() => {
    // Apply contrast
    document.documentElement.setAttribute('data-contrast', contrast);
    localStorage.setItem('civic-contrast', contrast);
  }, [contrast]);

  useEffect(() => {
    // Apply text size
    document.documentElement.setAttribute('data-text-size', textSize);
    localStorage.setItem('civic-text-size', textSize);
  }, [textSize]);

  useEffect(() => {
    // Apply highlight focus helper
    document.documentElement.setAttribute('data-highlight-focus', highlightFocus.toString());
    localStorage.setItem('civic-highlight-focus', highlightFocus.toString());
  }, [highlightFocus]);

  useEffect(() => {
    // Apply narrate preference
    localStorage.setItem('civic-narrate', narrate.toString());
  }, [narrate]);

  // Global speaker logic
  useEffect(() => {
    if (!narrate) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      return;
    }

    const speakText = (text) => {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    };

    const handleMouseOver = (e) => {
      const element = e.target.closest('button, a, h1, h2, h3, h4, h5, h6, select, textarea, input, [data-narrate], .card, .severity-badge, .status-pill, .stat-card, .glass-panel');
      if (!element) return;

      if (element === window._lastNarratedElement) return;
      window._lastNarratedElement = element;

      let textToSpeak = '';
      if (element.hasAttribute('data-narrate')) {
        textToSpeak = element.getAttribute('data-narrate');
      } else if (element.tagName.match(/^H[1-6]$/)) {
        textToSpeak = `Heading: ${element.innerText}`;
      } else if (element.tagName === 'BUTTON' || element.tagName === 'A') {
        const label = element.getAttribute('aria-label') || element.innerText;
        textToSpeak = `${element.tagName === 'BUTTON' ? 'Button' : 'Link'}: ${label}`;
      } else if (element.tagName === 'SELECT') {
        textToSpeak = `Drop down menu: ${element.options[element.selectedIndex]?.text || ''}`;
      } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        textToSpeak = `Input field: ${element.placeholder || element.ariaLabel || ''}`;
      } else if (element.classList.contains('card') || element.classList.contains('stat-card') || element.classList.contains('glass-panel')) {
        const titleEl = element.querySelector('h3, h2, .font-display, a, .stat-value');
        const labelEl = element.querySelector('.stat-label, .section-label');
        if (titleEl && labelEl) {
          textToSpeak = `Card details: ${labelEl.innerText}. Value: ${titleEl.innerText}`;
        } else if (titleEl) {
          textToSpeak = `Card details: ${titleEl.innerText}`;
        } else {
          textToSpeak = `Card contents: ${element.innerText.slice(0, 70)}`;
        }
      } else if (element.classList.contains('severity-badge')) {
        textToSpeak = `Severity level: ${element.innerText}`;
      } else if (element.classList.contains('status-pill')) {
        textToSpeak = `Incident Status: ${element.innerText}`;
      }

      if (textToSpeak.trim()) {
        speakText(textToSpeak);
      }
    };

    const handleMouseLeave = (e) => {
      // If leaving narratable container, reset tracking element
      const element = e.target.closest('button, a, h1, h2, h3, h4, h5, h6, select, textarea, input, [data-narrate], .card, .severity-badge, .status-pill, .stat-card, .glass-panel');
      if (!element) return;

      // Only reset if moving to an element outside the current narratable container
      if (e.relatedTarget && element.contains(e.relatedTarget)) {
        return;
      }

      if (element === window._lastNarratedElement) {
        window._lastNarratedElement = null;
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseLeave);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseLeave);
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [narrate]);

  return (
    <AccessibilityContext.Provider
      value={{
        theme,
        setTheme,
        contrast,
        setContrast,
        textSize,
        setTextSize,
        highlightFocus,
        setHighlightFocus,
        narrate,
        setNarrate,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};
