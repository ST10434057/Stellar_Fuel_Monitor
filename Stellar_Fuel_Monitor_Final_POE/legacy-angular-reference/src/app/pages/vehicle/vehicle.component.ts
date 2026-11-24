import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MockDataService } from '../../core/mock-data.service';
import { Vehicle } from '../../core/models';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector:'app-vehicle',
  standalone:true,
  imports:[CommonModule,PageHeaderComponent,IconComponent],
  template:`
<app-page-header title="Vehicle" breadcrumb="vehicle / fleet overview" icon="truck"></app-page-header>
<section class="feature-grid five-up">
 <button class="feature-card" (click)="router.navigate(['/app/fleet'])"><div><h3>Fleet Search</h3><p>Search every truck and open its live performance profile.</p></div><span class="round-icon blue"><app-icon name="search"></app-icon></span></button>
 <button class="feature-card" (click)="router.navigate(['/app/analytics'])"><div><h3>Trip Analytics</h3><p>Compare vehicle history and open individual Trip Investigations.</p></div><span class="round-icon cyan"><app-icon name="chart"></app-icon></span></button>
 <button class="feature-card" (click)="router.navigate(['/app/alerts'])"><div><h3>Vehicle Alerts</h3><p>Review poor, review and data-warning trips by operating date.</p></div><span class="round-icon teal"><app-icon name="alert"></app-icon></span></button>
 <button class="feature-card" (click)="router.navigate(['/app/fuel-oil'])"><div><h3>Fuel History</h3><p>Browse the latest fuel and odometer records.</p></div><span class="round-icon green"><app-icon name="fuel"></app-icon></span></button>
 <button class="feature-card" (click)="router.navigate(['/app/reports'])"><div><h3>Management Reports</h3><p>Generate, print and export daily fuel-performance reports.</p></div><span class="round-icon lime"><app-icon name="report"></app-icon></span></button>
</section>
@if(loading){<section class="content-card"><p>Loading fleet overview…</p></section>}
@if(!loading){
<section class="content-card"><div class="section-title"><div><h2>Current fleet overview</h2><p>Live from the same vehicle master used by analytics.</p></div><span class="prototype-label">{{active.length}} ACTIVE TRUCKS</span></div>
 <div class="vehicle-kpis"><div><span>All truck records</span><strong>{{vehicles.length}}</strong></div><div><span>Active</span><strong>{{active.length}}</strong></div><div><span>Comparison groups</span><strong>{{groupCount}}</strong></div><div><span>Latest performance date</span><strong>{{data.health?.fleet?.latestCompleteDate||'—'}}</strong></div></div>
</section>
<section class="content-card"><div class="section-title"><div><h2>Recently active vehicles</h2><p>Open a vehicle profile or go directly to its Trip Analytics history.</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Registration</th><th>Make / model</th><th>Group</th><th>Last trip</th><th>Latest km/L</th><th>Result</th><th>Actions</th></tr></thead><tbody>@for(v of recent;track v.registration){<tr><td><strong>{{v.registration}}</strong></td><td>{{v.manufacturer}} {{v.model}}</td><td>{{v.peerType||v.vehicleGroup}}</td><td>{{v.lastTripDate||'—'}}</td><td>{{v.currentKmL==null?'—':(v.currentKmL|number:'1.2-2')}}</td><td><span class="rating-badge" [attr.data-rating]="v.currentRating||'Average'">{{v.currentRating||'No recent result'}}</span></td><td><div class="row-actions"><button class="small-action" (click)="router.navigate(['/app/fleet',v.registration])">Profile</button><button class="small-action primary-action" (click)="router.navigate(['/app/analytics'],{queryParams:{registration:v.registration}})">Trips</button></div></td></tr>}</tbody></table></div>
</section>}
`,styles:[`.vehicle-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:15px}.vehicle-kpis>div{border:1px solid #dfe3e8;background:#f8f9fb;padding:14px}.vehicle-kpis span{display:block;font-size:11px;color:#737b87;text-transform:uppercase;margin-bottom:5px}.vehicle-kpis strong{font-size:22px}.row-actions{display:flex;gap:6px}.primary-action{background:#5b718a;color:#fff;border-color:#5b718a}@media(max-width:800px){.vehicle-kpis{grid-template-columns:1fr 1fr}}@media(max-width:500px){.vehicle-kpis{grid-template-columns:1fr}.row-actions{flex-direction:column}}`]
})
export class VehicleComponent{
 vehicles:Vehicle[]=[];loading=true;
 constructor(public router:Router,public data:MockDataService){void this.load();}
 async load(){try{await Promise.all([this.data.refreshHealth(),this.data.loadVehicles()]);this.vehicles=this.data.vehicles;}finally{this.loading=false;}}
 get active(){return this.vehicles.filter(v=>v.status==='Active');}
 get groupCount(){return new Set(this.active.map(v=>v.peerType||v.vehicleGroup).filter(Boolean)).size;}
 get recent(){return [...this.active].sort((a,b)=>String(b.lastTripDate||'').localeCompare(String(a.lastTripDate||''))).slice(0,15);}
}
