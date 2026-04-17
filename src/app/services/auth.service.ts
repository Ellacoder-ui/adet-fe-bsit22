import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface User {
  user_id: number;
  email: string;
  role: 'student' | 'staff';
  student_id?: number;
  cashier_id?: number;
  assigned_counter?: number | null;
  full_name?: string;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role: 'student' | 'staff';
  fullName: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService extends ApiService {

  login(credentials: LoginRequest): Observable<User> {
    return this.post<User>('/auth/login', credentials)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.error || 'Login failed');
          }
        })
      );
  }

  register(userData: RegisterRequest): Observable<any> {
    return this.post('/auth/register', userData)
      .pipe(
        map(response => {
          if (response.success) {
            return response.data;
          } else {
            throw new Error(response.error || 'Registration failed');
          }
        })
      );
  }
}