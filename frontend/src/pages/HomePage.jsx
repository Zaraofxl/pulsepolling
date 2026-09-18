import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowRight, 
  Sparkles,
  Code2,
  Mail,
  GraduationCap
} from 'lucide-react';
import LiveResultsChart from '../components/LiveResultsChart';
import ReactionStream from '../components/ReactionStream';

// ============================================================================
// HOME / LANDING PAGE
// High-conversion landing page featuring an interactive live poll demo preview,
// quick-join code input, and technical feature highlights.
// ============================================================================

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');

  // Interactive demo poll state for interactive landing preview
  const [demoPoll, setDemoPoll] = useState({
    id: 'demo_landing_poll',
    title: '⚡ Which tech stack layer excites you most for live apps?',
    total_votes: 142,
    options: [
      { id: 'opt_1', text: 'Redis In-Memory & Pub/Sub Aggregation', votes: 68, color: '#ef4444' },
      { id: 'opt_2', text: 'Go (Gin) Concurrency & WebSocket Engine', votes: 44, color: '#06b6d4' },
      { id: 'opt_3', text: 'React Reactive UI & Micro-Animations', votes: 20, color: '#6366f1' },
      { id: 'opt_4', text: 'MongoDB Document Persistence & Auditing', votes: 10, color: '#10b981' },
    ],
  });

  const [hasVotedDemo, setHasVotedDemo] = useState(false);
  const [demoChoice, setDemoChoice] = useState(null);

  // Quick join by code handler
  const handleJoinByCode = (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    navigate(`/poll/${joinCode.trim().toUpperCase()}`);
  };

  // Demo vote simulation
  const handleDemoVote = (optID) => {
    if (hasVotedDemo) return;
    setHasVotedDemo(true);
    setDemoChoice(optID);
    setDemoPoll((prev) => ({
      ...prev,
      total_votes: prev.total_votes + 1,
      options: prev.options.map((opt) =>
        opt.id === optID ? { ...opt, votes: opt.votes + 1 } : opt
      ),
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem', paddingBottom: '3rem' }}>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', maxWidth: '850px', margin: '1rem auto 0', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', margin: '0 auto' }}>
          <span className="badge badge-live">
            Sub-millisecond Realtime
          </span>
          <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            Go + Redis + React + MongoDB
          </span>
        </div>

        <h1 style={{
          fontSize: 'clamp(2.5rem, 6vw, 4rem)',
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: '-0.03em',
        }}>
          Live Polling that updates <br />
          <span style={{
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            before your eyes.
          </span>
        </h1>

        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '680px', margin: '0 auto' }}>
          Create instant interactive polls, share scannable QR codes, and watch audience votes stream in live with zero latency and no page refreshes.
        </p>

        {/* Quick Join & CTA Bar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          marginTop: '0.5rem',
        }}>
          {/* Quick-Join Input Form */}
          <form onSubmit={handleJoinByCode} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Enter Poll Code (e.g. PL-8492)"
              className="input-field"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              style={{
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                width: '260px',
                padding: '0.8rem 1rem',
              }}
            />
            <button type="submit" className="btn btn-secondary" style={{ padding: '0.8rem 1.25rem' }}>
              <span>Join</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Create Poll CTA */}
          <Link
            to={isAuthenticated ? '/create' : '/register'}
            className="btn btn-primary"
            style={{ padding: '0.8rem 1.75rem', fontSize: '1rem' }}
          >
            <Sparkles size={18} />
            <span>{isAuthenticated ? 'Create New Poll' : 'Get Started Free'}</span>
          </Link>
        </div>
      </section>

      {/* Interactive Live Demo Poll Card */}
      <section className="glass-card" style={{ maxWidth: '780px', margin: '0 auto', width: '100%', padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span className="badge badge-live">Interactive Demo</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Click an option to test live tally</span>
          </div>
          <span className="badge badge-code">{demoPoll.total_votes} Total Votes</span>
        </div>

        <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
          {demoPoll.title}
        </h3>

        {/* If user hasn't voted in demo, show clickable voting buttons */}
        {!hasVotedDemo ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {demoPoll.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleDemoVote(opt.id)}
                className="btn btn-secondary"
                style={{
                  justifyContent: 'flex-start',
                  padding: '1rem 1.25rem',
                  fontSize: '1rem',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: opt.color,
                    marginRight: '0.5rem',
                    flexShrink: 0,
                  }}
                />
                <span>{opt.text}</span>
              </button>
            ))}
          </div>
        ) : (
          <LiveResultsChart poll={demoPoll} userSelectedOptions={demoChoice ? [demoChoice] : []} />
        )}

        {/* Live floating reactions stream */}
        <ReactionStream />
      </section>

      {/* Developer Profile Section */}
      <section style={{ maxWidth: '680px', margin: '0 auto', width: '100%' }}>
        <div className="glass-card" style={{ padding: '2rem 2.5rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 1rem',
            borderRadius: '9999px',
            background: 'rgba(99, 102, 241, 0.12)',
            color: 'var(--primary)',
            fontSize: '0.85rem',
            fontWeight: 600,
            marginBottom: '1rem',
          }}>
            <Code2 size={16} />
            <span>Developed by</span>
          </div>

          <h3 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.25rem', letterSpacing: '-0.02em' }}>
            Deepan A
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', alignItems: 'center' }}>
            <a 
              href="mailto:deepanrao1205@gmail.com"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.65rem',
                color: 'var(--text-secondary)',
                fontSize: '0.95rem',
                textDecoration: 'none',
              }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <Mail size={16} />
              </div>
              <span>deepanrao1205@gmail.com</span>
            </a>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.65rem',
              color: 'var(--text-secondary)',
              fontSize: '0.95rem',
            }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                <GraduationCap size={18} />
              </div>
              <span>Annapoorana Engineering College (Autonomous), Salem</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}


