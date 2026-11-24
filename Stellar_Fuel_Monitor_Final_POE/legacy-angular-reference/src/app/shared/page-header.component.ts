import { Component, Input } from '@angular/core';
import { Location } from '@angular/common';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [IconComponent],
  template: `
    <section class="page-heading">
      <div class="page-title-wrap">
        <div class="page-title-icon"><app-icon [name]="icon"></app-icon></div>
        <div>
          <h1>{{ title }}</h1>
          <div class="breadcrumbs">home <span>\\</span> {{ breadcrumb || title.toLowerCase() }} <span>\\</span></div>
        </div>
      </div>
      @if (showBack) {
        <button class="outline-back" type="button" (click)="back()"><app-icon name="back"></app-icon> Back</button>
      }
    </section>
  `
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() breadcrumb = '';
  @Input() icon = 'file';
  @Input() showBack = true;

  constructor(private location: Location) {}
  back(): void { this.location.back(); }
}
