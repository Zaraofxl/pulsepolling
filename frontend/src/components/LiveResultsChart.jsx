import React from 'react';
import { Trophy, CheckCircle2 } from 'lucide-react';

// ============================================================================
// LIVE RESULTS CHART COMPONENT
// Renders smooth real-time animated percentage bars, vote counts,
// and highlights the leading choice dynamically as votes stream in.
// ============================================================================

export default function LiveResultsChart({ poll, userSelectedOptions = [] }) {
  if (!poll || !poll.options) return null;

  // Step 1: Calculate total votes
  const totalVotes = poll.total_votes || 0;

  // Step 2: Identify highest vote count for crown/winner highlight
  const maxVotes = Math.max(...poll.options.map((opt) => opt.votes || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {poll.options.map((option, index) => {
        const votes = option.votes || 0;
        const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : '0.0';
        const isLeading = maxVotes > 0 && votes === maxVotes;
        const isUserChoice = userSelectedOptions.includes(option.id);

        return (
          <div
            key={option.id || index}
            className="poll-option-bar-container"
            style={{
              borderColor: isUserChoice ? 'var(--accent-primary)' : isLeading ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-subtle)',
              boxShadow: isLeading && totalVotes > 0 ? '0 0 15px rgba(245, 158, 11, 0.15)' : 'none',
            }}
          >
            {/* Real-time Animated Percentage Fill Bar */}
            <div
              className="poll-option-fill"
              style={{
                width: `${percentage}%`,
                backgroundColor: option.color || 'var(--accent-primary)',
                opacity: 0.28,
              }}
            />

            {/* Foreground Content (Label, Count, Percentage) */}
            <div className="poll-option-content">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: option.color || 'var(--accent-primary)',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  {option.text}
                </span>

                {isUserChoice && (
                  <span
                    className="badge"
                    style={{
                      background: 'rgba(99, 102, 241, 0.2)',
                      color: '#818cf8',
                      fontSize: '0.7rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <CheckCircle2 size={12} /> Your Vote
                  </span>
                )}

                {isLeading && totalVotes > 1 && (
                  <span
                    className="badge"
                    style={{
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#f59e0b',
                      fontSize: '0.7rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <Trophy size={12} /> Leader
                  </span>
                )}
              </div>

              {/* Tally & Percentage Display */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {votes} {votes === 1 ? 'vote' : 'votes'}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: isLeading ? '#f59e0b' : 'var(--text-primary)',
                    minWidth: '60px',
                    textAlign: 'right',
                  }}
                >
                  {percentage}%
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
