import axios from 'axios';

// ============================================================================
// PULSEPOLL API CLIENT & NETWORK LAYER
// Configures Axios HTTP client with automatic JWT token attachment,
// base URL resolution, and standardized response helpers.
// ============================================================================

// Base API URL pointing to the Go Gin backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

// Create configured Axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Request Interceptor: Automatically injects JWT Bearer token into Authorization header
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pulsepoll_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Catches global 401 Unauthorized errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // If token is invalid or expired, purge local storage
    if (error.response && error.response.status === 401) {
      const isAuthEndpoint = error.config.url.includes('/auth/login') || error.config.url.includes('/auth/register');
      if (!isAuthEndpoint) {
        localStorage.removeItem('pulsepoll_token');
        localStorage.removeItem('pulsepoll_user');
      }
    }
    return Promise.reject(error);
  }
);

// ----------------------------------------------------------------------------
// AUTHENTICATION API METHODS
// ----------------------------------------------------------------------------
export const authAPI = {
  // Register a new poll creator account
  register: async (userData) => {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },

  // Log in with existing credentials
  login: async (credentials) => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  // Fetch current user session details
  getMe: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};

// ----------------------------------------------------------------------------
// POLL MANAGEMENT API METHODS
// ----------------------------------------------------------------------------
export const pollAPI = {
  // Create a new poll (Authenticated)
  createPoll: async (pollData) => {
    const response = await apiClient.post('/polls', pollData);
    return response.data;
  },

  // Fetch public poll details by ID or 6-char Code (Public)
  getPoll: async (idOrCode) => {
    const response = await apiClient.get(`/polls/${idOrCode}`);
    return response.data;
  },

  // Fetch all polls created by current user (Authenticated)
  getMyPolls: async () => {
    const response = await apiClient.get('/polls/my');
    return response.data;
  },

  // Update poll state, pause/active, or settings (Authenticated)
  updatePoll: async (pollID, updateData) => {
    const response = await apiClient.put(`/polls/${pollID}`, updateData);
    return response.data;
  },

  // Delete a poll permanently (Authenticated)
  deletePoll: async (pollID) => {
    const response = await apiClient.delete(`/polls/${pollID}`);
    return response.data;
  },

  // Reset live vote tallies to zero (Authenticated)
  resetPoll: async (pollID) => {
    const response = await apiClient.post(`/polls/${pollID}/reset`);
    return response.data;
  },

  // Get direct URL for downloading CSV export report
  getExportCSVUrl: (pollID) => {
    return `${API_BASE_URL}/polls/${pollID}/export.csv`;
  },
};

// ----------------------------------------------------------------------------
// VOTING & INTERACTION API METHODS
// ----------------------------------------------------------------------------
export const voteAPI = {
  // Cast a vote for selected options (Public)
  castVote: async (pollID, voteData) => {
    const response = await apiClient.post(`/polls/${pollID}/vote`, voteData);
    return response.data;
  },

  // Check if voter device fingerprint has already cast a vote (Public)
  checkIfVoted: async (pollID, fingerprint) => {
    const response = await apiClient.get(`/polls/${pollID}/voted?fp=${encodeURIComponent(fingerprint)}`);
    return response.data;
  },

  // Send a floating live emoji reaction (Public)
  sendReaction: async (pollID, emoji, sender) => {
    const response = await apiClient.post(`/polls/${pollID}/reactions`, { emoji, sender });
    return response.data;
  },
};

export default apiClient;
