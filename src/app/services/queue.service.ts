import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';

export interface QueueEntry {
  queueNumber: string;
  counter: string;
  timeJoined: string;
  status: 'waiting' | 'called' | 'serving' | 'completed' | 'served' | 'cancelled' | 'missed';
  serviceId?: number;
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

  getCurrentQueue(studentId?: number | null): Observable<QueueEntry | null> {
    if (!studentId) return of(null);
    return this.http.get<{ success: boolean; data: any[] }>(
      `${this.API}/queues/student/${studentId}`
    ).pipe(
      map(res => {
        if (!res.success || !res.data?.length) return null;
        // Try active ticket first; fall back to most recent for done/skipped detection
        const active = res.data.find(
          q => q.status === 'waiting' || q.status === 'serving' || q.status === 'called'
        );
        // If no active ticket, check most recent (may be 'done'/'skipped')
        const ticket = active ?? res.data[0];
        if (!ticket) return null;
        const entry: QueueEntry = {
          queueNumber: String(ticket.queue_number ?? ticket.number ?? ''),
          counter: String(ticket.counter_id ?? ''),
          timeJoined: ticket.created_at ?? '',
          status: ticket.status,
          serviceId: ticket.service_id ? Number(ticket.service_id) : undefined
        };
        this.currentQueue.set(entry);
        this.homeState.update(s => ({ ...s, myQueueNumber: entry.queueNumber }));
        return entry;
      }),
      catchError(() => of(null))
    );
  }

  getServiceFeed(): Observable<any[]> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.API}/queues/feed`).pipe(
      map(res => res.success ? res.data ?? [] : []),
      catchError(() => of([]))
    );
  }

  getQueuesByService(serviceId: number): Observable<Queue[]> {
    if (!serviceId) return of([]);
    return this.http.get<{ success: boolean; data: Queue[] }>(
      `${this.API}/queues/by-service/${serviceId}`
    ).pipe(
      map(res => res.success ? res.data ?? [] : []),
      catchError(() => of([]))
    );
  }

  getQueueNumber(serviceId: number, studentId: number): Observable<QueueEntry> {
    return this.http.post<{ success: boolean; data: any; error?: string }>(
      `${this.API}/queues/create`,
      { student_id: studentId, service_id: serviceId, role: 'student' }
    ).pipe(
      map(res => {
        if (!res.success) throw new Error(res.error || 'Failed to create queue');
        const d = res.data;
        return {
          queueNumber: String(d.queue_number),
          counter: String(d.counter_id ?? serviceId),
          timeJoined: d.created_at ?? new Date().toISOString(),
          status: 'waiting' as const
        };
      }),
      tap(entry => {
        this.currentQueue.set(entry);
        this.homeState.update(s => ({ ...s, myQueueNumber: entry.queueNumber }));
      }),
      catchError(err => throwError(() => new Error(err?.error?.error || err?.message || 'Failed to create queue')))
    );
  }

  getQueueHistory(): Observable<QueueLogEntry[]> {
    return this.http.get<QueueLogEntry[]>(`${this.API}/queue/history`).pipe(
      tap(history => this.queueHistory.set(history))
    );
  }

  callNext(serviceId: number): Observable<any> {
    return this.http.post<{ success: boolean; data: any; error?: string }>(
      `${this.API}/queues/next`,
      { service_id: serviceId, role: 'staff' }
    ).pipe(
      map(res => {
        if (!res.success) throw new Error(res.error || 'Failed to call next');
        return res.data;
      }),
      catchError(err => throwError(() => new Error(err?.error?.error || err?.message || 'Failed to call next queue')))
    );
  }

  markServed(queueNumber: string, counter: string): Observable<any> {
    return this.http.post(`${this.API}/queue/mark-served`, { queueNumber, counter });
  }

  markMissed(queueNumber: string, counter: string): Observable<any> {
    return this.http.post(`${this.API}/queue/mark-missed`, { queueNumber, counter });
  }

  getQueuesByCounter(counterId: number): Observable<Queue[]> {
    if (!counterId) return of([]);
    return this.http.get<{ success: boolean; data: Queue[] }>(
      `${this.API}/queues/counter/${counterId}`
    ).pipe(
      map(res => res.success ? res.data ?? [] : []),
      catchError(() => of([]))
    );
  }

  updateQueueStatus(queueId: number, status: string, role: string): Observable<any> {
    return this.http.put<{ success: boolean; data: any; error?: string }>(
      `${this.API}/queues/update-status`,
      { queue_id: queueId, status, role }
    ).pipe(
      map(res => {
        if (!res.success) throw new Error(res.error || 'Failed to update status');
        return res.data;
      }),
      catchError(err => throwError(() => new Error(err?.error?.error || err?.message || 'Failed to update queue status')))
    );
  }

  resetServiceQueue(serviceId: number): Observable<any> {
    return this.http.post<{ success: boolean; data: any; error?: string }>(
      `${this.API}/queues/reset/${serviceId}`,
      { role: 'staff' }
    ).pipe(
      map(res => {
        if (!res.success) throw new Error(res.error || 'Failed to reset queue');
        return res.data;
      }),
      catchError(err => throwError(() => new Error(err?.error?.error || err?.message || 'Failed to reset queue')))
    );
  }

  undoNextQueue(serviceId: number): Observable<any> {
    return this.http.post<{ success: boolean; data: any; error?: string }>(
      `${this.API}/queues/undo`,
      { service_id: serviceId, role: 'staff' }
    ).pipe(
      map(res => {
        if (!res.success) throw new Error(res.error || 'Failed to undo');
        return res.data;
      }),
      catchError(err => throwError(() => new Error(err?.error?.error || err?.message || 'Failed to undo queue call')))
    );
  }
}