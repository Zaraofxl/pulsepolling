import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Tv, 
  Vote, 
  QrCode, 
  Download, 
  RotateCcw, 
  Trash2, 
  Play, 
  Pause,
  ExternalLink,
  Users,
  FileImage
} from 'lucide-react';
import { pollAPI } from '../api/client';
import QRCodeModal from './QRCodeModal';
import LiveResultsChart from './LiveResultsChart';
import { exportChartPng } from '../utils/exportChartPng';

// ============================================================================
// DASHBOARD POLL CARD COMPONENT
// Renders an individual poll summary with management controls, live status,
// and presentation triggers for poll hosts.
// ============================================================================

export default function PollCard({ poll, onPollUpdated, onPollDeleted }) {
  const [showQR, setShowQR] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Toggle Pause / Resume state of the poll
  const handleToggleActive = async () => {
    setIsUpdating(true);
    try {
      const res = await pollAPI.updatePoll(poll.id, { is_active: !poll.is_active });
      if (onPollUpdated) onPollUpdated(res.data);
    } catch (err) {
      console.error('Failed to toggle status', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Reset live votes to 0
  const handleResetVotes = async () => {
    if (!window.confirm(`Are you sure you want to reset all votes for "${poll.title}"?`)) return;
    try {
      await pollAPI.resetPoll(poll.id);
      if (onPollUpdated) {
        onPollUpdated({ ...poll, total_votes: 0, options: poll.options.map(o => ({ ...o, votes: 0 })) });
      }
    } catch (err) {
      console.error('Failed to reset poll votes', err);
    }
  };

  // Delete poll permanently
  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete the poll "${poll.title}"?`)) return;
    try {
      await pollAPI.deletePoll(poll.id);
      if (onPollDeleted) onPollDeleted(poll.id);
    } catch (err) {
      console.error('Failed to delete poll', err);
    }
  };

  return (
    <>
      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Top Header (Status Badge, Code, Total Votes) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {poll.is_active ? (
              <span className="badge badge-active">Active</span>
            ) : (
              <span className="badge badge-paused">Paused</span>
            )}
            <span className="badge badge-code">{poll.code}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <Users size={16} />
            <strong style={{ color: 'var(--text-primary)' }}>{poll.total_votes || 0}</strong> votes
          </div>
        </div>

        {/* Poll Title & Options Count */}
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            {poll.title}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {poll.options?.length || 0} Options • Created {new Date(poll.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Polling Results Chart */}
        <div style={{ padding: '0.85rem 1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <LiveResultsChart poll={poll} />
        </div>

        {/* Primary Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
          <Link
            to={`/admin/live/${poll.id}`}
            className="btn btn-primary"
            style={{ padding: '0.6rem 0.85rem', fontSize: '0.875rem' }}
          >
            <Tv size={16} />
            <span>Live Screen</span>
          </Link>

          <Link
            to={`/poll/${poll.code || poll.id}`}
            target="_blank"
            className="btn btn-secondary"
            style={{ padding: '0.6rem 0.85rem', fontSize: '0.875rem' }}
          >
            <Vote size={16} />
            <span>Vote Page</span>
            <ExternalLink size={12} style={{ marginLeft: 'auto' }} />
          </Link>
        </div>

        {/* Secondary Management Controls Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {/* Show QR Code */}
            <button
              onClick={() => setShowQR(true)}
              className="btn btn-secondary btn-icon"
              title="Show Audience QR Code"
            >
              <QrCode size={15} />
            </button>

            {/* Download PNG Chart */}
            <button
              onClick={() => exportChartPng(poll)}
              className="btn btn-secondary btn-icon"
              title="Download Polling Chart as PNG"
              style={{ color: '#818cf8' }}
            >
              <FileImage size={15} />
            </button>

            {/* Toggle Active / Pause */}
            <button
              onClick={handleToggleActive}
              disabled={isUpdating}
              className="btn btn-secondary btn-icon"
              title={poll.is_active ? 'Pause Voting' : 'Resume Voting'}
            >
              {poll.is_active ? <Pause size={15} /> : <Play size={15} color="#10b981" />}
            </button>

            {/* Export CSV */}
            <a
              href={pollAPI.getExportCSVUrl(poll.id)}
              download
              className="btn btn-secondary btn-icon"
              title="Export Results to CSV"
            >
              <Download size={15} />
            </a>

            {/* Reset Votes */}
            <button
              onClick={handleResetVotes}
              className="btn btn-secondary btn-icon"
              title="Reset Live Votes to 0"
            >
              <RotateCcw size={15} />
            </button>
          </div>

          {/* Delete Poll */}
          <button
            onClick={handleDelete}
            className="btn btn-danger btn-icon"
            title="Delete Poll"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* QR Code Presentation Modal */}
      <QRCodeModal isOpen={showQR} onClose={() => setShowQR(false)} poll={poll} />
    </>
  );
}
