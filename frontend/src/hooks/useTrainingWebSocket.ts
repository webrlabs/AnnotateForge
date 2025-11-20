/**
 * WebSocket hook for real-time training progress updates
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { WSTrainingMessage, TrainingStatus } from '@/types/training';

export interface UseTrainingWebSocketOptions {
  jobId: string;
  onStatusChange?: (status: TrainingStatus) => void;
  onEpochStart?: (epoch: number, totalEpochs: number) => void;
  onEpochComplete?: (epoch: number, metrics: Record<string, any>) => void;
  onTrainingComplete?: (finalMetrics: Record<string, any>, modelId: string) => void;
  onTrainingFailed?: (error: string) => void;
}

export const useTrainingWebSocket = (options: UseTrainingWebSocketOptions) => {
  const {
    jobId,
    onStatusChange,
    onEpochStart,
    onEpochComplete,
    onTrainingComplete,
    onTrainingFailed,
  } = options;

  const { token } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Use refs to stabilize callbacks
  const callbacksRef = useRef({
    onStatusChange,
    onEpochStart,
    onEpochComplete,
    onTrainingComplete,
    onTrainingFailed,
  });

  useEffect(() => {
    callbacksRef.current = {
      onStatusChange,
      onEpochStart,
      onEpochComplete,
      onTrainingComplete,
      onTrainingFailed,
    };
  }, [onStatusChange, onEpochStart, onEpochComplete, onTrainingComplete, onTrainingFailed]);

  const connect = useCallback(() => {
    if (!token || !jobId) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsPort = import.meta.env.VITE_WS_PORT || '8000';
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/api/v1/training/ws/${jobId}?token=${token}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Training WebSocket connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: WSTrainingMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'status_change':
            callbacksRef.current.onStatusChange?.(message.status);
            break;

          case 'epoch_start':
            callbacksRef.current.onEpochStart?.(message.epoch, message.total_epochs);
            break;

          case 'epoch_complete':
            callbacksRef.current.onEpochComplete?.(message.epoch, message.metrics);
            break;

          case 'training_complete':
            callbacksRef.current.onTrainingComplete?.(message.final_metrics, message.model_id);
            break;

          case 'training_failed':
            callbacksRef.current.onTrainingFailed?.(message.error);
            break;

          default:
            console.log('Unknown training message type:', message);
        }
      } catch (error) {
        console.error('Error parsing training WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('Training WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('Training WebSocket disconnected');
      setIsConnected(false);

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
  }, [token, jobId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Send ping every 30 seconds to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      sendMessage({ type: 'ping' });
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected, sendMessage]);

  return {
    isConnected,
    sendMessage,
    reconnect: connect,
  };
};
