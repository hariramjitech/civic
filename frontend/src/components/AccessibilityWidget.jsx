import React, { useState } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import { 
  Accessibility, Sun, Moon, Type, Volume2, 
  VolumeX, Eye, Check, X, Keyboard
} from 'lucide-react';

export default function AccessibilityWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    theme, setTheme,
    contrast, setContrast,
    textSize, setTextSize,
    highlightFocus, setHighlightFocus,
    narrate, setNarrate
  } = useAccessibility();

  const toggleOpen = () => setIsOpen(!isOpen);

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
      {/* Floating Toggle Button */}
      <button
        onClick={toggleOpen}
        aria-label="Accessibility Options"
        aria-expanded={isOpen}
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--teal-500)',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 4px 20px rgba(20, 184, 166, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s ease, background-color 0.2s ease',
          outline: 'none',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Accessibility size={26} />
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div
          className="animate-scaleIn"
          style={{
            position: 'absolute',
            bottom: 64,
            right: 0,
            width: 320,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 16,
            boxShadow: 'var(--shadow-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
          role="dialog"
          aria-label="Accessibility Settings"
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Accessibility size={18} style={{ color: 'var(--teal-400)' }} />
              <span style={{ fontWeight: 800, fontSize: 14, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                Accessibility Panel
              </span>
            </div>
            <button
              onClick={toggleOpen}
              aria-label="Close panel"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* 1. Theme Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Theme Options
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                onClick={() => setTheme('light')}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: `1px solid ${theme === 'light' ? 'var(--teal-500)' : 'var(--border-default)'}`,
                  background: theme === 'light' ? 'var(--teal-glow)' : 'var(--bg-surface)',
                  color: theme === 'light' ? 'var(--teal-400)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  outline: 'none',
                }}
              >
                <Sun size={14} /> White Theme
              </button>
              <button
                onClick={() => setTheme('dark')}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: `1px solid ${theme === 'dark' ? 'var(--teal-500)' : 'var(--border-default)'}`,
                  background: theme === 'dark' ? 'var(--teal-glow)' : 'var(--bg-surface)',
                  color: theme === 'dark' ? 'var(--teal-400)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  outline: 'none',
                }}
              >
                <Moon size={14} /> Dark Theme
              </button>
            </div>
          </div>

          {/* 2. Text Scaling */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Text Resizing
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[
                { key: 'normal', label: 'A', title: 'Normal size' },
                { key: 'large', label: 'A+', title: 'Large size' },
                { key: 'xlarge', label: 'A++', title: 'Extra Large' },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => setTextSize(item.key)}
                  title={item.title}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: `1px solid ${textSize === item.key ? 'var(--teal-500)' : 'var(--border-default)'}`,
                    background: textSize === item.key ? 'var(--teal-glow)' : 'var(--bg-surface)',
                    color: textSize === item.key ? 'var(--teal-400)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: item.key === 'normal' ? 11 : item.key === 'large' ? 13 : 15,
                    fontWeight: 700,
                    outline: 'none',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. High Contrast Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', padding: 10, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={16} style={{ color: 'var(--text-secondary)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>High Contrast</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>WCAG AAA compliance</span>
              </div>
            </div>
            <button
              onClick={() => setContrast(contrast === 'high' ? 'normal' : 'high')}
              style={{
                width: 38,
                height: 20,
                borderRadius: 10,
                background: contrast === 'high' ? 'var(--teal-500)' : '#3f3f46',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                outline: 'none',
                transition: 'background-color 0.2s',
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: 3,
                  left: contrast === 'high' ? 21 : 3,
                  transition: 'left 0.2s',
                }}
              />
            </button>
          </div>

          {/* 4. Keyboard Highlight Focus Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', padding: 10, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Keyboard size={16} style={{ color: 'var(--text-secondary)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Focus Outline</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Highlight active elements</span>
              </div>
            </div>
            <button
              onClick={() => setHighlightFocus(!highlightFocus)}
              style={{
                width: 38,
                height: 20,
                borderRadius: 10,
                background: highlightFocus ? 'var(--teal-500)' : '#3f3f46',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                outline: 'none',
                transition: 'background-color 0.2s',
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: 3,
                  left: highlightFocus ? 21 : 3,
                  transition: 'left 0.2s',
                }}
              />
            </button>
          </div>

          {/* 5. Narrate on Hover Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', padding: 10, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {narrate ? (
                <Volume2 size={16} style={{ color: 'var(--teal-400)' }} />
              ) : (
                <VolumeX size={16} style={{ color: 'var(--text-muted)' }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Narrate on Hover</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Voice helper reads text</span>
              </div>
            </div>
            <button
              onClick={() => setNarrate(!narrate)}
              style={{
                width: 38,
                height: 20,
                borderRadius: 10,
                background: narrate ? 'var(--teal-500)' : '#3f3f46',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                outline: 'none',
                transition: 'background-color 0.2s',
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: 3,
                  left: narrate ? 21 : 3,
                  transition: 'left 0.2s',
                }}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
