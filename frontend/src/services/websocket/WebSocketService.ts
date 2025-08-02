import { io, Socket } from 'socket.io-client';
import { store } from '../../store';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    const token = store.getState().auth.token;
    if (!token) {
      console.warn('No auth token available for WebSocket connection');
      return;
    }

    this.socket = io(import.meta.env.VITE_WS_URL || 'ws://localhost:8000', {
      auth: {
        token,
      },
      transports: ['websocket'],
    });

    this.setupEventListeners();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      
      // Subscribe to relevant channels
      this.subscribe('portfolio_updates');
      this.subscribe('position_updates');
      this.subscribe('system_logs');
      this.subscribe('market_data');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect
        return;
      }
      
      this.handleReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    });

    // Handle different message types
    this.socket.on('portfolio_update', (data) => {
      // Dispatch to Redux store
      // store.dispatch(updatePortfolio(data));
      console.log('Portfolio update:', data);
    });

    this.socket.on('position_update', (data) => {
      // store.dispatch(updatePosition(data));
      console.log('Position update:', data);
    });

    this.socket.on('system_log', (data) => {
      // store.dispatch(addSystemLog(data));
      console.log('System log:', data);
    });

    this.socket.on('market_data', (data) => {
      // store.dispatch(updateMarketData(data));
      console.log('Market data:', data);
    });

    this.socket.on('strategy_signal', (data) => {
      // store.dispatch(addStrategySignal(data));
      console.log('Strategy signal:', data);
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  subscribe(channel: string): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe', { channel });
      console.log(`Subscribed to channel: ${channel}`);
    }
  }

  unsubscribe(channel: string): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe', { channel });
      console.log(`Unsubscribed from channel: ${channel}`);
    }
  }

  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected, cannot emit event:', event);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const webSocketService = new WebSocketService();