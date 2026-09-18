import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pollAPI } from '../api/client';
import { 
  Plus, 
  Trash2, 
  Settings2, 
  Sparkles, 
  AlertCircle, 
  Loader2, 
  Eye, 
  Layers 
} from 'lucide-react';

// ============================================================================
// CREATE POLL BUILDER PAGE
// Provides an interactive poll builder with dynamic option management,
// visual color picker chips, rule configurations, and instant live preview.
// ============================================================================

const PRESET_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ec4899', 
  '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6', 
  '#ef4444', '#3b82f6'
];

export default function CreatePollPage() {
  const navigate = useNavigate();

  // Poll Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState([
    { text: '', color: PRESET_COLORS[0] },
    { text: '', color: PRESET_COLORS[1] },
  ]);

  // Settings State
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [requireName, setRequireName] = useState(false);
  const [requireGender, setRequireGender] = useState(false);
  const [requirePlace, setRequirePlace] = useState(false);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add option (max 10)
  const handleAddOption = () => {
    if (options.length >= 10) return;
    const nextColor = PRESET_COLORS[options.length % PRESET_COLORS.length];
    setOptions([...options, { text: '', color: nextColor }]);
  };

  // Remove option (min 2)
  const handleRemoveOption = (index) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  // Update option text
  const handleOptionChange = (index, value) => {
    const updated = [...options];
    updated[index].text = value;
    setOptions(updated);
  };

  // Update option color
  const handleColorChange = (index, color) => {
    const updated = [...options];
    updated[index].color = color;
    setOptions(updated);
  };

  // Handle Poll Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage('Please enter a poll title or question.');
      return;
    }

    const validOptions = options.map((o) => o.text.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      setErrorMessage('Please provide at least 2 non-empty options.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        options: validOptions,
        colors: options.map((o) => o.color),
        settings: {
          allow_multiple: allowMultiple,
          require_voter_name: requireName,
          require_gender: requireGender,
          require_place: requirePlace,
          show_results_immediately: true,
          expires_at: hasExpiry && expiryDate ? new Date(expiryDate).toISOString() : undefined,
        },
      };

      const res = await pollAPI.createPoll(payload);
      // Navigate directly to creator live presenter page
      navigate(`/admin/live/${res.data.id}`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to create poll. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '1rem auto 3rem', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Create a Live Poll
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Configure your questions, choices, and presentation rules
        </p>
      </div>

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
            marginBottom: '1.5rem',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {/* Left Column: Question & Options Builder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Question / Title */}
          <div className="glass-card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} color="var(--accent-primary)" />
              <span>Poll Details</span>
            </h3>

            <div className="input-group">
              <label className="input-label">Question / Title *</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="e.g. What framework should we adopt for our next microservice?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Optional Description / Instructions</label>
              <textarea
                className="input-field"
                rows={2}
                placeholder="Provide additional context for voters..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Options Management */}
          <div className="glass-card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} color="var(--accent-primary)" />
                <span>Poll Options ({options.length}/10)</span>
              </h3>

              {options.length < 10 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                >
                  <Plus size={14} />
                  <span>Add Option</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {options.map((option, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {/* Option Color Palette Selector */}
                  <input
                    type="color"
                    value={option.color}
                    onChange={(e) => handleColorChange(index, e.target.value)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      background: 'transparent',
                      padding: '2px',
                    }}
                    title="Change Option Accent Color"
                  />

                  {/* Option Text Input */}
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder={`Option ${index + 1}`}
                    value={option.text}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                  />

                  {/* Delete Option (if > 2) */}
                  <button
                    type="button"
                    disabled={options.length <= 2}
                    onClick={() => handleRemoveOption(index)}
                    className="btn btn-outline btn-icon"
                    style={{
                      opacity: options.length <= 2 ? 0.4 : 1,
                      cursor: options.length <= 2 ? 'not-allowed' : 'pointer',
                    }}
                    title="Remove Option"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Settings & Live Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Rules & Settings Card */}
          <div className="glass-card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings2 size={18} color="var(--accent-primary)" />
              <span>Voting Rules & Settings</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Allow Multiple Choice */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowMultiple}
                  onChange={(e) => setAllowMultiple(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Allow Multiple Choices</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Voters can select more than one option</div>
                </div>
              </label>

              {/* Require Voter Name */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={requireName}
                  onChange={(e) => setRequireName(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Require Voter Name</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Prompt participants for their name before voting</div>
                </div>
              </label>

              {/* Require Voter Gender */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={requireGender}
                  onChange={(e) => setRequireGender(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Require Voter Gender</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Prompt participants to select their gender (Male, Female, Other)</div>
                </div>
              </label>

              {/* Require Voter Place / Location */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={requirePlace}
                  onChange={(e) => setRequirePlace(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Require Voter Place / Location</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Prompt participants to enter their city or location</div>
                </div>
              </label>

              {/* Expiration Date Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasExpiry}
                  onChange={(e) => setHasExpiry(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Set Auto-Expiration Timer</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Automatically close poll at specific date & time</div>
                </div>
              </label>

              {hasExpiry && (
                <div className="input-group" style={{ marginTop: '0.5rem' }}>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    required={hasExpiry}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Instant Live Preview Card */}
          <div className="glass-card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Eye size={18} color="var(--accent-primary)" />
              <span>Preview</span>
            </h3>

            <div style={{ padding: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                {title || 'Your Poll Question Will Appear Here'}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {options.map((opt, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.9rem',
                    }}
                  >
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: opt.color }} />
                    <span>{opt.text || `Option ${i + 1}`}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ padding: '1rem', fontSize: '1.05rem', boxShadow: 'var(--accent-glow)' }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Launching Live Poll...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Create & Launch Live Poll</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
