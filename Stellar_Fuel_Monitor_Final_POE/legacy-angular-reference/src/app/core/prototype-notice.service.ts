import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PrototypeNoticeService {
  readonly visible = signal(false);
  readonly message = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  show(feature: string): void {
    if (this.timer) clearTimeout(this.timer);
    this.message.set(`${feature} is in development. The prototype remains available and no data has been changed.`);
    this.visible.set(true);
    this.timer = setTimeout(() => this.visible.set(false), 3600);
  }

  close(): void {
    if (this.timer) clearTimeout(this.timer);
    this.visible.set(false);
  }
}
