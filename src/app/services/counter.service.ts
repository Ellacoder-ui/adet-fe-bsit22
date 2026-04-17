import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface Counter {
  counter_id: number;
  counter_name: string;
}

@Injectable({
  providedIn: 'root'
})
export class CounterService extends ApiService {

  getAllCounters(): Observable<Counter[]> {
    return this.get<Counter[]>('/counters')
      .pipe(
        map(response => response.success ? response.data || [] : [])
      );
  }

  getCounterById(id: number): Observable<Counter | null> {
    return this.get<Counter>(`/counters/${id}`)
      .pipe(
        map(response => response.success ? response.data || null : null)
      );
  }
}