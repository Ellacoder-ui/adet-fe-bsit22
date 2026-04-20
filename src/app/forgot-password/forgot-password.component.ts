import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
  private router = inject(Router);
  private authService = inject(AuthService);

  public email = '';
  public newPassword = '';
  public confirmPassword = '';
  public isLoading = signal(false);
  public success = signal(false);
  public error = signal('');
  public showPassword = signal(false);
  public showConfirm = signal(false);

  public get fullEmail(): string {
    const raw = this.email.trim().toLowerCase();
    if (!raw) return '';
    if (raw.includes('@')) return raw;
    return `${raw}@liceo.edu.ph`;
  }

  public handleSubmit(): void {
    this.error.set('');
    if (!this.fullEmail) {
      this.error.set('Please enter your email address.');
      return;
    }
    if (!this.newPassword || !this.confirmPassword) {
      this.error.set('Please fill in all fields.');
      return;
    }
    if (this.newPassword.length < 5) {
      this.error.set('Password must be at least 5 characters.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }
    this.isLoading.set(true);
    this.authService.resetPasswordDirect(this.fullEmail, this.newPassword).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success) {
          this.success.set(true);
          setTimeout(() => {
            this.router.navigate(['/login'], { queryParams: { role: 'student' } });
          }, 2500);
        } else {
          this.error.set(res.error || 'Reset failed. Please check your email and try again.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err?.error?.error || 'Account not found. Please check your email.');
      }
    });
  }

  public toggleShowPassword(): void { this.showPassword.set(!this.showPassword()); }
  public toggleShowConfirm(): void { this.showConfirm.set(!this.showConfirm()); }

  public goBack(): void {
    this.router.navigate(['/login'], { queryParams: { role: 'student' } });
  }
}
