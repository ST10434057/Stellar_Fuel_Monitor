import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MockDataService } from '../../core/mock-data.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { IconComponent } from '../../shared/icon.component';

@Component({selector:'app-profile',standalone:true,imports:[CommonModule,PageHeaderComponent,IconComponent],template:`
<app-page-header title="My Profile" breadcrumb="account / profile" icon="user"></app-page-header>
<section class="profile-summary content-card">
 <div class="profile-main"><div class="vehicle-avatar"><app-icon name="user"></app-icon></div><div><span class="eyebrow">STELLAR FUEL INTELLIGENCE</span><h2>{{username}}</h2><p>Analytics prototype user</p></div></div>
 <div class="summary-kpis"><div><span>API</span><strong>{{data.backendOnline?'Connected':'Offline'}}</strong></div><div><span>Data source</span><strong>{{data.health?.source||'—'}}</strong></div><div><span>Dataset</span><strong>{{data.health?.dataset?.datasetDate||'—'}}</strong></div><div><span>Latest fuel day</span><strong>{{data.health?.fleet?.latestCompleteDate||'—'}}</strong></div></div>
</section>
<section class="two-column-section"><article class="content-card"><div class="section-title"><div><h2>Session</h2><p>Prototype account details stored only in this browser session.</p></div></div><div class="detail-list"><div><span>Username</span><strong>{{username}}</strong></div><div><span>Database</span><strong>{{data.health?.databaseName||'stellar_fuel_monitoring'}}</strong></div><div><span>Last API sync</span><strong>{{data.lastSync}}</strong></div><div><span>Feature version</span><strong>{{data.health?.featureVersion||'—'}}</strong></div></div></article><article class="content-card"><div class="section-title"><div><h2>Quick actions</h2><p>Jump straight back into the live investigation workflow.</p></div></div><div class="profile-actions"><button class="primary-btn" (click)="router.navigate(['/app/alerts'])">Open Alerts</button><button class="secondary-btn" (click)="router.navigate(['/app/analytics'])">Open Trip Analytics</button><button class="secondary-btn" (click)="router.navigate(['/app/reports'])">Open Reports</button><button class="secondary-btn" (click)="logout()">Log Out</button></div></article></section>
`,styles:[`.profile-actions{display:grid;gap:10px}.profile-actions button{width:100%}`]})
export class ProfileComponent{
 username=localStorage.getItem('stellarPrototypeUser')||'matteo';
 constructor(public data:MockDataService,public router:Router){void this.data.refreshHealth();}
 logout(){localStorage.removeItem('stellarPrototypeUser');this.router.navigate(['/login']);}
}
