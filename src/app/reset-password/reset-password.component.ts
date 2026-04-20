import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  public token = '';
  public newPassword = '';
  public confirmPassword = '';
  public isLoading = signal(false);
  public isVerifying = signal(true);
  public tokenValid = signal(false);
  public success = signal(false);
  public error = signal('');
  public showPassword = signal(false);
  public showConfirm = signal(false);

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.isVerifying.set(false);
      this.error.set('Invalid or missing reset link. Please request a new one.');
      return;
    }
    this.authService.verifyResetToken(this.token).subscribe({
      next: (res) => {
        this.isVerifying.set(false);
        this.tokenValid.set(res.success);
        if (!res.success) {
          this.error.set(res.error || 'This reset link is invalid or has expired.');
        }
      },
      error: () => {
        this.isVerifying.set(false);
        this.error.set('This reset link is invalid or has expired.');
      }
    });
  }

  public toggleShowPassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  public toggleShowConfirm(): void {
    this.showConfirm.set(!this.showConfirm());
  }

  public handleSubmit(): void {
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
    this.error.set('');
    this.isLoading.set(true);
    this.authService.resetPasswordWithToken(this.token, this.newPassword).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success) {
          this.success.set(true);
          setTimeout(() => {
            this.router.navigate(['/login'], { queryParams: { role: 'student' } });
          }, 2500);
        } else {
          this.error.set(res.error || 'Password reset failed. Please try again.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err?.error?.error || 'Password reset failed. Please try again.');
      }
    });
  }

  public goToForgot(): void {
    this.router.navigate(['/forgot-password']);
  }
}
