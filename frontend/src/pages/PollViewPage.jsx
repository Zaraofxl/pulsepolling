import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { pollAPI, voteAPI } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { getVoterFingerprint } from '../utils/fingerprint';
import VotingInterface from '../components/VotingInterface';
import LiveResultsChart from '../components/LiveResultsChart';
import ReactionStream from '../components/ReactionStream';
import QRCodeModal from '../components/QRCodeModal';
import { 
  Users, 
  Radio, 
  Share2, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  Wifi, 
  WifiOff 
} from 'lucide-react';

// ============================================================================
// PUBLIC AUDIENCE VOTING & LIVE RESULTS PAGE
// Provides the mobile-first participant interface where audience members vote,
// watch live bar chart changes in real-time over WebSockets, and send reactions.
// ============================================================================

export default function PollViewPage() {
  const { idOrCode } = useParams();
  const [poll, setPoll] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Voting State
  const [hasVoted, setHasVoted] = useState(false);
  const [userSelectedOptions, setUserSelectedOptions] = useState([]);
  const [incomingReaction, setIncomingReaction] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Fetch initial poll document from Go backend
  useEffect(() => {
    const loadPoll = async () => {
      setIsLoading(true);
      try {
        const res = await pollAPI.getPoll(idOrCode);
        const pollData = res.data;
        setPoll(pollData);

        // Check local storage for previous vote on this poll
        const localVote = localStorage.getItem(`voted_${pollData.id}`);
        if (localVote) {
          setHasVoted(true);
          try {
            setUserSelectedOptions(JSON.parse(localVote));
          } catch (e) {}
        } else {
          // Check backend Redis set with device fingerprint
          const fp = getVoterFingerprint();
          const checkRes = await voteAPI.checkIfVoted(pollData.id, fp);
          if (checkRes.has_voted) {
            setHasVoted(true);
          }
        }
      } catch (err) {
        setErrorMessage('Poll not found or invalid share code.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPoll();
  }, [idOrCode]);

  // Real-time WebSocket Callback: Update option tallies instantly as new votes stream in
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

  // Real-time WebSocket Callback: Floating Live Reactions
  const handleLiveReaction = useCallback((reaction) => {
    setIncomingReaction(reaction);
  }, []);

  // Hook into Go Backend WebSocket
  const { isConnected, viewerCount, sendSocketReaction } = useWebSocket(
    poll?.id,
    handleLiveVoteUpdate,
    handleLiveReaction
  );

  // Send reaction trigger
  const handleSendReaction = (emoji) => {
    sendSocketReaction(emoji, 'Audience');
    if (poll?.id) {
      voteAPI.sendReaction(poll.id, emoji, 'Audience').catch(() => {});
    }
  };

  // Callback when vote is successfully cast
  const handleVoteSubmitted = (chosenOptionIDs, liveUpdate) => {
    setHasVoted(true);
    setUserSelectedOptions(chosenOptionIDs);
    if (liveUpdate) {
      handleLiveVoteUpdate(liveUpdate);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <Loader2 size={36} className="animate-spin" color="var(--accent-primary)" />
        <p style={{ color: 'var(--text-secondary)' }}>Connecting to live poll...</p>
      </div>
    );
  }

  if (errorMessage || !poll) {
    return (
      <div className="glass-card" style={{ maxWidth: '500px', margin: '4rem auto', textAlign: 'center', padding: '2.5rem' }}>
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', width: '52px', height: '52px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <AlertCircle size={28} />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>Poll Unavailable</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
          {errorMessage || 'This poll could not be located.'}
        </p>
        <Link to="/" className="btn btn-primary">
          Return Home
        </Link>
      </div>
    );
  }

  const isClosed = !poll.is_active || (poll.settings?.expires_at && new Date() > new Date(poll.settings.expires_at));

  return (
    <div style={{ maxWidth: '680px', margin: '1rem auto 4rem', width: '100%' }}>
      {/* Top Realtime Status Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {poll.is_active ? (
            <span className="badge badge-live">Live</span>
          ) : (
            <span className="badge badge-paused">Paused</span>
          )}
          <span className="badge badge-code">{poll.code}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {/* Active Viewers Count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Users size={15} color="#818cf8" />
            <span><strong>{viewerCount}</strong> watching</span>
          </div>

          {/* WebSocket Connection Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }} title={isConnected ? 'Realtime Connected' : 'Connecting...'}>
            {isConnected ? <Wifi size={15} color="#10b981" /> : <WifiOff size={15} color="#f59e0b" />}
            <span style={{ fontSize: '0.75rem', color: isConnected ? '#10b981' : '#f59e0b' }}>
              {isConnected ? 'Sync Active' : 'Connecting...'}
            </span>
          </div>

          {/* Share Button */}
          <button
            onClick={() => setShowShareModal(true)}
            className="btn btn-secondary btn-icon"
            style={{ padding: '0.4rem 0.6rem' }}
            title="Share Poll"
          >
            <Share2 size={14} />
          </button>
        </div>
      </div>

      {/* Main Poll Card */}
      <div className="glass-card" style={{ padding: '2rem' }}>
        {/* Creator Attribution & Expiration */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <span>Hosted by {poll.creator_name || 'Host'}</span>
          {poll.settings?.expires_at && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock size={13} /> Expires {new Date(poll.settings.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Question Title */}
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, lineHeight: 1.3, color: 'var(--text-primary)', marginBottom: poll.description ? '0.5rem' : '1.5rem' }}>
          {poll.title}
        </h1>

        {/* Optional Description */}
        {poll.description && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            {poll.description}
          </p>
        )}

        {/* Poll Closed Notice */}
        {isClosed && (
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--warning-bg)',
              color: 'var(--warning)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              fontSize: '0.9rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={16} />
            <span>Voting has ended or is currently paused by the host. Displaying final results.</span>
          </div>
        )}

        {/* Conditional View: Voting Interface VS Live Results Chart */}
        {!hasVoted && !isClosed ? (
          <VotingInterface poll={poll} onVoteSubmitted={handleVoteSubmitted} />
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontWeight: 600, fontSize: '0.95rem' }}>
                <CheckCircle2 size={18} />
                <span>{hasVoted ? 'Your vote is recorded!' : 'Live Results'}</span>
              </div>
              <span className="badge badge-code">
                {poll.total_votes || 0} Total {poll.total_votes === 1 ? 'Vote' : 'Votes'}
              </span>
            </div>

            {/* Live Updating Percentage Chart */}
            <LiveResultsChart poll={poll} userSelectedOptions={userSelectedOptions} />
          </div>
        )}

        {/* Real-time Floating Live Reactions Stream */}
        <ReactionStream onSendReaction={handleSendReaction} incomingReaction={incomingReaction} />
      </div>

      {/* Share & QR Code Modal */}
      <QRCodeModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} poll={poll} />
    </div>
  );
}
