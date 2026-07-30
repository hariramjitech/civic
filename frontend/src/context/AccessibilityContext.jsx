import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AccessibilityContext = createContext(null);

export const AccessibilityProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem('civic-theme') || 'light');
  const [contrast, setContrast] = useState(() => localStorage.getItem('civic-contrast') || 'normal');
  const [textSize, setTextSize] = useState(() => localStorage.getItem('civic-text-size') || 'normal');
  const [highlightFocus, setHighlightFocus] = useState(() => localStorage.getItem('civic-highlight-focus') === 'true');
  const [narrate, setNarrate] = useState(() => localStorage.getItem('civic-narrate') === 'true');
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);

  // Advanced accessibility settings
  const [dyslexiaFont, setDyslexiaFont] = useState(() => localStorage.getItem('civic-dyslexia-font') === 'true');
  const [grayscale, setGrayscale] = useState(() => localStorage.getItem('civic-grayscale') === 'true');
  const [textSpacing, setTextSpacing] = useState(() => localStorage.getItem('civic-text-spacing') === 'true');
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem('civic-reduce-motion') === 'true');
  const [bigCursor, setBigCursor] = useState(() => localStorage.getItem('civic-big-cursor') === 'true');
  const [readingGuide, setReadingGuide] = useState(() => localStorage.getItem('civic-reading-guide') === 'true');
  const [soundCues, setSoundCues] = useState(() => localStorage.getItem('civic-sound-cues') === 'true');

  // Refined accessibility parameters
  const [showLauncher, setShowLauncher] = useState(() => localStorage.getItem('civic-show-launcher') !== 'false');
  const [launcherPosition, setLauncherPosition] = useState(() => localStorage.getItem('civic-launcher-position') || 'bottom-left');
  const [readingMask, setReadingMask] = useState(() => localStorage.getItem('civic-reading-mask') === 'true');
  const [spokenText, setSpokenText] = useState('');

  // Speech settings
  const [speechRate, setSpeechRate] = useState(() => parseFloat(localStorage.getItem('civic-speech-rate') || '1'));
  const [speechPitch, setSpeechPitch] = useState(() => parseFloat(localStorage.getItem('civic-speech-pitch') || '1'));
  const [speechVolume, setSpeechVolume] = useState(() => parseFloat(localStorage.getItem('civic-speech-volume') || '0.8'));
  const [speechVoice, setSpeechVoice] = useState(() => localStorage.getItem('civic-speech-voice') || '');
  const [voices, setVoices] = useState([]);

  // Fetch available speech voices
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const updateVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
    };
  }, []);

  // Web Audio synthesizer for key interaction sound cues
  const playSoundCue = useCallback((type) => {
    if (!soundCues) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'focus') {
        osc.frequency.setValueAtTime(400, ctx.currentTime); // G4
        gain.gain.setValueAtTime(0.015, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'click') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch (e) {
      console.warn('Sound cues error:', e);
    }
  }, [soundCues]);

  // Reset helper to restore default settings
  const resetSettings = () => {
    setTheme('light');
    setContrast('normal');
    setTextSize('normal');
    setHighlightFocus(false);
    setNarrate(false);
    setDyslexiaFont(false);
    setGrayscale(false);
    setTextSpacing(false);
    setReduceMotion(false);
    setBigCursor(false);
    setReadingGuide(false);
    setSoundCues(false);
    setSpeechRate(1);
    setSpeechPitch(1);
    setSpeechVolume(0.8);
    setSpeechVoice('');
    // New parameters reset
    setShowLauncher(true);
    setLauncherPosition('bottom-left');
    setReadingMask(false);
    setSpokenText('');
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('civic-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-contrast', contrast);
    localStorage.setItem('civic-contrast', contrast);
  }, [contrast]);

  useEffect(() => {
    document.documentElement.setAttribute('data-text-size', textSize);
    localStorage.setItem('civic-text-size', textSize);
  }, [textSize]);

  useEffect(() => {
    document.documentElement.setAttribute('data-highlight-focus', highlightFocus.toString());
    localStorage.setItem('civic-highlight-focus', highlightFocus.toString());
  }, [highlightFocus]);

  useEffect(() => {
    localStorage.setItem('civic-narrate', narrate.toString());
  }, [narrate]);

  // Sync new options
  useEffect(() => {
    document.documentElement.setAttribute('data-dyslexia-font', dyslexiaFont.toString());
    localStorage.setItem('civic-dyslexia-font', dyslexiaFont.toString());
  }, [dyslexiaFont]);

  useEffect(() => {
    document.documentElement.setAttribute('data-grayscale', grayscale.toString());
    localStorage.setItem('civic-grayscale', grayscale.toString());
  }, [grayscale]);

  useEffect(() => {
    document.documentElement.setAttribute('data-text-spacing', textSpacing ? 'large' : 'normal');
    localStorage.setItem('civic-text-spacing', textSpacing.toString());
  }, [textSpacing]);

  useEffect(() => {
    document.documentElement.setAttribute('data-reduce-motion', reduceMotion.toString());
    localStorage.setItem('civic-reduce-motion', reduceMotion.toString());
  }, [reduceMotion]);

  useEffect(() => {
    document.documentElement.setAttribute('data-big-cursor', bigCursor.toString());
    localStorage.setItem('civic-big-cursor', bigCursor.toString());
  }, [bigCursor]);

  useEffect(() => {
    document.documentElement.setAttribute('data-reading-guide', readingGuide.toString());
    localStorage.setItem('civic-reading-guide', readingGuide.toString());
  }, [readingGuide]);

  useEffect(() => {
    localStorage.setItem('civic-sound-cues', soundCues.toString());
  }, [soundCues]);

  // Sync refined options
  useEffect(() => {
    localStorage.setItem('civic-show-launcher', showLauncher.toString());
  }, [showLauncher]);

  useEffect(() => {
    localStorage.setItem('civic-launcher-position', launcherPosition);
  }, [launcherPosition]);

  useEffect(() => {
    localStorage.setItem('civic-reading-mask', readingMask.toString());
  }, [readingMask]);

  useEffect(() => {
    localStorage.setItem('civic-speech-rate', speechRate.toString());
  }, [speechRate]);

  useEffect(() => {
    localStorage.setItem('civic-speech-pitch', speechPitch.toString());
  }, [speechPitch]);

  useEffect(() => {
    localStorage.setItem('civic-speech-volume', speechVolume.toString());
  }, [speechVolume]);

  useEffect(() => {
    localStorage.setItem('civic-speech-voice', speechVoice);
  }, [speechVoice]);

  // Click Sound Cues Event Handler
  useEffect(() => {
    if (!soundCues) return;
    const handleClick = (e) => {
      const interactive = e.target.closest('button, a, select, textarea, input, [role="button"]');
      if (interactive) {
        playSoundCue('click');
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [soundCues, playSoundCue]);

  // Global Keyboard Shortcuts (Alt + A, Alt + S, Alt + R)
  useEffect(() => {
    const handleShortcuts = (e) => {
      // Alt + A to toggle accessibility panel
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setIsWidgetOpen(prev => !prev);
      }
      // Alt + S to cancel screen reading narration speech output
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        setSpokenText('');
      }
      // Alt + R to restore defaults
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        resetSettings();
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, []);

  // Keyboard Escape key speech canceler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        setSpokenText('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Global speaker logic (supports mouse hover AND keyboard focus narration + subtitle feedback)
  useEffect(() => {
    if (!narrate) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setSpokenText('');
      return;
    }

    const speakText = (text) => {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speechRate;
      utterance.pitch = speechPitch;
      utterance.volume = speechVolume;

      if (speechVoice) {
        const allVoices = window.speechSynthesis.getVoices();
        const selected = allVoices.find(v => v.name === speechVoice);
        if (selected) utterance.voice = selected;
      }

      // Sync captions to UI
      utterance.onstart = () => setSpokenText(text);
      utterance.onend = () => setSpokenText('');
      utterance.onerror = () => setSpokenText('');

      window.speechSynthesis.speak(utterance);
    };

    const getSpeechText = (element) => {
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
      return textToSpeak;
    };

    const handleMouseOver = (e) => {
      const element = e.target.closest('button, a, h1, h2, h3, h4, h5, h6, select, textarea, input, [data-narrate], .card, .severity-badge, .status-pill, .stat-card, .glass-panel');
      if (!element) return;

      if (element === window._lastNarratedElement) return;
      window._lastNarratedElement = element;

      const text = getSpeechText(element);
      if (text.trim()) speakText(text);
    };

    const handleMouseLeave = (e) => {
      const element = e.target.closest('button, a, h1, h2, h3, h4, h5, h6, select, textarea, input, [data-narrate], .card, .severity-badge, .status-pill, .stat-card, .glass-panel');
      if (!element) return;

      if (e.relatedTarget && element.contains(e.relatedTarget)) return;

      if (element === window._lastNarratedElement) {
        window._lastNarratedElement = null;
      }
    };

    const handleFocusIn = (e) => {
      const element = e.target.closest('button, a, h1, h2, h3, h4, h5, h6, select, textarea, input, [data-narrate], .card, .severity-badge, .status-pill, .stat-card, .glass-panel');
      if (!element) return;

      if (element === window._lastNarratedElement) return;
      window._lastNarratedElement = element;

      const text = getSpeechText(element);
      if (text.trim()) speakText(text);

      playSoundCue('focus');
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseLeave);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseLeave);
      document.removeEventListener('focusin', handleFocusIn);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setSpokenText('');
    };
  }, [narrate, speechRate, speechPitch, speechVolume, speechVoice, playSoundCue]);

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
        isWidgetOpen,
        setIsWidgetOpen,

        // Advanced features
        dyslexiaFont,
        setDyslexiaFont,
        grayscale,
        setGrayscale,
        textSpacing,
        setTextSpacing,
        reduceMotion,
        setReduceMotion,
        bigCursor,
        setBigCursor,
        readingGuide,
        setReadingGuide,
        soundCues,
        setSoundCues,
        playSoundCue,

        // Refined layout features
        showLauncher,
        setShowLauncher,
        launcherPosition,
        setLauncherPosition,
        readingMask,
        setReadingMask,
        spokenText,
        setSpokenText,

        // Voice configurations
        speechRate,
        setSpeechRate,
        speechPitch,
        setSpeechPitch,
        speechVolume,
        setSpeechVolume,
        speechVoice,
        setSpeechVoice,
        voices,
        resetSettings,
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
