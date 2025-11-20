/**
 * WebSocket collaboration hook for real-time multi-user features
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';

export interface ActiveUser {
  user_id: string;
  username: string;
}

export interface CollaborationMessage {
  type: string;
  [key: string]: any;
}

export interface UseCollaborationOptions {
  imageId: string;
  onMessage?: (message: CollaborationMessage) => void;
  onAnnotationCreated?: (annotation: any) => void;
  onAnnotationUpdated?: (annotation: any) => void;
  onAnnotationDeleted?: (annotationId: string) => void;
}

export const useCollaboration = (options: UseCollaborationOptions) => {
  const { imageId, onMessage, onAnnotationCreated, onAnnotationUpdated, onAnnotationDeleted } = options;

  const { token } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Use refs to stabilize callbacks and prevent connect from being recreated
  const callbacksRef = useRef({ onMessage, onAnnotationCreated, onAnnotationUpdated, onAnnotationDeleted });

  useEffect(() => {
    callbacksRef.current = { onMessage, onAnnotationCreated, onAnnotationUpdated, onAnnotationDeleted };
  }, [onMessage, onAnnotationCreated, onAnnotationUpdated, onAnnotationDeleted]);

  // Helper to compare user arrays
  const areUsersEqual = (users1: ActiveUser[], users2: ActiveUser[]): boolean => {
    if (users1.length !== users2.length) return false;
    const ids1 = users1.map(u => u.user_id).sort();
    const ids2 = users2.map(u => u.user_id).sort();
    return ids1.every((id, index) => id === ids2[index]);
  };

  const connect = useCallback(() => {
    if (!token || !imageId) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsPort = import.meta.env.VITE_WS_PORT || '8000';
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/api/v1/collaboration/ws/${imageId}?token=${token}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: CollaborationMessage = JSON.parse(event.data);

        // Call generic message handler
        callbacksRef.current.onMessage?.(message);

        // Handle specific message types
        switch (message.type) {
          case 'active_users':
            // Only update if users actually changed
            const newUsers = message.users || [];
            setActiveUsers(prev => {
              if (areUsersEqual(prev, newUsers)) {
                return prev; // No change, return same reference
              }
              return newUsers;
            });
            break;

          case 'user_joined':
          case 'user_left':
            // Completely ignore these messages - they contain false positives during reconnects
            // We rely solely on 'active_users' messages which are the authoritative state
            break;

          case 'annotation_created':
            callbacksRef.current.onAnnotationCreated?.(message.annotation);
            break;

          case 'annotation_updated':
            callbacksRef.current.onAnnotationUpdated?.(message.annotation);
            break;

          case 'annotation_deleted':
            callbacksRef.current.onAnnotationDeleted?.(message.annotation_id);
            break;

          case 'pong':
            // Keep-alive response
            break;

          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      setIsConnected(false);
      // DON'T clear activeUsers - maintain last known state to prevent false join notifications on reconnect

      // Attempt to reconnect with exponential backoff
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      }
    };

    wsRef.current = ws;
  }, [token, imageId]); // Removed callback dependencies - using callbacksRef instead

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      // Send explicit leave message before disconnecting
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'leave' }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    // Keep activeUsers state - only clear on unmount, not on disconnect
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Clear users when image changes
  useEffect(() => {
    setActiveUsers([]);
  }, [imageId]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    // Send leave message when user closes tab or navigates away
    const handleBeforeUnload = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'leave' }));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      disconnect();
      // Don't clear activeUsers here - it's cleared when imageId changes
    };
  }, [connect, disconnect]);

  // Send heartbeat every 5 seconds to maintain presence
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      sendMessage({ type: 'heartbeat' });
    }, 5000);

    return () => clearInterval(interval);
  }, [isConnected, sendMessage]);

  // Ping every 30 seconds to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      sendMessage({ type: 'ping' });
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected, sendMessage]);

  return {
    activeUsers,
    isConnected,
    sendMessage,
    reconnect: connect,
  };
};
