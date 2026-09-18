import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

// ============================================================================
// LIVE FLOATING EMOJI REACTIONS COMPONENT
// Handles client reaction triggers and renders animated floating emojis
// broadcasted in real-time to all connected audience screens via Redis Pub/Sub.
// ============================================================================

const AVAILABLE_EMOJIS = ['🔥', '❤️', '🎉', '🚀', '👏', '💡'];

export default function ReactionStream({ onSendReaction, incomingReaction }) {
  const [floatingEmojis, setFloatingEmojis] = useState([]);

  // Trigger local animation when an incoming reaction is received from WebSocket
  useEffect(() => {
    if (incomingReaction && incomingReaction.emoji) {
      spawnFloatingEmoji(incomingReaction.emoji);
    }
  }, [incomingReaction]);

  // Spawns an animated floating emoji at randomized horizontal position
  const spawnFloatingEmoji = (emoji) => {
    const id = Date.now() + Math.random();
    // Random position across the bottom width (20% to 80%)
    const leftPercent = 20 + Math.random() * 60;

    const newEmoji = { id, emoji, left: `${leftPercent}%` };
    setFloatingEmojis((prev) => [...prev, newEmoji]);

    // Cleanup after animation completes (2.2s)
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
    }, 2200);
  };

  const handleEmojiClick = (emoji) => {
    spawnFloatingEmoji(emoji);
    if (onSendReaction) {
      onSendReaction(emoji);
    }
  };

  return (
    <div style={{ position: 'relative', marginTop: '1.5rem' }}>
      {/* Floating Animated Emojis Container */}
      <div
        style={{
          position: 'absolute',
          bottom: '50px',
          left: 0,
          right: 0,
          height: '220px',
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 50,
        }}
      >
        {floatingEmojis.map((item) => (
          <span
            key={item.id}
            className="floating-emoji"
            style={{ left: item.left, bottom: '10px' }}
          >
            {item.emoji}
          </span>
        ))}
      </div>

      {/* Reaction Buttons Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.65rem',
          padding: '0.65rem 1rem',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-full)',
          maxWidth: 'fit-content',
          margin: '0 auto',
        }}
      >
        <span
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            marginRight: '0.25rem',
          }}
        >
          <Sparkles size={14} color="#818cf8" /> Live React:
        </span>

        {AVAILABLE_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleEmojiClick(emoji)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.4rem',
              cursor: 'pointer',
              padding: '0.2rem 0.4rem',
              borderRadius: '8px',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.3)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
