import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { Queue, QueueService } from '../services/queue.service';
import { Service, ServiceService } from '../services/service.service';
import { WebsocketService } from '../services/websocket.service';
import { SessionService } from '../session.service';

@Component({
  selector: 'app-queue',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: x,
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
  public nowServingByService = signal<Record<string, number | null>>({});
  public isLoading = signal(false);
  public currentQueueStatus = signal<Queue['status'] | null>(null);
  /**
   * Persistent record of every queue number ever issued, keyed by service_id.
   * Entries are only ever ADDED or STATUS-UPDATED — never removed.
   * This guarantees numbers remain visible even after staff calls Next or
   * after polling returns an empty list.
   */
  public issuedQueuesByService = signal<Record<string, Array<{ number: number; status: string }>>>({});
  private serviceCounters: Record<string, number> = {};

  private pollingSub: Subscription | null = null;
  private wsSub: Subscription | null = null;

  constructor(
    public session: SessionService,
    private router: Router,
    private queueService: QueueService,
    private serviceService: ServiceService,
    private wsService: WebsocketService
  ) {}

  ngOnInit(): void {
    if (!this.session.userId()) {
      this.router.navigate(['/']);
      return;
    }

    this.loadServices();
    this.restoreCountersFromStorage();
    this.refreshQueueState();
    this.startPolling();
    this.wsService.connect();
    this.wsSub = this.wsService.messages$.subscribe(msg => this.handleWsMessage(msg));
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.wsSub?.unsubscribe();
    this.wsService.disconnect();
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
    if (this.isStaff) {
      // For staff, ONLY use the per-service map — never fall back to the shared
      // session value, which would bleed one service's counter into another.
      const selectedId = this.selectedServiceId;
      return selectedId ? (this.nowServingByService()[selectedId] ?? null) : null;
    }
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

  public get selectedServiceId(): string | null {
    return this.selectedService?.id ?? null;
  }

  public get canConfirmSelection() {
    return !this.isStaff && !!this.pendingService() && !this.isLoading() && this.currentQueueStatus() !== 'waiting';
  }

  public get showStudentQueueSummary() {
    return !this.isStaff && !!this.assignedNumber;
  }

  public nowServingForService(serviceId: number | string): number | null {
    return this.nowServingByService()[String(serviceId)] ?? null;
  }

  public servingQueue = computed(() => {
    return this.counterQueues().find((q) => this.matchesSelectedService(q) && q.status === 'serving') ?? null;
  });

  public waitingQueues = computed(() => {
    return this.counterQueues().filter((q) => this.matchesSelectedService(q) && q.status === 'waiting');
  });

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
    if (this.isStaff) {
      this.session.setSelectedService(serviceId);
      this.warning.set('');
      this.successMessage.set(`Selected ${this.queueTitle}.`);
      this.refreshQueueState();
      return;
    }

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
    // Seed from highest known number so offline counter never resets to 1.
    const highest = this.getHighestIssuedNumber(serviceId) ?? 0;
    this.serviceCounters[serviceId] = Math.max(this.serviceCounters[serviceId] ?? 0, highest);
    this.serviceCounters[serviceId]++;
    const queueNumber = this.serviceCounters[serviceId];

    this.session.setSelectedService(serviceId);
    this.session.setActiveQueue({
      queueId: queueNumber,
      queueNumber: queueNumber,
      counterId: this.session.assignedCounter() ?? 1,
      position: queueNumber
    });
    // Persist so the number survives subsequent poll/ws updates.
    this.addToIssuedQueue(serviceId, queueNumber, 'waiting');
    this.confirmed.set(true);
      // Persist confirmed flag so it survives page reloads.
      localStorage.setItem('qjump_student_confirmed', '1');
      localStorage.setItem('qjump_student_service', serviceId);
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
    this.clearStudentStorage();
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
      this.wsSub?.unsubscribe();
      this.wsService.disconnect();
      this.clearStudentStorage();
      this.session.reset();
      this.router.navigate(['/']);
    } else {
      this.closeLogoutConfirm();
    }
  }

  public nextNumber() {
    if (!this.isStaff) {
      return;
    }

    const selectedServiceId = this.selectedServiceId;
    if (!selectedServiceId) {
      this.warning.set('Please select your assigned service before calling next queue.');
      return;
    }

    const counter = this.getCounterLabelByServiceId(selectedServiceId);
    if (!counter) {
      this.warning.set('Unable to resolve selected service counter.');
      return;
    }

    // Optimistically advance to keep the queue flow continuous on the UI/monitor.
    // Only the targeted service entry in nowServingByService is modified — other
    // services are completely untouched.
    const predicted = this.getNextSequentialNumber();
    this.setNowServingForService(selectedServiceId, predicted);
    // Do NOT write to session.currentServingNumber here — that is shared state and
    // would bleed this service's counter into other services' views.
    this.successMessage.set(`${this.queueTitle}: now serving #${this.formatQueueNumber(predicted)}.`);

    this.queueService.callNext(counter).subscribe({
      next: (result: any) => {
        const raw = result?.queue_number ?? result?.queueNumber ?? result;
        const resolved = this.parseQueueNumber(raw) ?? predicted;
        if (resolved != null && selectedServiceId) {
          // Only update this service's slot.
          this.setNowServingForService(selectedServiceId, resolved);
        }
        this.successMessage.set(`${this.queueTitle}: now serving #${this.formatQueueNumber(resolved)}.`);
        this.refreshQueueState();
      },
      error: (error: any) => {
        this.refreshQueueState();
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
        const sid = String(serviceId);
        // Manual reset is the only allowed destructive path.
        this.setNowServingForService(sid, null);
        this.issuedQueuesByService.update(current => ({
          ...current,
          [sid]: []
        }));
        localStorage.removeItem(`qjump_counter_${sid}`);
        this.persistIssuedQueues();
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

  private handleWsMessage(msg: any): void {
    // now_serving: a counter called the next number
    if (msg.type === 'now_serving' || msg.type === 'queue_update') {
      const servingNumber = this.parseQueueNumber(msg.nowServing ?? msg.serving ?? msg.queueNumber ?? null);
      const serviceIdFromMessage = this.resolveServiceIdFromMessage(msg);

      if (serviceIdFromMessage && servingNumber != null) {
        // Update only the specific service's slot — never touches other services.
        this.setNowServingForService(serviceIdFromMessage, servingNumber);
      }

      // Students rely on session.currentServingNumber for their view.
      // Staff rely exclusively on nowServingByService, so we skip the global
      // session write for them to prevent cross-service contamination.
      if (!this.isStaff && servingNumber != null && this.messageMatchesSelectedService(msg)) {
        this.session.setActiveQueue({ currentServingNumber: servingNumber });
      }

      // If the backend sends a waiting list, update counterQueues for staff view
      if (Array.isArray(msg.waiting)) {
        const asQueues = msg.waiting.map((item: any) => ({
          queue_id: item.id ?? 0,
          student_id: 0,
          service_id: Number(item.service_id ?? item.serviceId ?? 0),
          counter_id: 0,
          queue_number: item.queueNumber ?? item.number ?? item,
          status: 'waiting' as const,
          service_name: item.service_name ?? item.serviceName,
          created_at: ''
        }));
        this.counterQueues.set(asQueues);
      }

      // Keep staff queue panel and monitor in sync right after websocket updates.
      if (this.isStaff) {
        this.refreshQueueState();
      }
    }
  }

  private loadServices(): void {
    const fallbackServices = [
      { service_id: 1, name: 'Request Statement of Account (SOA)' },
      { service_id: 2, name: 'Tuition & fees' },
      { service_id: 3, name: 'Promissory Notes' },
      { service_id: 4, name: 'Inquiries' }
    ] as Service[];

    this.serviceService.getAllServices().subscribe({
      next: (services) => {
        const source = services.length ? services : fallbackServices;
        this.services.set(source);
        const baseline: Record<string, number | null> = {};
        source.forEach((service) => {
          baseline[String(service.service_id)] = null;
        });
        this.nowServingByService.set(baseline);
        // Seed issued-queues map for any service not yet seen — never overwrite.
        this.issuedQueuesByService.update(current => {
          const seeded = { ...current };
          source.forEach(s => {
            if (!seeded[String(s.service_id)]) seeded[String(s.service_id)] = [];
          });
          return seeded;
        });
        if (this.isStaff && !this.selectedServiceId && source.length) {
          this.session.setSelectedService(String(source[0].service_id));
        }
      },
      error: () => {
        this.services.set(fallbackServices);
        const baseline: Record<string, number | null> = {};
        fallbackServices.forEach((service) => {
          baseline[String(service.service_id)] = null;
        });
        this.nowServingByService.set(baseline);
        this.issuedQueuesByService.update(current => {
          const seeded = { ...current };
          fallbackServices.forEach(s => {
            if (!seeded[String(s.service_id)]) seeded[String(s.service_id)] = [];
          });
          return seeded;
        });
        if (this.isStaff && !this.selectedServiceId) {
          this.session.setSelectedService(String(fallbackServices[0].service_id));
        }
      }
    });
  }

  private createQueueTicket(serviceId: string): void {
    // Map service ID to counter name for the backend
    const serviceMap: Record<string, string> = {
      '1': 'SOA',
      '2': 'Cashier',
      '3': 'Promissory',
      '4': 'Inquiries'
    };
    const counter = serviceMap[serviceId] ?? 'Cashier';

    this.isLoading.set(true);
    this.queueService.getQueueNumber(counter).subscribe({
      next: (entry: any) => {
        const num = Number(entry?.queueNumber) || 0;
        this.currentQueueStatus.set('waiting');
        this.session.setActiveQueue({
          queueId: 0,
          queueNumber: num,
          counterId: 0,
          position: 0
        });
        // Persist the issued number so it survives staff Next clicks and poll cycles.
        this.addToIssuedQueue(serviceId, num, 'waiting');
        this.successMessage.set(`Queue #${entry.queueNumber} created. Please wait for your number to be called.`);
          localStorage.setItem('qjump_student_confirmed', '1');
          localStorage.setItem('qjump_student_service', serviceId);
        this.warning.set('');
        this.refreshQueueState();
      },
      error: (error: any) => {
        this.warning.set(error?.error?.message || error?.message || 'Failed to create queue.');
      },
      complete: () => this.isLoading.set(false)
    });
  }

  private refreshQueueState(): void {
    if (this.isStaff) {
      const counter = this.assignedCounter ?? 0;
      this.queueService.getQueuesByCounter(counter).subscribe({
        next: (queues) => {
          this.counterQueues.set(queues);
          // Rebuild per-service now-serving map from the full queue list.
          // This is the only write path for staff "now serving" state —
          // we deliberately avoid touching session.currentServingNumber so
          // that switching between services never carries over a stale counter.
          this.rebuildNowServingByService(queues);
        },
        error: (error) => {
          this.warning.set(error.message || 'Failed to refresh counter queues.');
        }
      });
      return;
    }

    // For students — fetch current queue via JWT (no studentId needed)
    this.queueService.getCurrentQueue().subscribe({
      next: (activeQueue) => {
        if (!activeQueue) {
          this.currentQueueStatus.set(null);
          // If the student already has a confirmed ticket, preserve it — the
          // backend returning null just means the transaction is done or the
          // session expired, but the number should remain visible to them.
          if (!this.confirmed()) {
            this.session.clearSelectedService();
            this.session.setActiveQueue({
              queueId: null,
              queueNumber: null,
              counterId: null,
              position: null,
              currentServingNumber: null
            });
          }
          return;
        }

        const statusMap: Record<string, Queue['status']> = {
          called: 'serving',
          served: 'done',
          missed: 'skipped'
        };
        const mappedStatus = (statusMap[activeQueue.status] ?? activeQueue.status) as Queue['status'];
        this.currentQueueStatus.set(mappedStatus);

        const queueNum = Number(activeQueue.queueNumber) || 0;

        // If the student already has a confirmed local ticket, NEVER overwrite
        // their assignedNumber with data from the backend poll. The local ticket
        // is the source of truth for display; the backend may return a different
        // or zero value because the ticket was registered offline.
        if (!this.confirmed() && queueNum > 0) {
          this.session.setActiveQueue({
            queueId: 0,
            queueNumber: queueNum,
            counterId: 0,
            position: 0
          });
        }

        // Sync the student's own ticket status in the issued-numbers record.
        const sid = this.selectedServiceId;
        if (sid && queueNum) {
          this.addToIssuedQueue(sid, queueNum, mappedStatus);
        }
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

  private clearStudentStorage(): void {
    localStorage.removeItem('qjump_student_confirmed');
    localStorage.removeItem('qjump_student_service');
  }

  private getCounterLabelByServiceId(serviceId: string): string | null {
    const service = this.services().find((item) => String(item.service_id) === serviceId);
    if (!service?.name) {
      return null;
    }

    const lower = service.name.toLowerCase();
    if (lower.includes('statement') || lower.includes('soa')) return 'SOA';
    if (lower.includes('tuition') || lower.includes('fee') || lower.includes('cash')) return 'Cashier';
    if (lower.includes('promissory')) return 'Promissory';
    if (lower.includes('inquir')) return 'Inquiries';
    return service.name;
  }

  private getServiceIdByCounterLabel(counterLabel: string): string | null {
    const normalized = counterLabel.toLowerCase();
    const directByName = this.services().find((service) => service.name.toLowerCase().includes(normalized));
    if (directByName) {
      return String(directByName.service_id);
    }

    const byCounter = this.services().find((service) => {
      const mapped = this.getCounterLabelByServiceId(String(service.service_id));
      return !!mapped && mapped.toLowerCase() === normalized;
    });

    return byCounter ? String(byCounter.service_id) : null;
  }

  private setNowServingForService(serviceId: string, value: number | null): void {
    this.nowServingByService.update((current) => ({
      ...current,
      [serviceId]: value
    }));
  }

  private rebuildNowServingByService(queues: Queue[]): void {
    // Start from current values to keep queue-summary stable between polls.
    // This prevents the UI from dropping to '-' when a poll response is
    // temporarily empty or missing a currently-serving item.
    const rebuilt: Record<string, number | null> = {
      ...this.nowServingByService()
    };

    this.services().forEach((service) => {
      const sid = String(service.service_id);
      if (!(sid in rebuilt)) {
        rebuilt[sid] = null;
      }
    });

    queues.forEach((queue) => {
      if (queue.status !== 'serving') {
        return;
      }

      const serviceId = this.resolveServiceIdFromQueue(queue);
      if (!serviceId) {
        return;
      }

      const queueNumber = this.parseQueueNumber(queue.queue_number);
      if (queueNumber == null) {
        return;
      }

      rebuilt[serviceId] = queueNumber;
    });

    this.nowServingByService.set(rebuilt);

    // Keep the persistent issued-numbers record up to date with the latest
    // statuses from the backend without ever removing any entry.
    this.syncIssuedQueueStatuses(queues);
  }

  private resolveServiceIdFromQueue(queue: Queue): string | null {
    if (queue.service_id) {
      return String(queue.service_id);
    }

    if (queue.service_name) {
      const serviceName = queue.service_name.toLowerCase();
      const matched = this.services().find((service) => serviceName.includes(service.name.toLowerCase()));
      return matched ? String(matched.service_id) : null;
    }

    return null;
  }

  private resolveServiceIdFromMessage(msg: any): string | null {
    if (msg.service_id || msg.serviceId) {
      return String(msg.service_id ?? msg.serviceId);
    }

    const rawLabel = String(msg.counter ?? msg.counterName ?? msg.service ?? '').trim();
    if (!rawLabel) {
      return null;
    }

    return this.getServiceIdByCounterLabel(rawLabel);
  }

  private getNextSequentialNumber(): number {
    const selectedId = this.selectedServiceId;

    // Prefer the dedicated per-service map so switching between services never
    // inherits another service's counter.
    if (selectedId) {
      const serviceNowServing = this.nowServingByService()[selectedId];
      if (serviceNowServing != null) {
        return serviceNowServing + 1;
      }
    }

    const currentlyServing = this.parseQueueNumber(this.servingQueue()?.queue_number);
    if (currentlyServing != null) {
      return currentlyServing + 1;
    }

    const waiting = this.waitingQueues();
    if (waiting.length > 0) {
      const firstWaiting = this.parseQueueNumber(waiting[0].queue_number);
      if (firstWaiting != null) {
        return firstWaiting;
      }
    }

    // Never reset to 1. Always continue from the highest number ever issued
    // for this service (in-memory or localStorage) so the sequence is
    // retained even when nothing is currently serving or waiting.
    const highest = selectedId ? this.getHighestIssuedNumber(selectedId) : null;
    return (highest ?? 0) + 1;
  }

  public formatQueueNumber(value: unknown): string {
    const parsed = this.parseQueueNumber(value);
    if (parsed == null) {
      return '-';
    }

    return String(parsed).padStart(3, '0');
  }

  private parseQueueNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.trunc(value));
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const cleaned = value.replace(/[^0-9]/g, '');
      if (!cleaned) {
        return null;
      }

      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
    }

    return null;
  }

  private matchesSelectedService(queue: Queue): boolean {
    if (!this.isStaff) {
      return true;
    }

    const selectedId = this.selectedServiceId;
    if (!selectedId) {
      return true;
    }

    if (String(queue.service_id) === selectedId) {
      return true;
    }

    const selected = this.services().find((service) => String(service.service_id) === selectedId);
    const selectedName = selected?.name?.toLowerCase();
    const queueServiceName = queue.service_name?.toLowerCase();
    return !!selectedName && !!queueServiceName && queueServiceName.includes(selectedName);
  }

  private messageMatchesSelectedService(msg: any): boolean {
    if (!this.isStaff) {
      return true;
    }

    const selectedId = this.selectedServiceId;
    if (!selectedId) {
      return true;
    }

    const expectedCounter = this.getCounterLabelByServiceId(selectedId)?.toLowerCase();
    const messageCounter = String(msg.counter ?? msg.counterName ?? msg.service ?? '').toLowerCase();

    if (!expectedCounter || !messageCounter) {
      return true;
    }

    return messageCounter.includes(expectedCounter);
  }

  // ── Issued-queue history helpers ─────────────────────────────────────────

  /**
   * On init: read every qjump_counter_* key from localStorage and seed the
   * in-memory issuedQueuesByService signal so getHighestIssuedNumber() has
   * data available immediately without waiting for a backend poll.
   * Only seeds entries that aren't already present in the signal.
   */
  private restoreCountersFromStorage(): void {
    // ── 1. Restore full issued-queues list from localStorage ──────────────
    // This is the primary restore path; it contains every number ever issued
    // with its status. The per-service counter keys are kept as a lighter
    // fallback for the sequential-number logic.
    const savedQueues = localStorage.getItem('qjump_issued_queues');
    if (savedQueues) {
      try {
        const parsed: Record<string, Array<{ number: number; status: string }>> = JSON.parse(savedQueues);
        this.issuedQueuesByService.update(current => {
          const merged = { ...current };
          Object.entries(parsed).forEach(([sid, entries]) => {
            if (!Array.isArray(entries)) return;
            const existing = merged[sid] ?? [];
            const existingNums = new Set(existing.map(e => e.number));
            const toAdd = entries.filter(e => !existingNums.has(e.number));
            merged[sid] = [...existing, ...toAdd];
          });
          return merged;
        });
      } catch { /* corrupt data – ignore */ }
    }

    // ── 2. Restore student confirmed state ───────────────────────────────
    // If the student had a confirmed ticket before page reload, re-apply it
    // so the queue-ticket-panel stays visible and assignedNumber is restored.
    if (!this.isStaff && localStorage.getItem('qjump_student_confirmed') === '1') {
      const savedService = localStorage.getItem('qjump_student_service');
      if (savedService) {
        this.session.setSelectedService(savedService);
        // Restore the assigned number from the issued list.
        const highest = this.getHighestIssuedNumber(savedService);
        if (highest && highest > 0) {
          this.session.setActiveQueue({ queueNumber: highest });
        }
      }
      this.confirmed.set(true);
    }

    // ── 3. Seed per-service counter fallback from qjump_counter_* keys ───
    const prefix = 'qjump_counter_';
    const restored: Record<string, number> = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const serviceId = key.slice(prefix.length);
      const n = parseInt(localStorage.getItem(key) ?? '0', 10);
      if (Number.isFinite(n) && n > 0) restored[serviceId] = n;
    }

    this.issuedQueuesByService.update(current => {
      const updated = { ...current };
      Object.entries(restored).forEach(([sid, highest]) => {
        // Only seed a placeholder if we have no history at all for this service.
        if (!updated[sid] || updated[sid].length === 0) {
          updated[sid] = [{ number: highest, status: 'unknown' }];
        }
      });
      return updated;
    });

    // Also initialise nowServingByService entries so the service map is aware
    // of these service IDs before loadServices() resolves.
    this.nowServingByService.update(current => {
      const updated = { ...current };
      Object.keys(restored).forEach(sid => {
        if (!(sid in updated)) updated[sid] = null;
      });
      return updated;
    });
  }

  /**
   * Returns the highest queue number ever issued for a service.
   * Checks the in-memory signal first, then falls back to localStorage so the
   * sequence survives page reloads. Never returns a value less than 0.
   */
  private getHighestIssuedNumber(serviceId: string): number | null {
    const list = this.issuedQueuesByService()[serviceId] ?? [];
    if (list.length > 0) {
      return Math.max(...list.map(e => e.number));
    }
    const stored = localStorage.getItem(`qjump_counter_${serviceId}`);
    if (stored) {
      const n = parseInt(stored, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }

  /** Return all issued numbers for a service, sorted ascending. */
  public issuedQueuesForService(serviceId: number | string | null): Array<{ number: number; status: string }> {
    if (serviceId == null) return [];
    const list = this.issuedQueuesByService()[String(serviceId)] ?? [];
    return [...list].sort((a, b) => a.number - b.number);
  }

  /**
   * Record a new queue number for a service.
   * If the number already exists the call is a no-op.
   * Always persists the highest seen number to localStorage so the sequence
   * is never lost across page reloads.
   */
  private addToIssuedQueue(serviceId: string, number: number, status: string): void {
    this.issuedQueuesByService.update(current => {
      const existing = current[serviceId] ?? [];
      if (existing.some(e => e.number === number)) return current;
      return { ...current, [serviceId]: [...existing, { number, status }] };
    });
    // Persist the full list AND the highest number so both the display history
    // and the sequential counter survive page reloads.
    const currentMax = parseInt(localStorage.getItem(`qjump_counter_${serviceId}`) ?? '0', 10);
    if (number > (Number.isFinite(currentMax) ? currentMax : 0)) {
      localStorage.setItem(`qjump_counter_${serviceId}`, String(number));
    }
    this.persistIssuedQueues();
  }

  /**
   * Merge a full queue snapshot from the backend into the issued-numbers record.
   * New numbers are appended; existing numbers only have their status updated.
   * No entry is ever deleted.
   */
  private syncIssuedQueueStatuses(queues: Queue[]): void {
    this.issuedQueuesByService.update(current => {
      const updated: Record<string, Array<{ number: number; status: string }>> = { ...current };

      queues.forEach(q => {
        const sid = this.resolveServiceIdFromQueue(q);
        if (!sid) return;
        const num = this.parseQueueNumber(q.queue_number);
        if (num == null) return;

        if (!updated[sid]) updated[sid] = [];

        const idx = updated[sid].findIndex(e => e.number === num);
        if (idx >= 0) {
          // Update status in place — keep the rest of the array intact.
          const copy = [...updated[sid]];
          copy[idx] = { ...copy[idx], status: q.status };
          updated[sid] = copy;
        } else {
          updated[sid] = [...updated[sid], { number: num, status: q.status }];
          // Persist to localStorage so the counter survives page reloads.
          const currentMax = parseInt(localStorage.getItem(`qjump_counter_${sid}`) ?? '0', 10);
          if (num > (Number.isFinite(currentMax) ? currentMax : 0)) {
            localStorage.setItem(`qjump_counter_${sid}`, String(num));
          }
        }
      });

      return updated;
    });
    this.persistIssuedQueues();
  }

  /** Write the full issued-queues map to localStorage so it survives reloads. */
  private persistIssuedQueues(): void {
    try {
      localStorage.setItem('qjump_issued_queues', JSON.stringify(this.issuedQueuesByService()));
    } catch { /* quota exceeded – ignore */ }
  }
}
