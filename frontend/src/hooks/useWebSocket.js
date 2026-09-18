import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================================
// WEBSOCKET REALTIME HOOK
// Connects client directly to Go Backend realtime hub, handles automatic
// reconnects, parses live vote aggregates, viewer counts, and live emojis.
// ============================================================================

export function useWebSocket(pollID, onVoteUpdate, onLiveReaction, onViewerCount) {
  const [isConnected, setIsConnected] = useState(false);
  const [viewerCount, setViewerCount] = useState(1);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  // Derive WebSocket URL from API host
  const getWSUrl = (id) => {
    const isHttps = window.location.protocol === 'https:';
    const wsProto = isHttps ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_WS_HOST || 'localhost:8080';
    return `${wsProto}//${wsHost}/ws/polls/${id}`;
  };

  const connect = useCallback(() => {
    if (!pollID) return;

    try {
      const url = getWSUrl(pollID);
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setIsConnected(true);
        console.log(`[WebSocket] Connected to live poll: ${pollID}`);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const payload = JSON.parse(event.data);

          // Type 1: Live Vote Ingestion Update
          if (payload.type === 'VOTE_UPDATE' && onVoteUpdate) {
            onVoteUpdate(payload.data);
          }

          // Type 2: Floating Live Emoji Reaction
          if (payload.type === 'LIVE_REACTION' && onLiveReaction) {
            onLiveReaction(payload.data);
          }

          // Type 3: Active Spectator Viewer Count
          if (payload.type === 'VIEWER_COUNT') {
            const count = payload.data.viewer_count || 1;
            setViewerCount(count);
            if (onViewerCount) onViewerCount(count);
          }
        } catch (err) {
          console.error('[WebSocket] Error parsing message payload:', err);
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setIsConnected(false);
        console.log('[WebSocket] Connection closed. Attempting reconnect in 2.5s...');
        // Auto-reconnect after 2.5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) connect();
        }, 2500);
      };

      ws.onerror = (err) => {
        console.warn('[WebSocket] Network error:', err);
        ws.close();
      };
    } catch (err) {
      console.error('[WebSocket] Failed to establish socket:', err);
    }
  }, [pollID, onVoteUpdate, onLiveReaction, onViewerCount]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  // Send an outbound live reaction emoji directly over the socket
  const sendSocketReaction = useCallback((emoji, sender) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ emoji, sender }));
    }
  }, []);

  return {
    isConnected,
    viewerCount,
    sendSocketReaction,
  };
}
