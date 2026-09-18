import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { pollAPI, voteAPI } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveResultsChart from '../components/LiveResultsChart';
import ReactionStream from '../components/ReactionStream';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Maximize2, 
  Minimize2, 
  Copy, 
  Check, 
  Users, 
  Radio, 
  Loader2, 
  ArrowLeft,
  Share2
} from 'lucide-react';

// ============================================================================
// PRESENTER / HOST LIVE PRESENTATION PAGE
// Designed for projectors and screen-sharing with big live percentage bars,
// persistent QR code join box, real-time spectator tally, and host controls.
// ============================================================================

export default function PollAdminLivePage() {
  const { id } = useParams();
  const [poll, setPoll] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [incomingReaction, setIncomingReaction] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch initial poll details
  const fetchPoll = async () => {
    setIsLoading(true);
    try {
      const res = await pollAPI.getPoll(id);
      setPoll(res.data);
    } catch (err) {
      console.error('Failed to load live presenter poll', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPoll();
  }, [id]);

  // Real-time WebSocket vote update callback
  const handleLiveVoteUpdate = useCallback((update) => {
    setPoll((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        total_votes: update.total_votes,
        options: prev.options.map((opt) => ({
          ...opt,
          votes: update.option_counts[opt.id] !== undefined ? update.option_counts[opt.id] : opt.votes,
        })),
      };
    });
  }, []);

  // Real-time WebSocket reaction callback
  const handleLiveReaction = useCallback((reaction) => {
    setIncomingReaction(reaction);
  }, []);

  // Connect to Go Backend WebSocket
  const { viewerCount, sendSocketReaction } = useWebSocket(
    poll?.id,
    handleLiveVoteUpdate,
    handleLiveReaction
  );

  // Toggle active state
  const handleToggleActive = async () => {
    if (!poll) return;
    setIsUpdating(true);
    try {
      const res = await pollAPI.updatePoll(poll.id, { is_active: !poll.is_active });
      setPoll(res.data);
    } catch (err) {
      console.error('Failed to toggle poll status', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Reset votes
  const handleResetVotes = async () => {
    if (!poll || !window.confirm('Reset all live votes to zero?')) return;
    try {
      await pollAPI.resetPoll(poll.id);
      setPoll((prev) => ({
        ...prev,
        total_votes: 0,
        options: prev.options.map((o) => ({ ...o, votes: 0 })),
      }));
    } catch (err) {
      console.error('Failed to reset votes', err);
    }
  };

  // Toggle browser fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const votingUrl = poll ? `${window.location.origin}/poll/${poll.code || poll.id}` : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(votingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {}
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Loader2 size={36} className="animate-spin" color="var(--accent-primary)" />
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="glass-card" style={{ maxWidth: '500px', margin: '4rem auto', textAlign: 'center', padding: '2rem' }}>
        <h2>Poll Not Found</h2>
        <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* Top Controls Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/dashboard" className="btn btn-secondary btn-icon" title="Back to Dashboard">
            <ArrowLeft size={16} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {poll.is_active ? (
              <span className="badge badge-live">Live Presenter</span>
            ) : (
              <span className="badge badge-paused">Voting Paused</span>
            )}
            <span className="badge badge-code">{poll.code}</span>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Active Viewers Count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-input)', padding: '0.45rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '0.875rem' }}>
            <Users size={16} color="#818cf8" />
            <span><strong>{viewerCount}</strong> Viewers</span>
          </div>

          {/* Toggle Pause / Resume */}
          <button
            onClick={handleToggleActive}
            disabled={isUpdating}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem' }}
          >
            {poll.is_active ? (
              <>
                <Pause size={15} />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play size={15} color="#10b981" />
                <span>Resume</span>
              </>
            )}
          </button>

          {/* Reset Votes */}
          <button
            onClick={handleResetVotes}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem' }}
          >
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>

          {/* Export CSV */}
          <a
            href={pollAPI.getExportCSVUrl(poll.id)}
            download
            className="btn btn-secondary"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem' }}
          >
            <Download size={15} />
            <span>CSV</span>
          </a>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="btn btn-secondary btn-icon"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Presentation Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Main Presentation Stage */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Side: Live Results Chart & Title */}
        <div className="glass-card" style={{ padding: '2.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25 }}>
              {poll.title}
            </h1>
            <span className="badge badge-code" style={{ fontSize: '1rem', padding: '0.4rem 0.85rem', flexShrink: 0 }}>
              {poll.total_votes || 0} Votes
            </span>
          </div>

          {/* Real-time Dynamic Chart */}
          <LiveResultsChart poll={poll} />

          {/* Real-time Floating Live Reactions */}
          <ReactionStream
            onSendReaction={(emoji) => {
              sendSocketReaction(emoji, 'Host');
              voteAPI.sendReaction(poll.id, emoji, 'Host').catch(() => {});
            }}
            incomingReaction={incomingReaction}
          />
        </div>

        {/* Right Side: High-Visibility QR Code & Join Instructions */}
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.25rem' }}>Scan to Vote</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Point camera to join live poll</p>
          </div>

          <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: 'var(--radius-md)', display: 'inline-flex', margin: '0 auto', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)' }}>
            <QRCodeSVG value={votingUrl} size={180} level="M" />
          </div>

          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Join Code</span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '0.05em' }}>
              {poll.code}
            </div>
          </div>

          <button
            onClick={handleCopyLink}
            className="btn btn-secondary"
            style={{ width: '100%', fontSize: '0.85rem', padding: '0.6rem' }}
          >
            {copied ? (
              <>
                <Check size={14} color="#10b981" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy Vote Link</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
