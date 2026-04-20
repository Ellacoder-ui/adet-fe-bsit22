import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface Service {
  service_id: number;
  name: string;
  cashier_id: number;
  counter_id: number;
  queue_number: number;
}

export interface CreateServiceRequest {
  cashier_id: number;
  counter_id: number;
  queue_number?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ServiceService extends ApiService {

  getAllServices(): Observable<Service[]> {
    return this.get<Service[]>('/services')
      .pipe(
        map(response => response.success ? response.data || [] : [])
      );
  }

  getServiceById(id: number): Observable<Service | null> {
    return this.get<Service>(`/services/${id}`)
      .pipe(
        map(response => response.success ? response.data || null : null)
      );
  }

  getServicesByCounter(counterId: number): Observable<Service[]> {
    return this.get<Service[]>(`/services/counter/${counterId}`)
      .pipe(
        map(response => response.success ? response.data || [] : [])
      );
  }

  createService(serviceData: CreateServiceRequest): Observable<any> {
    return this.post('/services', serviceData)
      .pipe(
        map(response => {
          if (response.success) {
            return response.data;
          } else {
            throw new Error(response.error || 'Failed to create service');
          }
        })
      );
  }
}