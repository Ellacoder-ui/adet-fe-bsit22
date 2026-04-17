import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

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

export interface CreateQueueRequest {
  student_id: number;
  service_id: number;
  role: 'student';
}

@Injectable({
  providedIn: 'root'
})
export class QueueService extends ApiService {

  getAllQueues(): Observable<Queue[]> {
    return this.get<Queue[]>('/queue/list')
      .pipe(
        map(response => response.success ? response.data || [] : [])
      );
  }

  getQueueById(id: number): Observable<Queue | null> {
    return this.get<Queue>(`/queues/${id}`)
      .pipe(
        map(response => response.success ? response.data || null : null)
      );
  }

  getQueuesByStudent(studentId: number): Observable<Queue[]> {
    return this.get<Queue[]>(`/queues/student/${studentId}`)
      .pipe(
        map(response => response.success ? response.data || [] : [])
      );
  }

  getQueuesByCounter(counterId: number): Observable<Queue[]> {
    return this.get<Queue[]>(`/queue/by-counter/${counterId}`)
      .pipe(
        map(response => response.success ? response.data || [] : [])
      );
  }

  createQueue(queueData: CreateQueueRequest): Observable<any> {
    return this.post('/queue/create', queueData)
      .pipe(
        map(response => {
          if (response.success) {
            return response.data;
          } else {
            throw new Error(response.error || 'Failed to create queue');
          }
        })
      );
  }

  updateQueueStatus(queueId: number, status: Queue['status'], role: 'staff'): Observable<any> {
    return this.put('/queue/update-status', { queue_id: queueId, status, role })
      .pipe(
        map(response => {
          if (response.success) {
            return response.data;
          } else {
            throw new Error(response.error || 'Failed to update queue status');
          }
        })
      );
  }

  callNext(counterId: number, role: 'staff'): Observable<Queue | null> {
    return this.post<Queue | null>(`/queue/next/${counterId}`, { role })
      .pipe(
        map(response => (response.success ? response.data ?? null : null))
      );
  }

  resetServiceQueue(serviceId: number): Observable<any> {
    return this.post(`/queue/reset/${serviceId}`, { role: 'staff' })
      .pipe(
        map(response => {
          if (response.success) {
            return response.data;
          } else {
            throw new Error(response.error || 'Failed to reset queue');
          }
        })
      );
  }

  deleteQueue(queueId: number): Observable<any> {
    return this.delete(`/queue/${queueId}`)
      .pipe(
        map(response => {
          if (response.success) {
            return response.message;
          } else {
            throw new Error(response.error || 'Failed to delete queue');
          }
        })
      );
  }
}