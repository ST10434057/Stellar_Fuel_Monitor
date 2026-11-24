import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DailyAnalytics, TripAnalysis, Vehicle } from '../../core/models';
import { MockDataService } from '../../core/mock-data.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector:'app-trip-analytics',
  standalone:true,
  imports:[CommonModule,FormsModule,PageHeaderComponent,IconComponent],
  template:`
<app-page-header title="Trip Analytics" breadcrumb="fuel / trip analytics" icon="chart"></app-page-header>
<section class="content-card analytics-explainer"><app-icon name="info"></app-icon><div><strong>Full-to-full performance engine</strong><p>A performance record is one complete Stellar full-up → destination work/top-ups → next Stellar full-up cycle. Individual fuel readings are never labelled Poor on their own. V20 primarily benchmarks the full cycle against equivalent trucks of the same model/type + axle configuration on the same route.</p></div></section>

<section class="content-card">
 <div class="section-title"><div><h2>Find and investigate trips</h2><p>Choose a truck, destination and closing-date range. Each row is a completed fuel cycle. Investigate shows every fuel event that was rolled into the cycle result.</p></div><span class="prototype-label">OPTIMISED LIVE DATABASE</span></div>
 <div class="analytics-filters">
  <label><span>Vehicle</span><select [(ngModel)]="registration" (ngModelChange)="vehicleChanged()"><option value="">Select a truck…</option>@for(v of vehicles;track v.registration){<option [value]="v.registration">{{v.registration}} · {{v.manufacturer}} {{v.model}}</option>}</select></label>
  <label><span>Destination</span><select [(ngModel)]="destination" (ngModelChange)="filtersChanged()" [disabled]="!registration"><option value="">All destinations</option>@for(d of destinations;track d.destination){<option [value]="d.destination">{{d.destination}} ({{d.count}})</option>}</select></label>
  <label><span>From</span><input type="date" [(ngModel)]="from" (change)="filtersChanged()"></label>
  <label><span>To</span><input type="date" [(ngModel)]="to" (change)="filtersChanged()"></label>
 </div>
 @if(message){<p class="form-message">{{message}}</p>}
</section>

@if(registration){
<section class="content-card">
 <div class="section-title"><div><h2>{{registration}} full-cycle history</h2><p>{{destination || 'All destinations'}} · {{from}} to {{to}}.</p></div><strong>{{trips.length}} of {{totalTrips}} completed cycles</strong></div>
 @if(loading && !trips.length){<div class="loading-row"><span class="mini-spinner"></span>Loading first trip page…</div>}
 <div class="table-wrap"><table class="data-table analytics-table"><thead><tr><th>Cycle closed</th><th>Destination</th><th>Distance</th><th>Expected KM</th><th>Extra KM</th><th>Total litres</th><th>Cycle km/L</th><th>Model/route avg</th><th>Difference</th><th>Result</th><th></th></tr></thead><tbody>
 @for(t of trips;track t.id){<tr [class.data-error-row]="t.rating==='Data Warning'">
  <td>{{t.date}}<small class="table-sub">{{t.openingDate || '—'}} → {{t.closingDate || t.date}}</small></td><td><strong>{{t.routeLabel || t.destination || 'Unknown'}}</strong><small class="table-sub">{{t.destinationSource}}</small></td>
  <td>{{t.kilometers===null?'—':(t.kilometers|number:'1.0-0')+' km'}}</td><td>{{t.expectedDistanceKm==null?'—':(t.expectedDistanceKm|number:'1.0-0')+' km'}}</td>
  <td><span class="distance-chip" [class.over]="(t.extraKm||0)>0" [class.under]="(t.extraKm||0)<0">{{t.extraKm==null?'—':(((t.extraKm||0)>0?'+':'')+(t.extraKm|number:'1.0-0')+' km')}}</span></td>
  <td>{{t.litres===null?'—':(t.litres|number:'1.0-1')+' L'}}</td><td><strong>{{t.analysedKmL===null?'—':(t.analysedKmL|number:'1.2-2')}}</strong></td>
  <td>{{t.benchmark?.averageKmL===undefined?'—':(t.benchmark?.averageKmL|number:'1.2-2')}} @if(t.benchmark){<small class="table-sub">median {{t.benchmark.medianKmL|number:'1.2-2'}} · {{t.benchmark.distinctTruckCount || 1}} truck(s) · {{t.benchmark.sampleSize}} trips</small>}</td>
  <td [class.negative]="(t.deviationPct||0)<-7.5" [class.positive-text]="(t.deviationPct||0)>4">{{t.deviationPct===null?'—':(t.deviationPct|number:'1.1-1')+'%'}}</td>
  <td><span class="rating-badge" [attr.data-rating]="t.rating">{{t.rating}}</span><small class="table-sub">{{t.rating==='Baseline'?'building comparable route history':(t.confidenceScore+'% confidence')}}</small></td>
  <td><button class="small-action primary-action" (click)="investigate(t)">Investigate</button></td>
 </tr>} @empty {<tr><td colspan="11" class="empty-cell">No matching trips in this date range.</td></tr>}
 </tbody></table></div>
 @if(hasMore){
  <div class="load-more-row"><button class="load-more" [disabled]="loading" (click)="loadMore()">@if(loading){<span class="mini-spinner"></span>} Load next {{pageSize}} trips</button><span>{{trips.length}} / {{totalTrips}} loaded</span></div>
 }
</section>
} @else if(daily){
<section class="content-card"><div class="section-title"><div><h2>Latest full-cycle close day · {{daily.date}}</h2><p>Only cycles that closed with a Stellar full-up on this date appear here.</p></div><span class="prototype-label">{{daily.totalTrips}} CYCLES</span></div>
@if(loadingDaily){<div class="loading-row"><span class="mini-spinner"></span>Loading today's compact trip list…</div>}
<div class="table-wrap"><table class="data-table"><thead><tr><th>Truck</th><th>Destination</th><th>Distance</th><th>Extra KM</th><th>Cycle km/L</th><th>Model/route average</th><th>Difference</th><th>Result</th><th></th></tr></thead><tbody>
@for(t of dailyTrips;track t.id){<tr><td><strong>{{t.registration}}</strong></td><td>{{t.destination||'Unknown'}}</td><td>{{t.kilometers==null?'—':(t.kilometers|number:'1.0-0')+' km'}}</td><td>{{t.extraKm==null?'—':(((t.extraKm||0)>0?'+':'')+(t.extraKm|number:'1.0-0')+' km')}}</td><td>{{t.analysedKmL===null?'—':(t.analysedKmL|number:'1.2-2')}}</td><td>{{t.benchmark?.averageKmL===undefined?'—':(t.benchmark?.averageKmL|number:'1.2-2')}} @if(t.benchmark){<small class="table-sub">median {{t.benchmark.medianKmL|number:'1.2-2'}} · {{t.benchmark.distinctTruckCount || 1}} truck(s)</small>}</td><td>{{t.deviationPct===null?'—':(t.deviationPct|number:'1.1-1')+'%'}}</td><td><span class="rating-badge" [attr.data-rating]="t.rating">{{t.rating}}</span></td><td><div class="row-actions"><button class="small-action" (click)="selectTruck(t.registration)">Compare</button><button class="small-action primary-action" (click)="investigate(t)">Investigate</button></div></td></tr>}
@empty {<tr><td colspan="9" class="empty-cell">No full-to-full fuel cycles closed on this date.</td></tr>}
</tbody></table></div></section>
}
`,
styles:[`
.analytics-filters{display:grid;grid-template-columns:1.3fr 1.3fr .8fr .8fr;gap:12px;margin-top:16px}.analytics-filters label{display:flex;flex-direction:column;gap:6px}.analytics-filters label>span{font-size:12px;color:#68717d}.analytics-filters select,.analytics-filters input{height:42px;border:1px solid #cfd5da;background:#fff;padding:0 10px}.row-actions{display:flex;gap:6px}.primary-action{background:#5b718a;color:#fff;border-color:#5b718a}.distance-chip{display:inline-block;padding:3px 7px;border-radius:12px;background:#eef1f4}.distance-chip.over{background:#fbeceb;color:#a54842}.distance-chip.under{background:#eaf5ee;color:#347257}.loading-row{display:flex;align-items:center;gap:8px;color:#6f7682;margin:10px 0}.mini-spinner{width:12px;height:12px;border:2px solid #d7dce4;border-top-color:#657083;border-radius:50%;display:inline-block;animation:spin .7s linear infinite}.load-more-row{display:flex;justify-content:center;align-items:center;gap:12px;padding:16px 0 2px;color:#737b86;font-size:12px}.load-more{display:flex;align-items:center;gap:7px;border:1px solid #cfd5da;background:#fff;padding:9px 16px;border-radius:3px;cursor:pointer}.load-more:hover:not(:disabled){background:#f2f4f7}.load-more:disabled{opacity:.6}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:950px){.analytics-filters{grid-template-columns:1fr 1fr}}@media(max-width:600px){.analytics-filters{grid-template-columns:1fr}.row-actions{flex-direction:column}.load-more-row{flex-direction:column}}
`]
})
export class TripAnalyticsComponent{
 vehicles:Vehicle[]=[]; trips:TripAnalysis[]=[]; destinations:{destination:string,count:number}[]=[]; daily?:DailyAnalytics;dailyTrips:TripAnalysis[]=[];
 registration='';destination='';from='2026-01-01';to='';message='';loading=false;loadingDaily=false;
 totalTrips=0;hasMore=false;readonly pageSize=100;private requestVersion=0;

 constructor(public data:MockDataService,public router:Router,private route:ActivatedRoute){void this.init();}

 async init(){
   try{
     const [_,vehicles,daily]=await Promise.all([this.data.refreshHealth(),this.data.loadVehicles(),this.data.dashboardSummary()]);
     this.vehicles=vehicles.filter(v=>v.status==='Active');
     this.daily=daily;
     this.to=daily.navigation?.latestCompleteDate||daily.date;
     const q=this.route.snapshot.queryParamMap.get('registration')||'';
     if(q){this.registration=q.toUpperCase();await this.vehicleChanged();}
     else{
       this.loadingDaily=true;
       try{this.dailyTrips=await this.data.dayTrips(daily.date);}finally{this.loadingDaily=false;}
     }
   }catch{this.message='Could not load Trip Analytics. Start the Express API and try again.';}
 }

 async vehicleChanged(){
   const version=++this.requestVersion;
   this.destination='';this.destinations=[];this.trips=[];this.totalTrips=0;this.hasMore=false;
   if(!this.registration)return;
   this.loading=true;this.message='';
   try{
     const [destinations,page]=await Promise.all([
       this.data.destinations(this.registration),
       this.data.tripPage(this.registration,'',this.from,this.to,this.pageSize,0)
     ]);
     if(version!==this.requestVersion)return;
     this.destinations=destinations;
     this.trips=page.items;this.totalTrips=page.total;this.hasMore=page.hasMore;
   }catch{if(version===this.requestVersion)this.message='Could not load this truck history.';}finally{if(version===this.requestVersion)this.loading=false;}
 }

 async filtersChanged(){await this.loadTrips(true);}

 async loadTrips(reset=true){
   if(!this.registration)return;
   const version=++this.requestVersion;
   this.loading=true;this.message='';
   const offset=reset?0:this.trips.length;
   try{
     const page=await this.data.tripPage(this.registration,this.destination,this.from,this.to,this.pageSize,offset);
     if(version!==this.requestVersion)return;
     this.trips=reset?page.items:[...this.trips,...page.items];
     this.totalTrips=page.total;this.hasMore=page.hasMore;
   }catch{
     if(version!==this.requestVersion)return;
     if(reset)this.trips=[];
     this.message='Could not load matching trips.';
   }finally{if(version===this.requestVersion)this.loading=false;}
 }

 async loadMore(){if(!this.loading&&this.hasMore)await this.loadTrips(false);}
 selectTruck(reg:string){this.registration=reg;void this.vehicleChanged();window.scrollTo({top:0,behavior:'smooth'});}
 investigate(t:TripAnalysis){this.router.navigate(['/app/trips',t.id]);}
}
