import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
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

  public role = signal<'student' | 'staff'>('student');
  public roleLabel = signal('Student');
  public email = signal('');
  public password = signal('');
  public warning = signal('');

  ngOnInit(): void {
    const roleParam = this.route.snapshot.queryParamMap.get('role')?.toLowerCase() || 'student';
    const normalizedRole = roleParam === 'staff' ? 'staff' : 'student';
    this.role.set(normalizedRole);
    this.roleLabel.set(normalizedRole === 'staff' ? 'Staff / Cashier' : 'Student');
    this.session.setRole(normalizedRole);
  }

  public get emailLabel() {
    return this.role() === 'staff' ? 'Login ID / Name' : 'Email';
  }

  public get passwordLabel() {
    return 'Password';
  }

  public get emailPlaceholder() {
    return this.role() === 'staff' ? 'Enter login ID or name' : 'Enter your email';
  }

  public get passwordPlaceholder() {
    return 'Enter your password';
  }

  public handleSubmitClicked(): void {
    if (!this.email().trim() || !this.password().trim()) {
      this.warning.set('The information you entered is incomplete');
      return;
    }

    this.session.setDetails(this.email().trim(), this.password().trim());
    this.warning.set('');
    this.router.navigate(['/queue']);
  }
}