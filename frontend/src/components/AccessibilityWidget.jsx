import React, { useState, useEffect, useRef } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  Accessibility, Sun, Moon, Type, Volume2,
  VolumeX, Eye, Check, X, Keyboard, RotateCcw,
  MousePointer, Sliders, Ear, Play, Square, Activity, EyeOff
} from 'lucide-react';

export default function AccessibilityWidget() {
  const {
    theme, setTheme,
    contrast, setContrast,
    textSize, setTextSize,
    highlightFocus, setHighlightFocus,
    narrate, setNarrate,
    isWidgetOpen, setIsWidgetOpen,

    // Advanced settings
    dyslexiaFont, setDyslexiaFont,
    grayscale, setGrayscale,
    textSpacing, setTextSpacing,
    reduceMotion, setReduceMotion,
    bigCursor, setBigCursor,
    readingGuide, setReadingGuide,
    soundCues, setSoundCues,
    readingMask, setReadingMask,
    showLauncher, setShowLauncher,
    launcherPosition, setLauncherPosition,

    // Voice configs
    speechRate, setSpeechRate,
    speechPitch, setSpeechPitch,
    speechVolume, setSpeechVolume,
    speechVoice, setSpeechVoice,
    voices, resetSettings,
  } = useAccessibility();

  const [activeTab, setActiveTab] = useState('visual'); // 'visual', 'text', 'aids', 'speech'
  const drawerRef = useRef(null);

  // Keyboard Focus Trap & Escape key close
  useEffect(() => {
    if (!isWidgetOpen) return;

    // Focus the close button or first interactive element when drawer opens
    const timer = setTimeout(() => {
      if (drawerRef.current) {
        const firstFocusable = drawerRef.current.querySelector('button, select, input');
        if (firstFocusable) firstFocusable.focus();
      }
    }, 150);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsWidgetOpen(false);
      }

      if (e.key === 'Tab') {
        if (!drawerRef.current) return;
        const focusableElements = drawerRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      // Return focus to the trigger button
      const trigger = document.getElementById('accessibility-launcher-btn');
      if (trigger) trigger.focus();
    };
  }, [isWidgetOpen, setIsWidgetOpen]);

  if (!isWidgetOpen) return null;

  const tabs = [
    { id: 'visual', label: 'Visual', icon: Eye },
    { id: 'text', label: 'Text/Font', icon: Type },
    { id: 'aids', label: 'Navigation', icon: Keyboard },
    { id: 'speech', label: 'Voice Reader', icon: Volume2 },
  ];

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex justify-end"
      onClick={() => setIsWidgetOpen(false)}
      role="presentation"
    >
      {/* Drawer Container */}
      <div
        ref={drawerRef}
        className="w-full sm:w-[400px] h-full bg-[var(--bg-elevated)] border-l border-[var(--border-default)] shadow-2xl flex flex-col animate-slideInRight"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Accessibility settings panel"
        aria-modal="true"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--teal-glow)] flex items-center justify-center text-[var(--teal-500)]">
              <Accessibility size={20} />
            </div>
            <div className="flex flex-col">
              <h2 className="text-[15px] font-display font-black text-[var(--text-primary)] leading-tight">
                Accessibility Suite
              </h2>
              <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Personalize your experience
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetSettings}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-overlay)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold transition-all cursor-pointer"
              title="Reset all accessibility settings to default"
              aria-label="Reset accessibility options"
            >
              <RotateCcw size={12} />
              Reset
            </button>
            <button
              onClick={() => setIsWidgetOpen(false)}
              className="p-1.5 rounded-lg border-none bg-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] cursor-pointer transition-colors"
              aria-label="Close accessibility panel"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Headers */}
        <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 px-1 flex flex-col items-center gap-1 border-b-2 font-bold text-[10px] sm:text-[11px] tracking-tight transition-all cursor-pointer border-none bg-none ${
                  active
                    ? 'border-[var(--teal-500)] text-[var(--teal-400)] bg-[var(--bg-elevated)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/40'
                }`}
                aria-selected={active}
                role="tab"
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable Settings Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* VISUAL CONTROLS */}
          {activeTab === 'visual' && (
            <div className="space-y-4">
              {/* Theme Settings */}
              <div className="flex flex-col gap-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 rounded-2xl">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <Sun size={12} /> Interface Contrast Theme
                </span>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    onClick={() => setTheme('light')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      theme === 'light'
                        ? 'border-[var(--teal-500)] bg-[var(--teal-glow)] text-[var(--teal-500)]'
                        : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]'
                    }`}
                  >
                    <Sun size={13} /> Light Theme
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      theme === 'dark'
                        ? 'border-[var(--teal-500)] bg-[var(--teal-glow)] text-[var(--teal-500)]'
                        : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]'
                    }`}
                  >
                    <Moon size={13} /> Dark Theme
                  </button>
                </div>
              </div>

              {/* High Contrast Mode */}
              <div className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 mt-0.5">
                    <Eye size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--text-primary)]">High Contrast Colors</span>
                    <span className="text-[9px] font-semibold text-[var(--text-muted)] mt-0.5">WCAG AAA compliant colors</span>
                  </div>
                </div>
                <button
                  onClick={() => setContrast(contrast === 'high' ? 'normal' : 'high')}
                  className={`w-10 h-6 rounded-full p-1 transition-colors border-none cursor-pointer flex items-center relative ${
                    contrast === 'high' ? 'bg-[var(--teal-500)]' : 'bg-[var(--border-strong)]'
                  }`}
                  aria-label="Toggle High Contrast Mode"
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${contrast === 'high' ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Grayscale Mode */}
              <div className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gray-500/10 flex items-center justify-center text-gray-500 mt-0.5">
                    <Sliders size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--text-primary)]">Monochrome/Grayscale</span>
                    <span className="text-[9px] font-semibold text-[var(--text-muted)] mt-0.5">Remove color for visibility needs</span>
                  </div>
                </div>
                <button
                  onClick={() => setGrayscale(!grayscale)}
                  className={`w-10 h-6 rounded-full p-1 transition-colors border-none cursor-pointer flex items-center relative ${
                    grayscale ? 'bg-[var(--teal-500)]' : 'bg-[var(--border-strong)]'
                  }`}
                  aria-label="Toggle Monochrome Grayscale Mode"
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${grayscale ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Big Cursor Helper */}
              <div className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 mt-0.5">
                    <MousePointer size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--text-primary)]">Scaled Custom Cursor</span>
                    <span className="text-[9px] font-semibold text-[var(--text-muted)] mt-0.5">Enlarge pointer with high contrast outline</span>
                  </div>
                </div>
                <button
                  onClick={() => setBigCursor(!bigCursor)}
                  className={`w-10 h-6 rounded-full p-1 transition-colors border-none cursor-pointer flex items-center relative ${
                    bigCursor ? 'bg-[var(--teal-500)]' : 'bg-[var(--border-strong)]'
                  }`}
                  aria-label="Toggle Scaled Custom Cursor"
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${bigCursor ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          )}

          {/* TYPOGRAPHY CONTROLS */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              {/* Text Sizing Scale */}
              <div className="flex flex-col gap-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 rounded-2xl">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <Type size={12} /> Relative Text Resizing
                </span>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { key: 'normal', label: 'Default (A)', title: '100% text scale' },
                    { key: 'large', label: 'Medium (A+)', title: '112.5% text scale' },
                    { key: 'xlarge', label: 'Large (A++)', title: '125% text scale' },
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => setTextSize(item.key)}
                      title={item.title}
                      className={`py-2 px-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        textSize === item.key
                          ? 'border-[var(--teal-500)] bg-[var(--teal-glow)] text-[var(--teal-500)]'
                          : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Spacing Adjustment */}
              <div className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 mt-0.5">
                    <Sliders size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--text-primary)]">Enhanced Text Spacing</span>
                    <span className="text-[9px] font-semibold text-[var(--text-muted)] mt-0.5">Add word & letter breathing space</span>
                  </div>
                </div>
                <button
                  onClick={() => setTextSpacing(!textSpacing)}
                  className={`w-10 h-6 rounded-full p-1 transition-colors border-none cursor-pointer flex items-center relative ${
                    textSpacing ? 'bg-[var(--teal-500)]' : 'bg-[var(--border-strong)]'
                  }`}
                  aria-label="Toggle Enhanced Text Spacing"
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${textSpacing ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Dyslexia Friendly Font */}
              <div className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500 mt-0.5">
                    <Type size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--text-primary)]">Dyslexia-Friendly Type</span>
                    <span className="text-[9px] font-semibold text-[var(--text-muted)] mt-0.5">High-readability letter shape profiles</span>
                  </div>
                </div>
                <button
                  onClick={() => setDyslexiaFont(!dyslexiaFont)}
                  className={`w-10 h-6 rounded-full p-1 transition-colors border-none cursor-pointer flex items-center relative ${
                    dyslexiaFont ? 'bg-[var(--teal-500)]' : 'bg-[var(--border-strong)]'
                  }`}
                  aria-label="Toggle Dyslexia-Friendly Font"
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${dyslexiaFont ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          )}

          {/* AIDS & CUES CONTROLS */}
          {activeTab === 'aids' && (
            <div className="space-y-4">
              {/* Keyboard Focus Outlining */}
              <div className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 mt-0.5">
                    <Keyboard size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--text-primary)]">Focus Highlighter</span>
                    <span className="text-[9px] font-semibold text-[var(--text-muted)] mt-0.5">Vibrant outlines on interactive focus</span>
                  </div>
                </div>
                <button
                  onClick={() => setHighlightFocus(!highlightFocus)}
                  className={`w-10 h-6 rounded-full p-1 transition-colors border-none cursor-pointer flex items-center relative ${
                    highlightFocus ? 'bg-[var(--teal-500)]' : 'bg-[var(--border-strong)]'
                  }`}
                  aria-label="Toggle Focus Highlighter"
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${highlightFocus ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Reading Guide Ruler */}
              <div className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mt-0.5">
                    <Sliders size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--text-primary)]">Reading Guide Ruler</span>
                    <span className="text-[9px] font-semibold text-[var(--text-muted)] mt-0.5">Horizontal tracking window following cursor</span>
                  </div>
                </div>
                <button
                  onClick={() => setReadingGuide(!readingGuide)}
                  className={`w-10 h-6 rounded-full p-1 transition-colors border-none cursor-pointer flex items-center relative ${
                    readingGuide ? 'bg-[var(--teal-500)]' : 'bg-[var(--border-strong)]'
                  }`}
                  aria-label="Toggle Reading Guide Ruler"
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${readingGuide ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Reduce Motion */}
              <div className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 mt-0.5">
                    <Activity size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--text-primary)]">Reduce Motion</span>
                    <span className="text-[9px] font-semibold text-[var(--text-muted)] mt-0.5">Disable transitions & screen flashings</span>
                  </div>
                </div>
                <button
                  onClick={() => setReduceMotion(!reduceMotion)}
                  className={`w-10 h-6 rounded-full p-1 transition-colors border-none cursor-pointer flex items-center relative ${
                    reduceMotion ? 'bg-[var(--teal-500)]' : 'bg-[var(--border-strong)]'
                  }`}
                  aria-label="Toggle Reduce Motion"
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${reduceMotion ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Synthesized Audio Cues */}
              <div className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 mt-0.5">
                    <Ear size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--text-primary)]">Interactive Sound Cues</span>
                    <span className="text-[9px] font-semibold text-[var(--text-muted)] mt-0.5">Aural feedback on key clicks and focuses</span>
                  </div>
                </div>
                <button
                  onClick={() => setSoundCues(!soundCues)}
                  className={`w-10 h-6 rounded-full p-1 transition-colors border-none cursor-pointer flex items-center relative ${
                    soundCues ? 'bg-[var(--teal-500)]' : 'bg-[var(--border-strong)]'
                  }`}
                  aria-label="Toggle Interactive Sound Cues"
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${soundCues ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Reading Focus Mask */}
              <div className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-500 mt-0.5">
                    <EyeOff size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--text-primary)]">Cognitive Reading Mask</span>
                    <span className="text-[9px] font-semibold text-[var(--text-muted)] mt-0.5">Dim page borders, leaving horizontal focus gap</span>
                  </div>
                </div>
                <button
                  onClick={() => setReadingMask(!readingMask)}
                  className={`w-10 h-6 rounded-full p-1 transition-colors border-none cursor-pointer flex items-center relative ${
                    readingMask ? 'bg-[var(--teal-500)]' : 'bg-[var(--border-strong)]'
                  }`}
                  aria-label="Toggle Reading Focus Mask"
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${readingMask ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Launcher Badge Visibility Toggle */}
              <div className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-zinc-500/10 flex items-center justify-center text-zinc-500 mt-0.5">
                    <Accessibility size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--text-primary)]">Show Floating Launcher</span>
                    <span className="text-[9px] font-semibold text-[var(--text-muted)] mt-0.5">Display floating toggle badge on page corners</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowLauncher(!showLauncher)}
                  className={`w-10 h-6 rounded-full p-1 transition-colors border-none cursor-pointer flex items-center relative ${
                    showLauncher ? 'bg-[var(--teal-500)]' : 'bg-[var(--border-strong)]'
                  }`}
                  aria-label="Toggle Floating Launcher Visibility"
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${showLauncher ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Launcher Position Selector */}
              {showLauncher && (
                <div className="flex flex-col gap-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 rounded-2xl">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Sliders size={12} /> Floating Launcher Corner Position
                  </span>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      onClick={() => setLauncherPosition('bottom-left')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        launcherPosition === 'bottom-left'
                          ? 'border-[var(--teal-500)] bg-[var(--teal-glow)] text-[var(--teal-500)]'
                          : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]'
                      }`}
                    >
                      Bottom Left (Default)
                    </button>
                    <button
                      onClick={() => setLauncherPosition('bottom-right')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        launcherPosition === 'bottom-right'
                          ? 'border-[var(--teal-500)] bg-[var(--teal-glow)] text-[var(--teal-500)]'
                          : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]'
                      }`}
                    >
                      Bottom Right
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VOICE READER CONTROLS */}
          {activeTab === 'speech' && (
            <div className="space-y-4">
              {/* Toggle speech assistant */}
              <div className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mt-0.5 ${
                    narrate ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-[var(--text-muted)]'
                  }`}>
                    {narrate ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--text-primary)]">Text-To-Speech Reader</span>
                    <span className="text-[9px] font-semibold text-[var(--text-muted)] mt-0.5">Reads targeted items on hover and focus</span>
                  </div>
                </div>
                <button
                  onClick={() => setNarrate(!narrate)}
                  className={`w-10 h-6 rounded-full p-1 transition-colors border-none cursor-pointer flex items-center relative ${
                    narrate ? 'bg-[var(--teal-500)]' : 'bg-[var(--border-strong)]'
                  }`}
                  aria-label="Toggle Speech Assistant"
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${narrate ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {narrate && (
                <div className="space-y-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 rounded-2xl mt-2 animate-scaleIn">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Voice Settings
                  </span>

                  {/* Speech Rate Slider */}
                  <div className="flex flex-col gap-1.5 mt-2">
                    <div className="flex justify-between items-center">
                      <label htmlFor="rate-slider" className="text-xs font-bold text-[var(--text-primary)]">Reading Speed</label>
                      <span className="text-[10px] font-extrabold text-[var(--teal-400)] bg-[var(--teal-glow)] px-1.5 py-0.5 rounded">{speechRate}x</span>
                    </div>
                    <input
                      id="rate-slider"
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={speechRate}
                      onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                      className="w-full accent-[var(--teal-500)] h-1.5 bg-[var(--bg-elevated)] rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Speech Volume Slider */}
                  <div className="flex flex-col gap-1.5 mt-2">
                    <div className="flex justify-between items-center">
                      <label htmlFor="volume-slider" className="text-xs font-bold text-[var(--text-primary)]">Audio Volume</label>
                      <span className="text-[10px] font-extrabold text-[var(--teal-400)] bg-[var(--teal-glow)] px-1.5 py-0.5 rounded">{Math.round(speechVolume * 100)}%</span>
                    </div>
                    <input
                      id="volume-slider"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={speechVolume}
                      onChange={(e) => setSpeechVolume(parseFloat(e.target.value))}
                      className="w-full accent-[var(--teal-500)] h-1.5 bg-[var(--bg-elevated)] rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Speech Pitch Slider */}
                  <div className="flex flex-col gap-1.5 mt-2">
                    <div className="flex justify-between items-center">
                      <label htmlFor="pitch-slider" className="text-xs font-bold text-[var(--text-primary)]">Voice Pitch</label>
                      <span className="text-[10px] font-extrabold text-[var(--teal-400)] bg-[var(--teal-glow)] px-1.5 py-0.5 rounded">{speechPitch}</span>
                    </div>
                    <input
                      id="pitch-slider"
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.1"
                      value={speechPitch}
                      onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                      className="w-full accent-[var(--teal-500)] h-1.5 bg-[var(--bg-elevated)] rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Speech Voice Dropdown */}
                  {voices.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-2">
                      <label htmlFor="voice-select" className="text-xs font-bold text-[var(--text-primary)]">Preferred Voice Speaker</label>
                      <select
                        id="voice-select"
                        value={speechVoice}
                        onChange={(e) => setSpeechVoice(e.target.value)}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl py-2 px-3 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--teal-500)] cursor-pointer"
                      >
                        <option value="">Default System Voice</option>
                        {voices.map((voice, idx) => (
                          <option key={idx} value={voice.name}>
                            {voice.name} ({voice.lang})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 mt-3">
                    <span className="text-[9px] text-[var(--text-muted)] font-semibold flex items-center gap-1">
                      <Sliders size={10} /> Esc key immediately cancels voice
                    </span>
                    <button
                      onClick={() => {
                        if (window.speechSynthesis) {
                          window.speechSynthesis.cancel();
                          const utterance = new SpeechSynthesisUtterance("Voice assistant system configuration verified");
                          utterance.rate = speechRate;
                          utterance.pitch = speechPitch;
                          utterance.volume = speechVolume;
                          if (speechVoice) {
                            const match = window.speechSynthesis.getVoices().find(v => v.name === speechVoice);
                            if (match) utterance.voice = match;
                          }
                          window.speechSynthesis.speak(utterance);
                        }
                      }}
                      className="flex items-center gap-1 py-1 px-2 bg-[var(--teal-glow)] hover:bg-[var(--teal-500)]/20 border border-[var(--teal-500)]/30 rounded-lg text-[var(--teal-400)] text-[10px] font-bold cursor-pointer transition-all"
                      aria-label="Test voice reader settings"
                    >
                      <Play size={10} /> Test Voice
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer info */}
        <div className="p-4 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] text-center flex flex-col gap-1.5">
          <div className="flex flex-wrap justify-center gap-2 text-[9px] text-[var(--text-muted)] font-bold">
            <span>Alt + A: Toggle Panel</span>
            <span>•</span>
            <span>Alt + S: Stop Voice</span>
            <span>•</span>
            <span>Alt + R: Reset All</span>
          </div>
          <p className="text-[8px] font-semibold text-[var(--text-muted)] mt-1">
            CivicTN Accessibility Suite v2.1 • Press Esc to Close
          </p>
        </div>
      </div>
    </div>
  );
}
