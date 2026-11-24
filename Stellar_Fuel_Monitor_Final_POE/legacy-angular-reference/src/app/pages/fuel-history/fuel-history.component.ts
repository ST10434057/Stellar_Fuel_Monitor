import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TruckMonthlyFuelHistory, Vehicle } from '../../core/models';
import { MockDataService } from '../../core/mock-data.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-fuel-history',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, IconComponent],
  template: `
<app-page-header title="Truck Fuel History" breadcrumb="fuel / monthly truck history" icon="fuel"></app-page-header>

<section class="content-card history-controls no-print">
  <div>
    <h2>Complete monthly fuel history</h2>
    <p>Select a truck and month to view every available fuel / odometer record for that period. These rows are evidence records; Good/Poor is decided only from completed full-trip cycles.</p>
  </div>
  <div class="control-grid">
    <label><span>Truck</span><select [(ngModel)]="registration"><option value="">Select truck</option>@for(v of trucks;track v.registration){<option [value]="v.registration">{{v.registration}} · {{v.manufacturer}} {{v.model}}</option>}</select></label>
    <label><span>Month</span><input type="month" [(ngModel)]="month"></label>
    <button class="primary-btn" [disabled]="!registration || !month || loading" (click)="load()">{{loading?'Loading…':'Load fuel history'}}</button>
  </div>
</section>

@if(history){
<section class="content-card history-hero">
  <div class="vehicle-title">
    <div class="vehicle-avatar"><app-icon name="truck"></app-icon></div>
    <div><span class="eyebrow">{{monthLabel}}</span><h2>{{history.registration}}</h2><p>{{history.vehicle?.manufacturer || ''}} {{history.vehicle?.model || ''}} · {{history.summary.recordCount}} fuel record(s)</p></div>
  </div>
  <div class="hero-actions no-print">
    <button class="secondary-btn" (click)="router.navigate(['/app/fleet',history.registration])">Vehicle profile</button>
    <button class="secondary-btn" (click)="router.navigate(['/app/analytics'],{queryParams:{registration:history.registration}})">Trip analytics</button>
  </div>
</section>

<section class="content-card month-summary">
  <div class="summary-grid">
    <div><span>Fuel records</span><strong>{{history.summary.recordCount}}</strong></div>
    <div><span>Total kilometres</span><strong>{{history.summary.kmTotal==null?'—':(history.summary.kmTotal|number:'1.0-0')+' km'}}</strong></div>
    <div><span>Total diesel</span><strong>{{history.summary.dieselTotalLitres==null?'—':(history.summary.dieselTotalLitres|number:'1.0-1')+' L'}}</strong></div>
    <div><span>Weighted month km/L</span><strong>{{history.summary.vehicleConsumptionKmL==null?'—':(history.summary.vehicleConsumptionKmL|number:'1.2-2')+' km/L'}}</strong></div>
    <div><span>Opening odometer</span><strong>{{history.summary.openingOdometer==null?'—':(history.summary.openingOdometer|number:'1.0-0')}}</strong></div>
    <div><span>Closing odometer</span><strong>{{history.summary.closingOdometer==null?'—':(history.summary.closingOdometer|number:'1.0-0')}}</strong></div>
  </div>
  <div class="written-summary"><app-icon name="info"></app-icon><p>{{monthlyNarrative}}</p></div>
</section>

<section class="content-card">
  <div class="section-title"><div><h2>Fuel ledger · {{monthLabel}}</h2><p>All available fuel records for the selected month, newest first.</p></div><span class="prototype-label">{{history.summary.recordCount}} RECORDS</span></div>
  @if(history.rows.length){
  <div class="table-wrap"><table class="data-table monthly-table"><thead><tr><th>Date</th><th>Driver</th><th>Fill-up location</th><th>Destination</th><th>Start KM</th><th>End KM</th><th>KM</th><th>Litres</th><th>km/L</th><th>Extra KM</th></tr></thead><tbody>
    @for(row of history.rows;track row.id){<tr>
      <td>{{row.date}}</td><td>{{row.driver || '—'}}</td><td>{{row.fillUpLocation || '—'}}</td><td>{{row.destination || '—'}}</td>
      <td>{{row.startKm==null?'—':(row.startKm|number:'1.0-0')}}</td><td>{{row.endKm==null?'—':(row.endKm|number:'1.0-0')}}</td>
      <td>{{row.kilometers==null?'—':(row.kilometers|number:'1.0-0')}}</td><td>{{row.litres==null?'—':(row.litres|number:'1.0-1')}}</td>
      <td>{{row.consumptionKmL==null?'—':(row.consumptionKmL|number:'1.2-2')}}</td><td>{{row.extraKm==null?'—':(((row.extraKm||0)>0?'+':'')+(row.extraKm|number:'1.0-0'))}}</td>
    </tr>}
  </tbody></table></div>
  } @else {<p class="muted">No fuel records were found for this truck in {{monthLabel}}.</p>}
</section>
} @else if(message){
<section class="content-card"><p>{{message}}</p></section>
}
`,
  styles: [`
.history-controls{margin-top:18px}.history-controls h2{margin:0 0 5px}.history-controls p{margin:0;color:#66707d}.control-grid{display:grid;grid-template-columns:2fr 1fr auto;gap:12px;align-items:end;margin-top:16px}.control-grid label span{display:block;font-size:11px;text-transform:uppercase;color:#707986;margin-bottom:5px}.control-grid select,.control-grid input{width:100%;min-height:42px;box-sizing:border-box}.control-grid button{min-height:42px}.history-hero{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:18px}.vehicle-title{display:flex;gap:14px;align-items:center}.vehicle-title h2{margin:2px 0}.vehicle-title p{margin:0;color:#69727f}.vehicle-avatar{width:54px;height:54px;display:grid;place-items:center;background:#687487;color:#fff;border-radius:4px}.hero-actions{display:flex;gap:8px}.summary-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.summary-grid>div{border:1px solid #dde2e8;background:#f8f9fb;padding:12px}.summary-grid span{display:block;font-size:11px;text-transform:uppercase;color:#737b87;margin-bottom:5px}.summary-grid strong{font-size:17px}.written-summary{display:flex;gap:10px;margin-top:14px;padding:13px;background:#f3f6f9;border-left:4px solid #687b91;color:#56616e}.written-summary p{margin:0;line-height:1.5}.monthly-table{min-width:1120px}@media(max-width:950px){.control-grid{grid-template-columns:1fr 1fr}.control-grid button{grid-column:1/-1}.summary-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.history-hero{display:block}.hero-actions{margin-top:12px}}@media(max-width:600px){.control-grid,.summary-grid{grid-template-columns:1fr}.control-grid button{grid-column:auto}.hero-actions{flex-direction:column}}
  `]
})
export class FuelHistoryComponent {
  trucks: Vehicle[] = [];
  registration = '';
  month = '';
  history?: TruckMonthlyFuelHistory;
  loading = false;
  message = '';

  constructor(private route: ActivatedRoute, public router: Router, public data: MockDataService) {
    this.route.queryParamMap.subscribe(q => {
      this.registration = (q.get('registration') || this.registration || '').toUpperCase();
      this.month = q.get('month') || this.month || '';
      void this.initialise();
    });
  }

  async initialise() {
    try {
      await this.data.refreshHealth();
      this.trucks = (await this.data.loadVehicles()).filter(v => !v.isTrailer && String(v.status || '').toLowerCase() !== 'scrapped');
      if (!this.month) this.month = (this.data.health?.dataset?.datasetDate || new Date().toISOString().slice(0, 10)).slice(0, 7);
      if (this.registration && this.month) await this.load(false);
    } catch {
      this.message = 'Could not load the truck list. Check the Express API.';
    }
  }

  async load(updateUrl = true) {
    if (!this.registration || !this.month) return;
    this.loading = true; this.message = ''; this.history = undefined;
    try {
      this.history = await this.data.monthlyFuelHistory(this.registration, this.month);
      if (updateUrl) void this.router.navigate([], { relativeTo: this.route, queryParams: { registration: this.registration, month: this.month }, queryParamsHandling: 'merge', replaceUrl: true });
    } catch {
      this.message = 'Monthly fuel history could not be loaded. Check the API and try again.';
    } finally { this.loading = false; }
  }

  get monthLabel() {
    if (!/^\d{4}-\d{2}$/.test(this.month)) return this.month;
    const [y, m] = this.month.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  get monthlyNarrative() {
    const h = this.history; if (!h) return '';
    const km = h.summary.kmTotal == null ? 'an unavailable distance total' : `${Number(h.summary.kmTotal).toLocaleString('en-ZA')} km`;
    const fuel = h.summary.dieselTotalLitres == null ? 'an unavailable fuel total' : `${Number(h.summary.dieselTotalLitres).toLocaleString('en-ZA', { maximumFractionDigits: 1 })} L`;
    const eff = h.summary.vehicleConsumptionKmL == null ? 'could not be calculated' : `${Number(h.summary.vehicleConsumptionKmL).toFixed(2)} km/L`;
    return `${h.registration} has ${h.summary.recordCount} available fuel record(s) in ${this.monthLabel}. Together those records represent ${km} and ${fuel}. The weighted month-level evidence result is ${eff}, calculated from total kilometres divided by total litres rather than by equally averaging individual km/L rows.`;
  }
}
