import { Component, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SessionService } from '../session.service';

@Component({
  selector: 'app-queue',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './queue.component.html',
  styleUrls: ['./queue.component.scss']
})
export class QueueComponent {
  public showLogoutConfirm = signal(false);

  constructor(public session: SessionService, private router: Router) {}

  public get role() {
    return this.session.role();
  }

  public get selectedService() {
    return this.session.selectedService();
  }

  public get assignedNumber() {
    return this.session.assignedNumber();
  }

  public get currentNumber() {
    return this.session.currentServingNumber();
  }

  public get displayNumber() {
    return this.isStaff ? this.currentNumber : this.assignedNumber;
  }

  public get isStaff() {
    return this.role === 'staff';
  }

  public get queueTitle() {
    return this.selectedService ? this.selectedService.label : 'Select a service';
  }

  public selectService(serviceId: string) {
    this.session.selectService(serviceId as any);
  }

  public backToRoleSelection() {
    this.session.reset();
    this.router.navigate(['/']);
  }

  public openLogoutConfirm() {
    this.showLogoutConfirm.set(true);
  }

  public closeLogoutConfirm() {
    this.showLogoutConfirm.set(false);
  }

  public confirmLogout(choice: boolean) {
    if (choice) {
      this.session.reset();
      this.router.navigate(['/']);
    } else {
      this.closeLogoutConfirm();
    }
  }

  public nextNumber() {
    if (this.isStaff) {
      this.session.nextNumber();
    }
  }
}
