import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MockDataService } from '../../core/mock-data.service';
import { Vehicle } from '../../core/models';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { IconComponent } from '../../shared/icon.component';

@Component({selector:'app-fleet',standalone:true,imports:[CommonModule,FormsModule,PageHeaderComponent,IconComponent],template:`
<app-page-header title="Fleet Performance" breadcrumb="vehicle / fleet" icon="truck"></app-page-header>
<section class="content-card">
 <div class="section-title"><div><h2>Truck fleet</h2><p>Real asset master from the latest Stellar dataset. Trailers are kept separate from truck performance comparisons.</p></div><span class="prototype-label">{{data.vehicles.length}} TRUCKS</span></div>
 <div class="filters-row"><label class="search-box"><app-icon name="search"></app-icon><input [(ngModel)]="query" placeholder="Search registration, make, model or group"></label><select [(ngModel)]="status"><option value="All">All statuses</option><option>Active</option><option>Sold</option><option>Scrapped</option></select></div>
 <div class="table-wrap"><table class="data-table"><thead><tr><th>Registration</th><th>Make / model</th><th>Comparison group</th><th>Status</th><th>Latest km/L</th><th>Latest result</th><th>Last trip</th><th></th></tr></thead><tbody>
 @for(v of filtered;track v.registration){<tr><td><strong>{{v.registration}}</strong></td><td>{{v.manufacturer}} {{v.model}}<small class="table-sub">{{v.description}}</small></td><td>{{v.peerType||v.vehicleGroup}}</td><td><span class="status-badge" [class.resolved]="v.status==='Active'">{{v.status}}</span></td><td>{{v.currentKmL===null?'—':(v.currentKmL|number:'1.2-2')}}</td><td><span class="rating-badge" [attr.data-rating]="v.currentRating||'Average'">{{v.currentRating||'No recent result'}}</span></td><td>{{v.lastTripDate||'—'}}</td><td><div class="fleet-actions"><button class="small-action" (click)="router.navigate(['/app/fleet',v.registration])">Profile</button><button class="small-action" (click)="router.navigate(['/app/analytics'],{queryParams:{registration:v.registration}})">Trips</button></div></td></tr>}
 @empty{<tr><td colspan="8" class="empty-cell">No vehicles match this search.</td></tr>}
 </tbody></table></div>
</section>`,styles:[`.fleet-actions{display:flex;gap:6px}@media(max-width:600px){.fleet-actions{flex-direction:column}}`]})
export class FleetComponent{
 query='';status='Active';constructor(public router:Router,public data:MockDataService){this.data.refresh();}
 get filtered():Vehicle[]{const q=this.query.trim().toLowerCase();return this.data.vehicles.filter(v=>(this.status==='All'||v.status===this.status)&&(!q||`${v.registration} ${v.description} ${v.vehicleGroup} ${v.model} ${v.manufacturer}`.toLowerCase().includes(q)));}
}
