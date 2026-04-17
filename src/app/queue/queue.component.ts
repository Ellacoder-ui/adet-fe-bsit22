import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { Queue, QueueService } from '../services/queue.service';
import { Service, ServiceService } from '../services/service.service';
import { SessionService } from '../session.service';

@Component({
  selector: 'app-queue',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './queue.component.html',
  styleUrls: ['./queue.component.scss']
})
export class QueueComponent implements OnInit, OnDestroy {
  public showLogoutConfirm = signal(false);
  public showConfirmModal = signal(false);
  public confirmed = signal(false);
  public warning = signal('');
  public pendingService = signal<string | null>(null);
  public successMessage = signal('');
  public services = signal<Service[]>([]);
  public counterQueues = signal<Queue[]>([]);
  public isLoading = signal(false);
  public currentQueueStatus = signal<Queue['status'] | null>(null);
  private serviceCounters: Record<string, number> = {};

  private pollingSub: Subscription | null = null;

  constructor(
    public session: SessionService,
    private router: Router,
    private queueService: QueueService,
    private serviceService: ServiceService
  ) {}

  ngOnInit(): void {
    if (!this.session.userId()) {
      this.router.navigate(['/']);
      return;
    }

    this.loadServices();
    this.refreshQueueState();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

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

  public get queuePosition() {
    return this.session.queuePosition();
  }

  public get assignedCounter() {
    return this.session.assignedCounter();
  }

  public get displayNumber() {
    return this.isStaff ? this.currentNumber : this.assignedNumber;
  }

  public get isStaff() {
    return this.role === 'staff';
  }

  public get queueTitle() {
    if (!this.selectedService) {
      return 'Select a service';
    }
    const matched = this.services().find((service) => String(service.service_id) === this.selectedService?.id);
    return matched?.name || this.selectedService.label;
  }

  public get canConfirmSelection() {
    return !this.isStaff && !!this.pendingService() && !this.isLoading() && this.currentQueueStatus() !== 'waiting';
  }

  public get showStudentQueueSummary() {
    return !this.isStaff && !!this.assignedNumber;
  }

  public servingQueue = computed(() => this.counterQueues().find((q) => q.status === 'serving') ?? null);
  public waitingQueues = computed(() => this.counterQueues().filter((q) => q.status === 'waiting'));

  public asText(value: string | number): string {
    return String(value);
  }

  public getServiceIconType(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('tuition') || lower.includes('fee')) return 'tuition';
    if (lower.includes('statement') || lower.includes('soa') || lower.includes('account')) return 'soa';
    if (lower.includes('promissory') || lower.includes('note')) return 'promissory';
    if (lower.includes('inquir')) return 'inquiry';
    return 'default';
  }

  public selectService(serviceId: string) {
    if (this.isStaff) return;
    if (this.confirmed()) {
      this.warning.set('You can only choose one service only.');
      return;
    }
    this.pendingService.set(serviceId);
    this.showConfirmModal.set(true);
    this.warning.set('');
  }

  public openServiceConfirm() {
    if (!this.pendingService()) {
      this.warning.set('Please select a service first.');
      return;
    }
    this.showConfirmModal.set(true);
  }

  public handleServiceConfirm(choice: boolean) {
    this.showConfirmModal.set(false);
    if (!choice) {
      this.pendingService.set(null);
      return;
    }

    const serviceId = this.pendingService()!;
    if (!this.serviceCounters[serviceId]) {
      this.serviceCounters[serviceId] = 0;
    }
    this.serviceCounters[serviceId]++;
    const queueNumber = this.serviceCounters[serviceId];

    this.session.setSelectedService(serviceId);
    this.session.setActiveQueue({
      queueId: queueNumber,
      queueNumber: queueNumber,
      counterId: this.session.assignedCounter() ?? 1,
      position: queueNumber
    });
    this.confirmed.set(true);
    this.warning.set('');
  }

  public confirmService() {
    const serviceId = this.pendingService();
    if (!serviceId) {
      this.warning.set('Please choose a service before confirming.');
      return;
    }

    if (!this.isStaff && this.currentQueueStatus() === 'waiting') {
      this.warning.set('You cannot request another service while your queue is still waiting.');
      return;
    }

    this.session.setSelectedService(serviceId);
    if (!this.isStaff) {
      this.createQueueTicket(serviceId);
    }
    this.warning.set('');
    this.pendingService.set(null);
  }

  public cancelService() {
    this.pendingService.set(null);
    this.warning.set('');
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
      this.stopPolling();
      this.session.reset();
      this.router.navigate(['/']);
    } else {
      this.closeLogoutConfirm();
    }
  }

  public nextNumber() {
    if (!this.isStaff || !this.assignedCounter) {
      return;
    }

    this.queueService.callNext(this.assignedCounter, 'staff').subscribe({
      next: (queue) => {
        this.successMessage.set(queue ? `Now serving #${queue.queue_number}` : 'No waiting queue for this counter.');
        this.refreshQueueState();
      },
      error: (error) => {
        this.warning.set(error.message || 'Failed to call next queue.');
      }
    });
  }

  public resetServiceQueue(serviceId: number): void {
    if (!this.isStaff) {
      return;
    }

    this.queueService.resetServiceQueue(serviceId).subscribe({
      next: () => {
        this.successMessage.set(`Queue for service reset to 0.`);
        this.refreshQueueState();
      },
      error: (error) => {
        this.warning.set(error.message || 'Failed to reset queue.');
      }
    });
  }

  public updateQueueStatus(queueId: number, status: 'done' | 'skipped'): void {
    if (!this.isStaff) {
      return;
    }

    this.queueService.updateQueueStatus(queueId, status, 'staff').subscribe({
      next: () => {
        this.successMessage.set(`Queue marked as ${status}.`);
        this.refreshQueueState();
      },
      error: (error) => {
        this.warning.set(error.message || 'Failed to update queue status.');
      }
    });
  }

  private loadServices(): void {
    this.services.set([
      { service_id: 1, name: 'Request Statement of Account (SOA)' },
      { service_id: 2, name: 'Tuition & fees' },
      { service_id: 3, name: 'Promissory Notes' },
      { service_id: 4, name: 'Inquiries' }
    ] as Service[]);
  }

  private createQueueTicket(serviceId: string): void {
    const studentId = this.session.studentId();
    if (!studentId) {
      this.warning.set('Student profile is missing. Please login again.');
      return;
    }

    this.isLoading.set(true);
    this.queueService.createQueue({
      student_id: studentId,
      service_id: Number(serviceId),
      role: 'student'
    }).subscribe({
      next: (result) => {
        this.currentQueueStatus.set('waiting');
        this.session.setActiveQueue({
          queueId: result.queue_id,
          queueNumber: result.queue_number,
          counterId: result.counter_id,
          position: result.position
        });
        this.successMessage.set(`Queue #${result.queue_number} created. Please proceed to Counter ${result.counter_id}.`);
        this.warning.set('');
        this.refreshQueueState();
      },
      error: (error) => {
        this.warning.set(error.message || 'Failed to create queue.');
      },
      complete: () => this.isLoading.set(false)
    });
  }

  private refreshQueueState(): void {
    if (this.isStaff) {
      if (!this.assignedCounter) {
        this.warning.set('Staff account has no assigned counter.');
        return;
      }
      this.queueService.getQueuesByCounter(this.assignedCounter).subscribe({
        next: (queues) => {
          this.counterQueues.set(queues);
          const activeServing = queues.find((q) => q.status === 'serving');
          this.session.setActiveQueue({
            currentServingNumber: activeServing?.queue_number ?? null
          });
        },
        error: (error) => {
          this.warning.set(error.message || 'Failed to refresh counter queues.');
        }
      });
      return;
    }

    const studentId = this.session.studentId();
    if (!studentId) {
      return;
    }

    this.queueService.getQueuesByStudent(studentId).subscribe({
      next: (queues) => {
        const activeQueue = queues.find((q) => q.status === 'waiting' || q.status === 'serving');
        const latestQueue = queues[0] ?? null;

        this.currentQueueStatus.set((activeQueue?.status ?? latestQueue?.status ?? null) as Queue['status'] | null);

        if (!activeQueue) {
          this.session.clearSelectedService();
          this.session.setActiveQueue({
            queueId: null,
            queueNumber: null,
            counterId: null,
            position: null,
            currentServingNumber: null
          });
          return;
        }

        this.session.setSelectedService(String(activeQueue.service_id));
        this.session.setActiveQueue({
          queueId: activeQueue.queue_id,
          queueNumber: activeQueue.queue_number,
          counterId: activeQueue.counter_id,
          currentServingNumber: activeQueue.status === 'serving' ? activeQueue.queue_number : this.session.currentServingNumber()
        });
      }
    });
  }

  private startPolling(): void {
    this.pollingSub = interval(5000).subscribe(() => this.refreshQueueState());
  }

  private stopPolling(): void {
    this.pollingSub?.unsubscribe();
    this.pollingSub = null;
  }
}
