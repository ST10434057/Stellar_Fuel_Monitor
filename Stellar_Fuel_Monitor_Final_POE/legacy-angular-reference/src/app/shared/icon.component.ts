import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="app-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (name) {
        @case ('menu') { <path d="M4 6h16M4 12h16M4 18h16"/> }
        @case ('home') { <path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/> }
        @case ('truck') { <path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/> }
        @case ('fuel') { <path d="M6 3h8v18H6z"/><path d="M8 7h4"/><path d="M14 8h2l2 2v7a2 2 0 0 0 4 0v-5l-2-2"/> }
        @case ('alert') { <path d="M12 3 2.8 20h18.4L12 3z"/><path d="M12 9v5"/><path d="M12 17h.01"/> }
        @case ('report') { <path d="M5 3h14v18H5z"/><path d="M8 16v-3M12 16V8M16 16v-6"/> }
        @case ('user') { <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/> }
        @case ('users') { <circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 4a3 3 0 0 1 0 6"/><path d="M17 14a5 5 0 0 1 4 5"/> }
        @case ('gear') { <circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 3a7 7 0 0 0-1.7 1L5 6.1 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5l2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 3h5l.4-3a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.5a7 7 0 0 0 .1-1z"/> }
        @case ('search') { <circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/> }
        @case ('dashboard') { <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="14" width="7" height="7"/> }
        @case ('database') { <ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/> }
        @case ('sync') { <path d="M20 7h-5V2"/><path d="M20 7a8 8 0 0 0-13.8-2.2L4 7"/><path d="M4 17h5v5"/><path d="M4 17a8 8 0 0 0 13.8 2.2L20 17"/> }
        @case ('logout') { <path d="M9 5H5v14h4"/><path d="M14 8l4 4-4 4"/><path d="M18 12H9"/> }
        @case ('back') { <path d="m15 18-6-6 6-6"/> }
        @case ('chart') { <path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 4-4 3 2 5-6"/> }
        @case ('check') { <path d="m5 12 4 4L19 6"/> }
        @case ('close') { <path d="m6 6 12 12M18 6 6 18"/> }
        @case ('info') { <circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7h.01"/> }
        @case ('lock') { <rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/> }
        @case ('bell') { <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/> }
        @case ('file') { <path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5"/> }
        @case ('money') { <rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M7 10h.01M17 14h.01"/> }
        @default { <circle cx="12" cy="12" r="8"/> }
      }
    </svg>
  `,
  styles: [`.app-icon{width:1em;height:1em;display:block}`]
})
export class IconComponent {
  @Input() name = 'home';
}
