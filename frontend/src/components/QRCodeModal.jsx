import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, QrCode } from 'lucide-react';

// ============================================================================
// QR CODE & SHARE MODAL COMPONENT
// Generates scannable QR code for instant mobile audience voting and direct link copy.
// ============================================================================

export default function QRCodeModal({ isOpen, onClose, poll }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !poll) return null;

  // Resolve public voting URL
  const votingUrl = `${window.location.origin}/poll/${poll.code || poll.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(votingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Copy failed', err);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                padding: '0.5rem',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <QrCode size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Scan to Join Poll
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Audience can scan with phone camera to vote instantly
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-outline btn-icon" title="Close">
            <X size={18} />
          </button>
        </div>

        {/* QR Code Container */}
        <div
          style={{
            background: '#ffffff',
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: '0 auto 1.5rem',
            width: 'fit-content',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
          }}
        >
          <QRCodeSVG
            value={votingUrl}
            size={220}
            level="H"
            includeMargin={true}
          />
        </div>

        {/* Shareable Join Code Badge */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Or join with code: </span>
          <span className="badge badge-code" style={{ fontSize: '1.1rem', padding: '0.4rem 0.8rem' }}>
            {poll.code || 'PL-0000'}
          </span>
        </div>

        {/* Copy Link Input Bar */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            readOnly
            value={votingUrl}
            className="input-field"
            style={{ fontSize: '0.875rem' }}
          />
          <button
            onClick={handleCopyLink}
            className="btn btn-primary"
            style={{ flexShrink: 0, padding: '0.75rem 1.25rem' }}
          >
            {copied ? (
              <>
                <Check size={16} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
