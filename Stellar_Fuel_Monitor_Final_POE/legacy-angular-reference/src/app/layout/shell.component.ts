import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { PrototypeNoticeService } from '../core/prototype-notice.service';
import { MockDataService } from '../core/mock-data.service';

interface NavItem { label: string; icon: string; route?: string; dev?: boolean; }

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="app-shell" [class.sidebar-collapsed]="collapsed">
      <header class="topbar">
        <div class="topbar-left">
          <button class="menu-btn" type="button" (click)="toggleSidebar()" aria-label="Toggle navigation">
            <app-icon name="menu"></app-icon>
          </button>
          <div class="brand-mini">
            <span class="brand-star">★</span>
            <div><strong>STELLAR</strong><small>TRANSPORT</small></div>
          </div>
        </div>
        <div class="topbar-right">
          <span class="prototype-pill">LIVE ANALYTICS PROTOTYPE</span>
          <button type="button" class="top-link" (click)="notice.show('Feedback')"><app-icon name="info"></app-icon><span>Feedback</span></button>
          <span class="top-user"><app-icon name="user"></app-icon> {{ username }}</span>
          <button type="button" class="top-link" (click)="logout()"><app-icon name="logout"></app-icon><span>Log Out</span></button>
        </div>
      </header>

      <aside class="sidebar" [class.mobile-open]="mobileOpen">
        <nav>
          @for (item of navItems; track item.label) {
            @if (item.route) {
              <a [routerLink]="item.route" routerLinkActive="active" (click)="mobileOpen=false">
                <app-icon [name]="item.icon"></app-icon><span>{{ item.label }}</span>
              </a>
            } @else {
              <button type="button" (click)="dev(item.label)">
                <app-icon [name]="item.icon"></app-icon><span>{{ item.label }}</span>
              </button>
            }
          }
        </nav>
        <div class="sidebar-footer">
          <small>dataset {{ data.health?.dataset?.datasetDate || 'loading…' }} · fuel through {{ data.health?.fleet?.latestCompleteDate || '—' }}</small>
        </div>
      </aside>

      <main class="main-content">
        <router-outlet></router-outlet>
      </main>

      @if (mobileOpen) { <button class="mobile-scrim" aria-label="Close navigation" (click)="mobileOpen=false"></button> }

      @if (notice.visible()) {
        <div class="prototype-toast" role="status">
          <div class="toast-icon"><app-icon name="info"></app-icon></div>
          <div><strong>Prototype notice</strong><p>{{ notice.message() }}</p></div>
          <button type="button" aria-label="Close notice" (click)="notice.close()"><app-icon name="close"></app-icon></button>
        </div>
      }
    </div>
  `
})
export class ShellComponent {
  collapsed = false;
  mobileOpen = false;

  readonly navItems: NavItem[] = [
    { label: 'Home', icon: 'home', route: '/app/home' },
    { label: 'Vehicle', icon: 'truck', route: '/app/vehicle' },
    { label: 'Fuel / Oil', icon: 'fuel', route: '/app/fuel-oil' },
    { label: 'Fuel History', icon: 'report', route: '/app/fuel-history' },
    { label: 'Trip Analytics', icon: 'chart', route: '/app/analytics' },
    { label: 'Alerts', icon: 'alert', route: '/app/alerts' },
    { label: 'Fleet Search', icon: 'search', route: '/app/fleet' },
    { label: 'Reports', icon: 'report', route: '/app/reports' },
    { label: 'Administration', icon: 'gear', route: '/app/admin' },
    { label: 'My Profile', icon: 'user', route: '/app/profile' }
  ];

  constructor(public notice: PrototypeNoticeService, private router: Router, public data: MockDataService) { void this.data.refreshHealth(); }

  get username(): string { return (localStorage.getItem('stellarPrototypeUser') || 'matteo').toUpperCase(); }

  toggleSidebar(): void {
    if (window.innerWidth < 900) this.mobileOpen = !this.mobileOpen;
    else this.collapsed = !this.collapsed;
  }

  dev(feature: string): void {
    this.mobileOpen = false;
    this.notice.show(feature);
  }

  logout(): void {
    localStorage.removeItem('stellarPrototypeUser');
    this.router.navigate(['/login']);
  }
}
