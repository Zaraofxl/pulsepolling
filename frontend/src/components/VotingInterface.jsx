import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { voteAPI } from '../api/client';
import { getVoterFingerprint } from '../utils/fingerprint';
import { Check, Send, AlertCircle, Loader2 } from 'lucide-react';

// ============================================================================
// AUDIENCE VOTING INTERFACE
// Handles interactive selection of choices (single or multi-choice),
// server-side validation submission, anti-duplicate prevention, and confetti.
// ============================================================================

export default function VotingInterface({ poll, onVoteSubmitted }) {
  const [selectedOptionIDs, setSelectedOptionIDs] = useState([]);
  const [voterName, setVoterName] = useState('');
  const [voterGender, setVoterGender] = useState('');
  const [voterPlace, setVoterPlace] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const allowMultiple = poll.settings?.allow_multiple || false;
  const requireName = poll.settings?.require_voter_name || false;
  const requireGender = poll.settings?.require_gender || false;
  const requirePlace = poll.settings?.require_place || false;

  // Toggle option selection
  const handleToggleOption = (optionID) => {
    if (allowMultiple) {
      // Multi-choice toggle
      setSelectedOptionIDs((prev) =>
        prev.includes(optionID) ? prev.filter((id) => id !== optionID) : [...prev, optionID]
      );
    } else {
      // Single choice toggle
      setSelectedOptionIDs([optionID]);
    }
  };

  // Submit vote to Go backend
  const handleSubmitVote = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (selectedOptionIDs.length === 0) {
      setErrorMessage('Please select at least one option before submitting.');
      return;
    }

    if (requireName && !voterName.trim()) {
      setErrorMessage('Please enter your name to submit your vote.');
      return;
    }

    if (requireGender && !voterGender.trim()) {
      setErrorMessage('Please select your gender to submit your vote.');
      return;
    }

    if (requirePlace && !voterPlace.trim()) {
      setErrorMessage('Please enter your place / location to submit your vote.');
      return;
    }

    setIsSubmitting(true);
    try {
      const fingerprint = getVoterFingerprint();
      const payload = {
        option_ids: selectedOptionIDs,
        voter_fingerprint: fingerprint,
        voter_name: voterName.trim() || undefined,
        voter_gender: voterGender.trim() || undefined,
        voter_place: voterPlace.trim() || undefined,
      };

      const res = await voteAPI.castVote(poll.id, payload);

      // Trigger celebratory confetti effect
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#10b981', '#f59e0b', '#ec4899'],
        });
      } catch (err) {
        // Confetti non-fatal fallback
      }

      // Mark local state and notify parent
      localStorage.setItem(`voted_${poll.id}`, JSON.stringify(selectedOptionIDs));
      if (onVoteSubmitted) {
        onVoteSubmitted(selectedOptionIDs, res.data);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to submit vote. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmitVote} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Informational Subtitle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {allowMultiple ? 'Select all that apply:' : 'Select one option:'}
        </span>
        <span className="badge badge-code" style={{ fontSize: '0.75rem' }}>
          {allowMultiple ? 'Multiple Choice' : 'Single Choice'}
        </span>
      </div>

      {/* Options List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {poll.options?.map((option) => {
          const isSelected = selectedOptionIDs.includes(option.id);

          return (
            <div
              key={option.id}
              onClick={() => handleToggleOption(option.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-input)',
                border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                {/* Checkbox / Radio Visual Indicator */}
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: allowMultiple ? '6px' : '50%',
                    border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
                    backgroundColor: isSelected ? 'var(--accent-primary)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {isSelected && <Check size={14} strokeWidth={3} />}
                </div>

                <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {option.text}
                </span>
              </div>

              {/* Color Accent Indicator */}
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: option.color || 'var(--accent-primary)',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Optional Voter Name Input */}
      {requireName && (
        <div className="input-group" style={{ marginTop: '0.5rem' }}>
          <label className="input-label">Your Name (Required by host) *</label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Alex Smith"
            value={voterName}
            onChange={(e) => setVoterName(e.target.value)}
            required
          />
        </div>
      )}

      {/* Required Voter Gender Input */}
      {requireGender && (
        <div className="input-group" style={{ marginTop: '0.5rem' }}>
          <label className="input-label">Your Gender (Required by host) *</label>
          <select
            className="input-field"
            value={voterGender}
            onChange={(e) => setVoterGender(e.target.value)}
            required
            style={{ cursor: 'pointer' }}
          >
            <option value="">-- Select Gender --</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Non-Binary">Non-Binary</option>
            <option value="Prefer not to say">Prefer not to say</option>
            <option value="Other">Other</option>
          </select>
        </div>
      )}

      {/* Required Voter Place / Location Input */}
      {requirePlace && (
        <div className="input-group" style={{ marginTop: '0.5rem' }}>
          <label className="input-label">Your Place / Location (Required by host) *</label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Salem, Chennai, Bangalore..."
            value={voterPlace}
            onChange={(e) => setVoterPlace(e.target.value)}
            required
          />
        </div>
      )}

      {/* Error Alert Message */}
      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            fontSize: '0.9rem',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || selectedOptionIDs.length === 0}
        className="btn btn-primary"
        style={{
          padding: '0.9rem',
          fontSize: '1rem',
          marginTop: '0.5rem',
          opacity: selectedOptionIDs.length === 0 ? 0.6 : 1,
        }}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Casting Vote...</span>
          </>
        ) : (
          <>
            <Send size={18} />
            <span>Submit Vote</span>
          </>
        )}
      </button>
    </form>
  );
}
