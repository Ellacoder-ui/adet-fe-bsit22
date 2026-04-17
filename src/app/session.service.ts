import { Injectable, signal } from '@angular/core';

export interface ServiceOption {
  id: string;
  label: string;
  icon: string;
}

const SERVICE_OPTIONS: ServiceOption[] = [
  { id: '1', label: 'Tuition', icon: '$' },
  { id: '2', label: 'SOA', icon: 'S' },
  { id: '3', label: 'Promissory', icon: 'P' },
  { id: '4', label: 'Refund', icon: 'R' },
  { id: '5', label: 'Adjustment', icon: 'A' }
];

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  public role = signal<'student' | 'staff'>('student');
  public userId = signal<number | null>(null);
  public studentId = signal<number | null>(null);
  public cashierId = signal<number | null>(null);
  public assignedCounter = signal<number | null>(null);
  public email = signal('');
  public fullName = signal('');
  public selectedService = signal<ServiceOption | null>(null);
  public assignedNumber = signal<number | null>(null);
  public currentServingNumber = signal<number | null>(null);
  public queueId = signal<number | null>(null);
  public queuePosition = signal<number | null>(null);
  public warning = signal('');

  public readonly serviceOptions = SERVICE_OPTIONS;

  public reset(): void {
    this.role.set('student');
    this.userId.set(null);
    this.studentId.set(null);
    this.cashierId.set(null);
    this.assignedCounter.set(null);
    this.email.set('');
    this.fullName.set('');
    this.selectedService.set(null);
    this.assignedNumber.set(null);
    this.currentServingNumber.set(null);
    this.queueId.set(null);
    this.queuePosition.set(null);
    this.warning.set('');
  }

  public setRole(role: 'student' | 'staff'): void {
    this.role.set(role);
    this.warning.set('');
  }

  public setAuthUser(data: {
    userId: number;
    role: 'student' | 'staff';
    email: string;
    studentId?: number;
    cashierId?: number;
    assignedCounter?: number | null;
    fullName?: string;
  }): void {
    this.userId.set(data.userId);
    this.role.set(data.role);
    this.email.set(data.email);
    this.studentId.set(data.studentId ?? null);
    this.cashierId.set(data.cashierId ?? null);
    this.assignedCounter.set(data.assignedCounter ?? null);
    this.fullName.set(data.fullName ?? '');
  }

  public setSelectedService(serviceId: string): void {
    const option = SERVICE_OPTIONS.find((item) => item.id === serviceId);
    if (!option) {
      return;
    }
    this.selectedService.set(option);
  }

  public clearSelectedService(): void {
    this.selectedService.set(null);
  }

  public setActiveQueue(data: {
    queueId?: number | null;
    queueNumber?: number | null;
    counterId?: number | null;
    position?: number | null;
    currentServingNumber?: number | null;
  }): void {
    this.queueId.set(data.queueId ?? null);
    this.assignedNumber.set(data.queueNumber ?? null);
    this.assignedCounter.set(data.counterId ?? this.assignedCounter());
    this.queuePosition.set(data.position ?? null);
    this.currentServingNumber.set(data.currentServingNumber ?? this.currentServingNumber());
  }
}
