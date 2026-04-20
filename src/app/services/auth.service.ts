import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

const TOKEN_KEY = 'qjump_token';
const USER_KEY = 'qjump_user';

export interface AuthUser {
  id: number;
  email: string;
  role: 'student' | 'staff';
  fullName?: string;
  studentId?: number;
  assignedServiceId?: number | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private API = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  login(email: string, password: string, role?: 'student' | 'staff'): Observable<LoginResponse> {
    const body: Record<string, unknown> = { email, password };
    if (role) body['role'] = role;

    return this.http.post<{ success: boolean; data: any; error?: string }>(
      `${this.API}/auth/login`, body
    ).pipe(
      switchMap(res => {
        if (!res.success || !res.data) {
          return throwError(() => new Error(res.error || 'Login failed'));
        }
        const d = res.data;
        // For students, fetch their student record to obtain student_id
        if (d.role === 'student') {
          return this.http.get<{ success: boolean; data: any }>(
            `${this.API}/students/user/${d.id}`
          ).pipe(
            map(sr => ({ loginData: d, studentId: sr.success ? (sr.data?.id ?? sr.data?.student_id ?? null) : null })),
            catchError(() => of({ loginData: d, studentId: null as number | null }))
          );
        }
        return of({ loginData: d, studentId: null as number | null });
      }),
      map(({ loginData: d, studentId }) => {
        const user: AuthUser = {
          id: d.id,
          email: d.email,
          role: d.role,
          fullName: d.name,
          studentId: studentId ?? undefined,
          assignedServiceId: d.assigned_service_id ?? null
        };
        localStorage.setItem(TOKEN_KEY, d.token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        return { token: d.token, user };
      }),
      catchError(err => {
        const msg = err?.error?.error || err?.message || 'Login failed';
        return throwError(() => new Error(msg));
      })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getStoredUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  forgotPassword(email: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.API}/auth/forgot-password`, { email }
    );
  }

  verifyResetToken(token: string): Observable<{ success: boolean; email?: string; error?: string }> {
    return this.http.get<{ success: boolean; email?: string; error?: string }>(
      `${this.API}/auth/verify-reset-token?token=${encodeURIComponent(token)}`
    );
  }

  resetPasswordWithToken(token: string, newPassword: string): Observable<{ success: boolean; message?: string; error?: string }> {
    return this.http.post<{ success: boolean; message?: string; error?: string }>(
      `${this.API}/auth/reset-password`, { token, newPassword }
    );
  }

  resetPasswordDirect(email: string, newPassword: string): Observable<{ success: boolean; message?: string; error?: string }> {
    return this.http.post<{ success: boolean; message?: string; error?: string }>(
      `${this.API}/auth/reset-password`, { email, newPassword, role: 'student' }
    );
  }
}
