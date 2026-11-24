import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MockDataService } from '../../core/mock-data.service';
import { DailyAnalytics, FuelAlert } from '../../core/models';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector:'app-alerts',
  standalone:true,
  imports:[CommonModule,FormsModule,PageHeaderComponent,IconComponent],
  template:`
<app-page-header title="Fuel Alerts" breadcrumb="alerts / investigations" icon="alert"></app-page-header>
<section class="content-card">
 <div class="section-title"><div><h2>Investigation queue</h2><p>Choose a cycle-closing day. Alerts exist only for completed Stellar full-up to Stellar full-up cycles; individual fuel readings never create a Poor alert.</p></div><span class="prototype-label">{{alerts.length}} ALERTS</span></div>
 <div class="alert-date-row">
  <button class="date-step" [disabled]="!canPrevious||loading" (click)="goPrevious()">‹ Previous</button>
  <label><span>Cycle closing date</span><input type="date" [(ngModel)]="date" (change)="loadDate(date)"></label>
  <button class="date-step" [disabled]="!canNext||loading" (click)="goNext()">Next ›</button>
  <button class="secondary-btn" [disabled]="!navigation?.latestCompleteDate||date===navigation?.latestCompleteDate" (click)="goLatest()">Latest complete</button>
 </div>
 @if(loading){<p class="loading-row"><span class="mini-spinner"></span>Loading alerts…</p>}
 @if(message){<p class="form-message">{{message}}</p>}
</section>
<section class="content-card">
 <div class="filters-row"><label class="search-box"><app-icon name="search"></app-icon><input [(ngModel)]="search" placeholder="Search registration, destination or reason"></label><select [(ngModel)]="severity"><option value="All">All severities</option><option>High</option><option>Review</option><option>Data Warning</option></select><select [(ngModel)]="status"><option value="All">All statuses</option><option>Open</option><option>Investigating</option><option>Resolved</option></select></div>
 <div class="prototype-info"><app-icon name="info"></app-icon><span>Poor and Review are prompts for human investigation of the <strong>whole closed fuel cycle</strong>. Data Warnings indicate incomplete or implausible source evidence. Baseline cycles are deliberately not alerted. Use <strong>Investigate</strong> to see all top-ups and the pooled same-model/same-route benchmark plus the exact truck's own route history.</span></div>
 <div class="table-wrap"><table class="data-table"><thead><tr><th>Vehicle</th><th>Date</th><th>Destination</th><th>km/L</th><th>Difference</th><th>Reason</th><th>Severity</th><th>Status</th><th>Actions</th></tr></thead><tbody>
 @for(alert of filteredAlerts;track alert.id){<tr>
  <td><strong>{{alert.registration}}</strong></td><td>{{alert.date}}</td><td>{{alert.destination||'Unknown'}}</td><td>{{alert.kmL===null?'—':(alert.kmL|number:'1.2-2')}}</td><td>{{alert.deviationPct===null||alert.deviationPct===undefined?'—':(alert.deviationPct|number:'1.1-1')+'%'}}</td><td class="reason-cell">{{alert.reason}}</td>
  <td><span class="severity-badge" [class.high]="alert.severity==='High'" [class.review]="alert.severity==='Review'" [class.data-warning]="alert.severity==='Data Warning'">{{alert.severity}}</span></td>
  <td><span class="status-badge" [class.resolved]="alert.status==='Resolved'" [class.investigating]="alert.status==='Investigating'">{{alert.status}}</span></td>
  <td><div class="row-actions"><button class="small-action primary-action" [disabled]="!alert.tripId" (click)="openTrip(alert)">Investigate</button><button class="small-action" (click)="router.navigate(['/app/alerts',alert.id])">Review status</button></div></td>
 </tr>} @empty {<tr><td colspan="9" class="empty-cell">No alerts match the selected date and filters.</td></tr>}
 </tbody></table></div>
</section>
`,
styles:[`
.alert-date-row{display:flex;gap:9px;align-items:flex-end;flex-wrap:wrap;margin-top:16px}.alert-date-row label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:#707783;text-transform:uppercase}.alert-date-row input,.date-step{height:42px;border:1px solid #cfd4dc;background:#fff;padding:0 12px}.date-step:disabled{opacity:.45}.row-actions{display:flex;gap:6px;white-space:nowrap}.primary-action{background:#5b718a;color:#fff;border-color:#5b718a}.reason-cell{min-width:300px}.loading-row{display:flex;align-items:center;gap:8px;color:#6f7682}.mini-spinner{width:12px;height:12px;border:2px solid #d7dce4;border-top-color:#657083;border-radius:50%;display:inline-block;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:700px){.row-actions{flex-direction:column}.alert-date-row label{flex:1}.alert-date-row input{width:100%}}
`]
})
export class AlertsComponent{
 search='';severity='All';status='All';date='';alerts:FuelAlert[]=[];loading=false;message='';navigation?:DailyAnalytics['navigation'];
 constructor(public router:Router,public data:MockDataService){void this.init();}
 async init(){
   try{const d=await this.data.dashboardSummary();this.date=d.date;this.navigation=d.navigation;await this.loadAlertsOnly();}
   catch{this.message='Could not load the alert queue. Start the Express API and try again.';}
 }
 async loadDate(value:string){
   if(!value)return;this.loading=true;this.message='';
   try{
     const [d,alerts]=await Promise.all([this.data.dashboardSummary(value),this.data.alertsForDate(value)]);
     this.navigation=d.navigation;this.date=value;this.alerts=alerts;
     if(!d.navigation?.hasData)this.message='No completed full-to-full fuel cycles closed on this date.';
   }catch{this.message='Could not load alerts for this date.';}finally{this.loading=false;}
 }
 async loadAlertsOnly(){this.alerts=await this.data.alertsForDate(this.date);}
 get filteredAlerts():FuelAlert[]{const q=this.search.trim().toLowerCase();return this.alerts.filter(a=>(!q||`${a.registration} ${a.destination||''} ${a.reason}`.toLowerCase().includes(q))&&(this.severity==='All'||a.severity===this.severity)&&(this.status==='All'||a.status===this.status));}
 get canPrevious(){return !!this.navigation?.previousDate;}
 get canNext(){return !!this.navigation?.nextDate;}
 async goPrevious(){if(this.navigation?.previousDate)await this.loadDate(this.navigation.previousDate);}
 async goNext(){if(this.navigation?.nextDate)await this.loadDate(this.navigation.nextDate);}
 async goLatest(){if(this.navigation?.latestCompleteDate)await this.loadDate(this.navigation.latestCompleteDate);}
 openTrip(a:FuelAlert){if(a.tripId)this.router.navigate(['/app/trips',a.tripId]);}
}
