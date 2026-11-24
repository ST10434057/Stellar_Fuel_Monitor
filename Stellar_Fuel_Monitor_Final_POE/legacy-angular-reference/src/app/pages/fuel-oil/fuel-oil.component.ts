import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MockDataService } from '../../core/mock-data.service';
import { FuelTransaction } from '../../core/models';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { IconComponent } from '../../shared/icon.component';

@Component({
 selector:'app-fuel-oil',standalone:true,imports:[CommonModule,FormsModule,PageHeaderComponent,IconComponent],template:`
<app-page-header title="Fuel & Oil" breadcrumb="fuel / source evidence" icon="fuel"></app-page-header>
<section class="feature-grid three-up compact-grid">
 <button class="feature-card" (click)="scrollToHistory()"><div><h3>Fuel Source Events</h3><p>Browse the individual fuel and odometer rows that are rolled into complete fuel cycles.</p></div><span class="round-icon blue"><app-icon name="fuel"></app-icon></span></button>
 <button class="feature-card" (click)="router.navigate(['/app/alerts'])"><div><h3>Full-Cycle Monitor</h3><p>Open Poor and Review results calculated only after a complete Stellar-to-Stellar fuel cycle closes.</p></div><span class="round-icon cyan"><app-icon name="dashboard"></app-icon></span></button>
 <button class="feature-card" (click)="router.navigate(['/app/fuel-estimate'])"><div><h3>Weight & Distance Calculator</h3><p>Estimate fuel needed for a loaded trip. Trailer performance weighting remains separate until the assignment spreadsheet is linked.</p></div><span class="round-icon green"><app-icon name="chart"></app-icon></span></button>
</section>
<section class="content-card" id="fuel-history">
 <div class="section-title"><div><h2>Daily fuel & odometer source evidence</h2><p>These are individual source readings only. V17 never labels one fuel row Good or Poor; performance is calculated after the next Stellar full-up closes the whole cycle.</p></div><span class="prototype-label">{{filtered.length}} SOURCE ROWS</span></div>
 <div class="prototype-info"><app-icon name="info"></app-icon><span><strong>Important:</strong> source-row km/L is shown for audit purposes only. All kilometres and fuel between two Stellar full-ups are combined into one cycle result before any performance judgement is made.</span></div>
 <div class="fuel-controls"><label><span>Source date</span><input type="date" [(ngModel)]="date" (change)="loadDate()"></label><label class="search-box"><app-icon name="search"></app-icon><input [(ngModel)]="search" placeholder="Search truck, location or destination"></label></div>
 @if(loading){<p class="loading-row"><span class="mini-spinner"></span>Loading fuel source events…</p>}
 @if(message){<p class="form-message">{{message}}</p>}
 <div class="table-wrap"><table class="data-table"><thead><tr><th>Truck</th><th>Date</th><th>Fuel location</th><th>Matched destination evidence</th><th>Start KM</th><th>End KM</th><th>KM</th><th>Litres</th><th>Source-row km/L</th><th>Use</th><th></th></tr></thead><tbody>
 @for(t of filtered;track t.id){<tr><td><strong>{{t.registration}}</strong></td><td>{{t.date}}</td><td>{{t.fillUpLocation||t.location||'Unknown'}}</td><td>{{t.destination||'Unknown'}}</td><td>{{t.startKm==null?'—':(t.startKm|number:'1.0-0')}}</td><td>{{t.endKm==null?'—':(t.endKm|number:'1.0-0')}}</td><td>{{t.distanceKm==null?'—':(t.distanceKm|number:'1.0-0')}}</td><td>{{t.litres|number:'1.0-2'}}</td><td>{{t.kmL==null?'—':(t.kmL|number:'1.2-2')}}</td><td><span class="evidence-pill">Cycle evidence only</span></td><td><button class="small-action" (click)="router.navigate(['/app/analytics'],{queryParams:{registration:t.registration}})">View truck cycles</button></td></tr>}
 @empty{<tr><td colspan="11" class="empty-cell">No fuel source rows match the selected date and filters.</td></tr>}
 </tbody></table></div>
</section>
<section class="report-panel"><header>Full-cycle reporting</header><div class="report-link-grid"><button (click)="router.navigate(['/app/reports'])"><span class="mini-report-icon"><app-icon name="report"></app-icon></span>Daily Full-Cycle Report</button><button (click)="router.navigate(['/app/analytics'])"><span class="mini-report-icon"><app-icon name="chart"></app-icon></span>Vehicle Cycle Comparison</button><button (click)="router.navigate(['/app/fleet'])"><span class="mini-report-icon"><app-icon name="truck"></app-icon></span>Vehicle Performance History</button></div></section>
`,styles:[`.fuel-controls{display:grid;grid-template-columns:220px 1fr;gap:10px;align-items:end;margin:16px 0}.fuel-controls>label:not(.search-box){display:flex;flex-direction:column;gap:5px}.fuel-controls>label>span{font-size:11px;color:#707783;text-transform:uppercase}.fuel-controls input[type=date]{height:42px;border:1px solid #cfd5da;background:#fff;padding:0 10px}.loading-row{display:flex;align-items:center;gap:8px;color:#6f7682}.mini-spinner{width:12px;height:12px;border:2px solid #d7dce4;border-top-color:#657083;border-radius:50%;display:inline-block;animation:spin .7s linear infinite}.evidence-pill{display:inline-block;padding:5px 8px;border-radius:999px;background:#eef1f5;color:#5f6978;font-size:11px;font-weight:700;white-space:nowrap}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:850px){.fuel-controls{grid-template-columns:1fr}}`]
})
export class FuelOilComponent{
 date='';search='';transactions:FuelTransaction[]=[];loading=true;message='';
 constructor(public router:Router,public data:MockDataService){void this.init();}
 async init(){try{const d=await this.data.dashboardSummary();this.date=d.date;await this.loadDate();}catch{this.loading=false;this.message='Could not load fuel history. Start the Express API.';}}
 async loadDate(){if(!this.date)return;this.loading=true;this.message='';try{this.transactions=await this.data.transactionsForDate(this.date);if(!this.transactions.length)this.message='No fuel source rows are available for this date.';}catch{this.transactions=[];this.message='Could not load fuel source events for this date.';}finally{this.loading=false;}}
 get filtered(){const q=this.search.trim().toLowerCase();return this.transactions.filter(t=>!q||`${t.registration} ${t.fillUpLocation||''} ${t.destination||''} ${t.location||''}`.toLowerCase().includes(q));}
 scrollToHistory(){document.getElementById('fuel-history')?.scrollIntoView({behavior:'smooth'});}
}
