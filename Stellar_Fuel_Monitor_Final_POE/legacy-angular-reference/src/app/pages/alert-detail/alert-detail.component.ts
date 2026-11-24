import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FuelAlert } from '../../core/models';
import { MockDataService } from '../../core/mock-data.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { IconComponent } from '../../shared/icon.component';

@Component({selector:'app-alert-detail',standalone:true,imports:[CommonModule,FormsModule,PageHeaderComponent,IconComponent],template:`
<app-page-header title="Fuel Investigation Review" breadcrumb="alerts / review" icon="alert"></app-page-header>
@if(alert){
<section class="alert-layout"><article class="content-card alert-main">
 <div class="alert-title-row"><div><span class="eyebrow">{{alert.id}}</span><h2>{{alert.registration}} → {{alert.destination||'route unavailable'}}</h2></div><span class="status-badge" [class.investigating]="alert.status==='Investigating'" [class.resolved]="alert.status==='Resolved'">{{alert.status}}</span></div>
 <div class="alert-callout" [class.high-callout]="alert.severity==='High'"><app-icon name="alert"></app-icon><div><strong>{{alert.severity}}</strong><p>{{alert.reason}}</p></div></div>
 <div class="detail-grid"><div><span>Date</span><strong>{{alert.date}}</strong></div><div><span>Analysed consumption</span><strong>{{alert.kmL===null?'Insufficient data':(alert.kmL|number:'1.2-2')+' km/L'}}</strong></div><div><span>Benchmark</span><strong>{{alert.benchmark}}</strong></div><div><span>Difference</span><strong>{{alert.deviationPct===null||alert.deviationPct===undefined?'—':(alert.deviationPct|number:'1.1-1')+'%'}}</strong></div><div><span>Analysis confidence</span><strong>{{alert.confidenceScore||'—'}}%</strong></div><div><span>Driver source context</span><strong>{{alert.driver}}</strong></div><div><span>Trailer</span><strong>{{alert.trailer}}</strong></div><div><span>Load context</span><strong>{{alert.loadContext}}</strong></div></div>
 @if(alert.explanations?.length){<div class="explanation-list compact">@for(e of alert.explanations;track e){<div><app-icon name="check"></app-icon><span>{{e}}</span></div>}</div>}
 @if(alert.tripId){<div class="trip-open-callout"><div><strong>Open the full Trip Investigation</strong><p>View expected litres, extra kilometres, recent fuel history, route evidence and print/save the investigation as a PDF.</p></div><button class="primary-btn" (click)="openTrip()">Open Trip Investigation</button></div>}
 <label class="comment-box"><span>Investigation comment</span><textarea [(ngModel)]="comment" rows="5" placeholder="Record what was checked and the outcome..."></textarea></label>
 @if(message){<p class="form-message">{{message}}</p>}
 <div class="button-row"><button class="secondary-btn" (click)="markInvestigating()">Mark Investigating</button><button class="primary-btn" (click)="resolve()">Resolve Alert</button></div>
</article><aside class="content-card context-card"><h3>Investigation controls</h3><p>A low fuel result is a prompt to investigate route, trailer/load mass, data quality, idling, driving conditions and maintenance. It is not automatically evidence of theft.</p><div class="context-rule"><app-icon name="check"></app-icon><span>Trip Investigation opens from historical alerts</span></div><div class="context-rule"><app-icon name="check"></app-icon><span>Outliers excluded from averages</span></div><div class="context-rule"><app-icon name="check"></app-icon><span>Raw reported km/L preserved</span></div><div class="context-rule"><app-icon name="check"></app-icon><span>Resolution comment saved</span></div><div class="context-rule"><app-icon name="check"></app-icon><span>Weight context can recalculate trip</span></div></aside></section>
} @else {<section class="content-card"><h2>{{loading?'Loading alert…':'Alert unavailable'}}</h2><p>{{message}}</p>@if(!loading){<button class="secondary-btn" (click)="router.navigate(['/app/alerts'])">Back to Alerts</button>}</section>}
`,styles:[`.trip-open-callout{display:flex;justify-content:space-between;align-items:center;gap:18px;margin:18px 0;padding:14px;border:1px solid #d7e0e7;background:#f4f8fb}.trip-open-callout p{margin:4px 0 0;color:#65707c}.trip-open-callout .primary-btn{white-space:nowrap}@media(max-width:700px){.trip-open-callout{display:block}.trip-open-callout .primary-btn{width:100%;margin-top:12px}}`]})
export class AlertDetailComponent{
 alert?:FuelAlert;comment='';message='';id='';loading=true;
 constructor(private route:ActivatedRoute,private data:MockDataService,public router:Router){this.route.paramMap.subscribe(p=>{this.id=p.get('id')||'';void this.load();});}
 async load(){this.loading=true;this.message='';this.alert=undefined;try{this.alert=await this.data.getAlert(this.id);this.comment=this.alert.comment||'';}catch{this.message='Alert not found or the Express API is unavailable.';}finally{this.loading=false;}}
 openTrip(){if(this.alert?.tripId)this.router.navigate(['/app/trips',this.alert.tripId]);}
 async markInvestigating(){if(!this.alert)return;try{await this.data.updateAlert(this.alert.id,'Investigating',this.comment);await this.load();this.message='Alert marked Investigating and saved.';}catch{this.message='Could not update the alert.';}}
 async resolve(){if(!this.alert)return;if(this.comment.trim().length<8){this.message='Please add a short investigation comment before resolving this alert.';return;}try{await this.data.updateAlert(this.alert.id,'Resolved',this.comment.trim());await this.load();this.message='Alert resolved and saved.';}catch{this.message='Could not resolve the alert.';}}
}
