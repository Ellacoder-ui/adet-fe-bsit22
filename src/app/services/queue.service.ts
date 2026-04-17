import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';

export interface QueueEntry {
  queueNumber: string;
  counter: string;
  timeJoined: string;
  status: 'waiting' | 'called' | 'serving' | 'completed' | 'served' | 'cancelled' | 'missed';
  queueType?: string;
  estimatedWaitMinutes?: number;
}

export interface HomeState {
  nowServing: string | null;
  myQueueNumber: string | null;
  counter?: string | null;
  peopleAhead: number;
  estimatedWaitMinutes: number;
  queueAvailable: boolean;
}

export interface QueueLogEntry {
  queueNumber: string;
  queueType: string;
  status: string;
  createdAt: string | null;
  servedAt: string | null;
  cancelledAt: string | null;
}

// Keep the old Queue interface for backward compatibility with queue.component.ts
export interface Queue {
  queue_id: number;
  student_id: number;
  service_id: number;
  counter_id: number;
  queue_number: number;
  status: 'waiting' | 'serving' | 'done' | 'skipped' | 'completed' | 'cancelled';
  service_name?: string;
  student_name?: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class QueueService {
  private API = 'http://localhost:3000/api';

  homeState = signal<HomeState>({
    nowServing: null,
    myQueueNumber: null,
    counter: null,
    peopleAhead: 0,
    estimatedWaitMinutes: 0,
    queueAvailable: true
  });

  currentQueue = signal<QueueEntry | null>(null);
  queueHistory = signal<QueueLogEntry[]>([]);

  constructor(private http: HttpClient) {}

  getHomeState(counter?: string): Observable<HomeState> {
    const url = counter
      ? `${this.API}/queue/home?counter=${counter}`
      : `${this.API}/queue/home`;
    return this.http.get<HomeState>(url).pipe(
      tap(state => this.homeState.set(state))
    );
  }

  getCurrentQueue(): Observable<QueueEntry | null> {
    return this.http.get<QueueEntry | null>(`${this.API}/queue/current`).pipe(
      tap(q => {
        this.currentQueue.set(q);
        if (q) this.homeState.update(s => ({ ...s, myQueueNumber: q.queueNumber }));
      })
    );
  }

  getQueueNumber(counter: string): Observable<QueueEntry> {
    return this.http.post<QueueEntry>(`${this.API}/queue/get-number`, { counter }).pipe(
      tap(entry => {
        this.currentQueue.set(entry);
        this.homeState.update(s => ({ ...s, myQueueNumber: entry.queueNumber, counter: entry.counter }));
      })
    );
  }

  getQueueHistory(): Observable<QueueLogEntry[]> {
    return this.http.get<QueueLogEntry[]>(`${this.API}/queue/history`).pipe(
      tap(history => this.queueHistory.set(history))
    );
  }

  callNext(counter: string): Observable<any> {
    return this.http.post(`${this.API}/queue/call-next`, { counter });
  }

  markServed(queueNumber: string, counter: string): Observable<any> {
    return this.http.post(`${this.API}/queue/mark-served`, { queueNumber, counter });
  }

  markMissed(queueNumber: string, counter: string): Observable<any> {
    return this.http.post(`${this.API}/queue/mark-missed`, { queueNumber, counter });
  }

  // Stub kept for queue.component.ts compatibility
  getQueuesByCounter(_counterId: number): Observable<Queue[]> {
    return this.http.get<Queue[]>(`${this.API}/queue/all`).pipe(
      // Avoid surfacing low-level transport/CORS messages to the UI.
      catchError(() => of([]))
    );
  }

  updateQueueStatus(_queueId: number, _status: string, _role: string): Observable<any> {
    return this.http.post(`${this.API}/queue/mark-served`, {});
  }

  resetServiceQueue(_serviceId: number): Observable<any> {
    return this.http.post(`${this.API}/queue/toggle`, {});
  }
}