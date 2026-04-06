import { Injectable, signal } from '@angular/core';

export interface ServiceOption {
  id: 'tuition' | 'soa' | 'promissory' | 'inquiries';
  label: string;
  icon: string;
}

const SERVICE_OPTIONS: ServiceOption[] = [
  { id: 'tuition', label: 'Tuition & fees', icon: '$' },
  { id: 'soa', label: 'Request Statement of Account (SOA)', icon: 'S' },
  { id: 'promissory', label: 'Promissory Notes', icon: 'P' },
  { id: 'inquiries', label: 'Inquiries', icon: '?' }
];

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  public role = signal<'student' | 'staff'>('student');
  public fullName = signal('');
  public idNumber = signal('');
  public selectedService = signal<ServiceOption | null>(null);
  public assignedNumber = signal<number | null>(null);
  public currentServingNumber = signal<number | null>(null);
  public warning = signal('');

  private serviceTickets: Record<ServiceOption['id'], number> = {
    tuition: 0,
    soa: 0,
    promissory: 0,
    inquiries: 0
  };

  public readonly serviceOptions = SERVICE_OPTIONS;

  public reset(): void {
    this.role.set('student');
    this.fullName.set('');
    this.idNumber.set('');
    this.selectedService.set(null);
    this.assignedNumber.set(null);
    this.currentServingNumber.set(null);
    this.warning.set('');
    this.serviceTickets = {
      tuition: 0,
      soa: 0,
      promissory: 0,
      inquiries: 0
    };
  }

  public setRole(role: 'student' | 'staff'): void {
    this.role.set(role);
    this.selectedService.set(null);
    this.assignedNumber.set(null);
    this.currentServingNumber.set(null);
    this.warning.set('');
  }

  public setDetails(fullName: string, idNumber: string): void {
    this.fullName.set(fullName);
    this.idNumber.set(idNumber);
  }

  public selectService(serviceId: ServiceOption['id']): void {
    const option = SERVICE_OPTIONS.find((item) => item.id === serviceId);
    if (!option) {
      return;
    }

    this.selectedService.set(option);
    this.serviceTickets[serviceId] += 1;
    this.assignedNumber.set(this.serviceTickets[serviceId]);
    this.currentServingNumber.set(this.serviceTickets[serviceId]);
  }

  public nextNumber(): void {
    const current = this.currentServingNumber();
    if (current !== null) {
      this.currentServingNumber.set(current + 1);
    }
  }
}
