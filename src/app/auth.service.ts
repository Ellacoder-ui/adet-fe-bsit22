import { Injectable, signal } from '@angular/core';

export interface LoginResponse {
  success: boolean;
  data?: {
    user_id: number;
    email: string;
    role: 'student' | 'staff';
    created_at: Date;
  };
  error?: string;
}

export interface ValidateEmailResponse {
  success: boolean;
  isValid: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/auth';
  public currentUser = signal<any | null>(null);

  constructor() {
    // Restore user from localStorage if available
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      this.currentUser.set(JSON.parse(savedUser));
    }
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json() as LoginResponse;

      if (data.success && data.data) {
        this.currentUser.set(data.data);
        localStorage.setItem('currentUser', JSON.stringify(data.data));
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: 'Network error. Please try again.'
      };
    }
  }

  async validateEmail(email: string): Promise<ValidateEmailResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/validate-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      return await response.json() as ValidateEmailResponse;
    } catch (error) {
      return {
        success: false,
        isValid: false,
        message: 'Validation error'
      };
    }
  }

  logout() {
    this.currentUser.set(null);
    localStorage.removeItem('currentUser');
  }

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }

  getCurrentUser() {
    return this.currentUser();
  }

  getUserRole(): 'student' | 'staff' | null {
    const user = this.currentUser();
    return user ? user.role : null;
  }
}
