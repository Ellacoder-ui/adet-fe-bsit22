import { Injectable, signal, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

export interface WsMessage {
  type: string;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class WebsocketService implements OnDestroy {
  private ws: WebSocket | null = null;
  private WS_URL = 'ws://localhost:3000/ws/queue';
  private reconnectDelay = 3000;
  private shouldReconnect = false;

  connected = signal(false);
  messages$ = new Subject<WsMessage>();

  connect(): void {
    const token = localStorage.getItem('qjump_token');
    if (!token) return;

    this.shouldReconnect = true;
    this._openSocket(token);
  }

  private _openSocket(token: string): void {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }

    this.ws = new WebSocket(`${this.WS_URL}?token=${encodeURIComponent(token)}`);

    this.ws.onopen = () => {
      this.connected.set(true);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        this.messages$.next(msg);
      } catch (_) {
        // ignore non-JSON frames
      }
    };

    this.ws.onerror = () => {
      this.connected.set(false);
    };

    this.ws.onclose = () => {
      this.connected.set(false);
      if (this.shouldReconnect) {
        setTimeout(() => {
          const t = localStorage.getItem('qjump_token');
          if (t) this._openSocket(t);
        }, this.reconnectDelay);
      }
    };
  }

  send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.connected.set(false);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
