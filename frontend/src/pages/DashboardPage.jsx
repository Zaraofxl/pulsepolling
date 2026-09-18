import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { pollAPI } from '../api/client';
import PollCard from '../components/PollCard';
import { 
  PlusCircle, 
  BarChart2, 
  Vote, 
  Radio, 
  Search, 
  Loader2, 
  RefreshCw 
} from 'lucide-react';

// ============================================================================
// DASHBOARD PAGE
// Creator management hub showing aggregated statistics, search filtering,
// and full CRUD controls over hosted live polls.
// ============================================================================

export default function DashboardPage() {
  const [polls, setPolls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'active' | 'paused'
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch creator polls on mount
  const fetchPolls = async () => {
    setIsLoading(true);
    try {
      const res = await pollAPI.getMyPolls();
      setPolls(res.data || []);
    } catch (err) {
      console.error('Failed to load creator polls', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, []);

  // Handle local update of a single poll card
  const handlePollUpdated = (updatedPoll) => {
    setPolls((prev) => prev.map((p) => (p.id === updatedPoll.id ? updatedPoll : p)));
  };

  // Handle removal of deleted poll
  const handlePollDeleted = (deletedID) => {
    setPolls((prev) => prev.filter((p) => p.id !== deletedID));
  };

  // Calculated Stats
  const totalPolls = polls.length;
  const totalVotes = polls.reduce((acc, p) => acc + (p.total_votes || 0), 0);
  const activePolls = polls.filter((p) => p.is_active).length;

  // Filtered Poll List
  const filteredPolls = polls.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.code.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterStatus === 'active') return matchesSearch && p.is_active;
    if (filterStatus === 'paused') return matchesSearch && !p.is_active;
    return matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Creator Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Monitor and control your interactive live polls
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={fetchPolls} className="btn btn-secondary btn-icon" title="Refresh Polls">
            <RefreshCw size={16} />
          </button>
          <Link to="/create" className="btn btn-primary">
            <PlusCircle size={18} />
            <span>Create Poll</span>
          </Link>
        </div>
      </div>

      {/* Analytics Summary Stats Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <BarChart2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Polls</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalPolls}</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <Vote size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Votes Cast</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalVotes}</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <Radio size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Live Active Polls</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{activePolls}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Search Input */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Search by title or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.4rem' }}
          />
          <Search size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-input)', padding: '0.3rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          {['all', 'active', 'paused'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                border: 'none',
                background: filterStatus === status ? 'var(--bg-card-hover)' : 'transparent',
                color: filterStatus === status ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all var(--transition-fast)',
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Poll Cards Grid or Empty State */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <Loader2 size={32} className="animate-spin" color="var(--accent-primary)" />
        </div>
      ) : filteredPolls.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {filteredPolls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              onPollUpdated={handlePollUpdated}
              onPollDeleted={handlePollDeleted}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', width: '54px', height: '54px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <BarChart2 size={28} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {searchQuery ? 'No polls match your search' : 'No polls created yet'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
            {searchQuery ? 'Try modifying your filter or search query.' : 'Create your first interactive live poll and share the link with your audience!'}
          </p>
          <Link to="/create" className="btn btn-primary">
            <PlusCircle size={18} />
            <span>Create Your First Poll</span>
          </Link>
        </div>
      )}
    </div>
  );
}
