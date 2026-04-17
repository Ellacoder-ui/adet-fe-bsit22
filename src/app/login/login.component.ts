import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../session.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private session = inject(SessionService);
  private authService = inject(AuthService);

  public role = signal<'student' | 'staff'>('student');
  public roleLabel = signal('Student');
  public email = '';
  public password = '';
  public warning = signal('');
  public isLoading = signal(false);

  ngOnInit(): void {
    const roleParam = this.route.snapshot.queryParamMap.get('role')?.toLowerCase() || 'student';
    const normalizedRole = roleParam === 'staff' ? 'staff' : 'student';
    this.role.set(normalizedRole);
    this.roleLabel.set(normalizedRole === 'staff' ? 'Staff / Cashier' : 'Student');
    this.session.setRole(normalizedRole);
  }

  public get emailLabel() {
    return 'LDCU Email';
  }

  public get passwordLabel() {
    return 'Password';
  }

  public get emailPlaceholder() {
    return this.role() === 'staff' ? 'example@liceo.edu.ph' : 'yourname@liceo.edu.ph';
  }

  public get passwordPlaceholder() {
    return 'Enter your password';
  }

  public get fullEmail(): string {
    const raw = this.email.trim().toLowerCase();
    if (!raw) return '';
    if (raw.includes('@')) return raw;
    return `${raw}@liceo.edu.ph`;
  }

  public handleSubmitClicked(): void {
    if (!this.email.trim() || !this.password.trim()) {
      this.warning.set('The information you entered is incomplete');
      return;
    }

    this.isLoading.set(true);
    this.warning.set('');

    // DEV BYPASS: accept any credentials
    const emailValue = this.fullEmail || this.email.trim();
    const currentRole = this.role();
    this.session.setAuthUser({
      userId: 1,
      role: currentRole,
      email: emailValue,
      cashierId: currentRole === 'staff' ? 1 : undefined,
      assignedCounter: currentRole === 'staff' ? 1 : null,
      fullName: emailValue.split('@')[0]
    });
    this.isLoading.set(false);
    this.router.navigate(['/queue']);
  }
}
