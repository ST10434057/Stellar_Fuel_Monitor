import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { DailyAnalytics } from '../../core/models';
import { MockDataService } from '../../core/mock-data.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-home', standalone: true, imports: [CommonModule, IconComponent],
  template: `
    <section class="home-intro">
      <div>
        <h1>Stellar Fuel Intelligence</h1>
        <p>Full-cycle fuel monitoring: Stellar full-up → destination work/top-ups → next Stellar full-up.</p>
        @if(data.health?.dataset?.fuelCoveragePct2026!=null){
          <div class="coverage-line"><strong>2026 fuel evidence:</strong> {{data.health?.dataset?.fuelCoveragePct2026|number:'1.1-1'}}% of historical consumption rows have a direct source fuel-entry link. The remaining records still show the consumption-report fuel maths but are marked lower confidence.</div>
        }
      </div>
      <div class="data-source-badge" [class.live-db]="data.health?.source==='mongodb'"><span class="dot"></span>{{sourceLabel}}</div>
    </section>

    @if (dashboard) {
      <section class="dashboard-strip executive-strip">
        <div class="strip-heading date-heading">
          <div>
            <h2>Daily Performance · {{formatDate(dashboard.date)}}</h2>
            <p>Each result is one completed full-to-full fuel cycle. Individual fuel readings inside the cycle are evidence only; Good/Poor is decided from the whole cycle against prior equivalent same-model trucks on the same destination/route, with this exact truck's own history shown separately.</p>
          </div>
          <div class="date-controls" aria-label="Dashboard date controls">
            <button class="date-step" [disabled]="!canGoPrevious" (click)="goPrevious()">‹ <span>Previous</span></button>
            <label class="date-picker"><span>Choose date</span><input type="date" [value]="pendingDate || dashboard.date" [min]="dashboard.navigation?.minDate || ''" [max]="dashboard.navigation?.maxDate || ''" (change)="chooseDate($event)"></label>
            <button class="date-step" [disabled]="!canGoNext" (click)="goNext()"><span>Next</span> ›</button>
            <button class="latest-btn" [disabled]="dashboard.date===dashboard.navigation?.latestCompleteDate" (click)="goLatest()">Latest</button>
          </div>
        </div>
        @if (changingDate) { <div class="date-loading"><span class="mini-spinner"></span> Switching to {{pendingDate ? formatDate(pendingDate) : 'selected date'}}…</div> }
        @if (dashboard.navigation && !dashboard.navigation.hasData) { <div class="no-day-data">No fuel trips were recorded on this exact date. Use Previous or Next to jump to the nearest operating day.</div> }
        <div class="kpi-row seven-kpis">
          <div class="kpi high"><span>Poor</span><strong>{{dashboard.counts.poor}}</strong><small>needs investigation</small></div>
          <div class="kpi review"><span>Review</span><strong>{{dashboard.counts.review}}</strong><small>below expected</small></div>
          <div class="kpi neutral"><span>Average</span><strong>{{dashboard.counts.average}}</strong><small>within normal range</small></div>
          <div class="kpi good"><span>Good</span><strong>{{dashboard.counts.good}}</strong><small>above expected</small></div>
          <div class="kpi outstanding"><span>Outstanding</span><strong>{{dashboard.counts.outstanding}}</strong><small>top full-cycle result</small></div>
          <div class="kpi neutral"><span>Baseline</span><strong>{{dashboard.counts.baseline}}</strong><small>not enough comparable model/route history yet</small></div>
          <div class="kpi data"><span>Data warnings</span><strong>{{dashboard.counts.dataWarnings}}</strong><small>incomplete / invalid cycle evidence</small></div>
        </div>
        @if(dashboard.distanceSummary){
          <div class="distance-day-summary">
            <div><span>Trips with route-distance benchmark</span><strong>{{dashboard.distanceSummary.tripsWithBenchmark}}</strong></div>
            <div><span>Extra km on flagged trucks</span><strong [class.distance-alert]="dashboard.distanceSummary.flaggedPositiveExtraKm>0">+{{dashboard.distanceSummary.flaggedPositiveExtraKm|number:'1.0-0'}} km</strong></div>
            <div><span>All positive distance variance today</span><strong>{{dashboard.distanceSummary.positiveExtraKm|number:'1.0-0'}} km</strong></div>
          </div>
        }
      </section>

      <section class="read-guide">
        <div><strong>One result = one fuel cycle</strong><span>Opening Stellar full-up to closing Stellar full-up</span></div>
        <div><strong>Intermediate top-ups</strong><span>All partial refuels are included in the cycle litres</span></div>
        <div><strong>Historical average</strong><span>Primary: same model/type + axle + same destination; exact truck history stays visible</span></div>
        <div><strong>Baseline</strong><span>Shown until at least 3 previous matching cycles exist</span></div>
      </section>

      <section class="two-column-section dashboard-columns">
        <article class="content-card">
          <div class="section-title"><div><h2>Priority investigations</h2><p>Completed full cycles below the pooled same-model + same-route historical benchmark.</p></div><button class="text-action" (click)="router.navigate(['/app/alerts'])">All alerts →</button></div>
          @for (trip of dashboard.needsReview.slice(0,6); track trip.id) {
            <button class="performance-row" (click)="router.navigate(['/app/trips',trip.id])">
              <span class="rating-dot" [class.poor]="trip.rating==='Poor'" [class.review]="trip.rating==='Review'"></span>
              <div class="performance-main">
                <strong>{{trip.registration}} → {{trip.destination || 'route unavailable'}}</strong>
                <small>{{trip.openingDate}} → {{trip.closingDate || trip.date}} · {{trip.benchmark?.scope || 'Baseline history'}}</small>
                <div class="fuel-mini">
                  @if(trip.hasFuelEvidence){<span class="fuel-linked">Fuel linked</span>}
                  @if(trip.litres!=null){<span>{{trip.litres|number:'1.0-1'}} L recorded</span>}
                  @if(trip.excessLitres!=null){<span [class.fuel-over]="(trip.excessLitres||0)>0" [class.fuel-under]="(trip.excessLitres||0)<0">{{(trip.excessLitres||0)>0?'+':''}}{{trip.excessLitres|number:'1.0-1'}} L vs expected</span>}
                  @if(trip.extraKm!=null){<span class="distance-chip" [class.distance-over]="(trip.extraKm||0)>0" [class.distance-under]="(trip.extraKm||0)<0">{{(trip.extraKm||0)>0?'+':''}}{{trip.extraKm|number:'1.0-0'}} km vs expected route</span>}
                </div>
              </div>
              <div class="performance-number"><strong>{{trip.analysedKmL | number:'1.2-2'}} km/L</strong><span>{{trip.deviationPct | number:'1.1-1'}}%</span></div>
            </button>
          } @empty { <p class="muted">No poor/review records on this day.</p> }
        </article>
        <article class="content-card">
          <div class="section-title"><div><h2>Outstanding trucks</h2><p>Strong completed full-cycle results. Genuine poor historical cycles stay in the historical average.</p></div></div>
          @for (trip of dashboard.outstanding.slice(0,6); track trip.id) {
            <button class="performance-row positive" (click)="router.navigate(['/app/trips',trip.id])">
              <span class="rating-dot outstanding"></span>
              <div class="performance-main">
                <strong>{{trip.registration}} → {{trip.destination || 'all-route benchmark'}}</strong>
                <small>{{trip.benchmark?.sampleSize || 0}} previous full cycles · {{trip.rating}}</small>
                <div class="fuel-mini">
                  @if(trip.hasFuelEvidence){<span class="fuel-linked">Fuel linked</span>}
                  @if(trip.litres!=null){<span>{{trip.litres|number:'1.0-1'}} L recorded</span>}
                  @if(trip.excessLitres!=null){<span [class.fuel-over]="(trip.excessLitres||0)>0" [class.fuel-under]="(trip.excessLitres||0)<0">{{(trip.excessLitres||0)>0?'+':''}}{{trip.excessLitres|number:'1.0-1'}} L vs expected</span>}
                  @if(trip.extraKm!=null){<span class="distance-chip" [class.distance-over]="(trip.extraKm||0)>0" [class.distance-under]="(trip.extraKm||0)<0">{{(trip.extraKm||0)>0?'+':''}}{{trip.extraKm|number:'1.0-0'}} km vs expected route</span>}
                </div>
              </div>
              <div class="performance-number"><strong>{{trip.analysedKmL | number:'1.2-2'}} km/L</strong><span>+{{trip.deviationPct | number:'1.1-1'}}%</span></div>
            </button>
          } @empty { <p class="muted">No outstanding records on this day.</p> }
        </article>
      </section>

      <section class="home-card-grid compact-cards">
        <button class="home-card" (click)="router.navigate(['/app/analytics'])"><div class="home-card-top"><div class="round-icon" style="background:#66b9b6"><app-icon name="chart"></app-icon></div><h2>Trip Analytics</h2></div><div class="home-card-bottom">Compare complete full-to-full cycles against equivalent same-model trucks on the same destination, with exact-truck history alongside.</div></button>
        <button class="home-card" (click)="router.navigate(['/app/fleet'])"><div class="home-card-top"><div class="round-icon" style="background:#639fe0"><app-icon name="truck"></app-icon></div><h2>Fleet</h2></div><div class="home-card-bottom">{{dashboard.fleet?.activeTrucks || 0}} active trucks with historical performance profiles.</div></button>
        <button class="home-card" (click)="router.navigate(['/app/reports'])"><div class="home-card-top"><div class="round-icon" style="background:#72b486"><app-icon name="report"></app-icon></div><h2>Daily Report</h2></div><div class="home-card-bottom">Management ranking, exceptions, outstanding vehicles and CSV export.</div></button>
        <button class="home-card" (click)="router.navigate(['/app/admin'])"><div class="home-card-top"><div class="round-icon" style="background:#d78a3b"><app-icon name="gear"></app-icon></div><h2>Calibration</h2></div><div class="home-card-bottom">Adjust performance thresholds. Model-route ratings use weighted historical averages and keep genuine poor historical trips in the benchmark.</div></button>
      </section>
    } @else {
      <section class="content-card"><h2>Loading fuel analytics…</h2><p>{{message}}</p></section>
    }
  `,
  styles: [`
    .date-heading{align-items:flex-start;gap:18px}.date-controls{display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap;justify-content:flex-end}.date-step,.latest-btn{height:42px;border:1px solid #cfd4dc;background:#fff;padding:0 13px;border-radius:3px;font:inherit;cursor:pointer}.date-step:hover:not(:disabled),.latest-btn:hover:not(:disabled){background:#f2f4f7}.date-step:disabled,.latest-btn:disabled{opacity:.45;cursor:not-allowed}.date-picker{display:flex;flex-direction:column;gap:4px;font-size:11px;color:#707783;text-transform:uppercase;letter-spacing:.04em}.date-picker input{height:40px;border:1px solid #cfd4dc;border-radius:3px;padding:0 10px;font:inherit;color:#252a31;background:#fff}.date-loading{margin:8px 0 0;font-size:13px;color:#6f7682;display:flex;align-items:center;gap:8px}.mini-spinner{width:12px;height:12px;border:2px solid #d7dce4;border-top-color:#657083;border-radius:50%;display:inline-block;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.no-day-data{margin:12px 0 0;padding:10px 12px;background:#fff8e7;border-left:3px solid #c99a32;color:#65542d}.data-source-badge.live-db::after{content:' · precomputed';font-size:11px;opacity:.7}.coverage-line{margin-top:8px;font-size:12px;color:#6a7280;max-width:760px}.distance-day-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.distance-day-summary>div{background:#fff;border:1px solid #e0e4ea;padding:10px 12px;border-radius:4px}.distance-day-summary span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#747b86;margin-bottom:4px}.distance-day-summary strong{font-size:18px}.distance-day-summary .distance-alert{color:#a54842}.read-guide{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0 18px}.read-guide>div{border:1px solid #e0e4ea;background:#fff;padding:11px 12px;border-radius:4px;display:flex;flex-direction:column;gap:3px}.read-guide strong{font-size:12px}.read-guide span{font-size:11px;color:#747b86}.fuel-mini{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}.fuel-mini span{font-size:10px;padding:2px 6px;border-radius:10px;background:#f2f4f7;color:#5f6874}.fuel-mini .fuel-linked{background:#e9f4ef;color:#347257}.fuel-mini .fuel-over{background:#fbeceb;color:#a54842}.fuel-mini .fuel-under{background:#eaf5ee;color:#347257}.fuel-mini .distance-over{background:#fff1e6;color:#9b5a16}.fuel-mini .distance-under{background:#edf3fb;color:#466c9b}@media(max-width:800px){.read-guide,.distance-day-summary{grid-template-columns:1fr}}@media(max-width:1050px){.date-heading{display:block}.date-controls{justify-content:flex-start;margin-top:14px}}@media(max-width:620px){.date-step span{display:none}.date-picker{flex:1}.date-picker input{width:100%}}
  `]
})
export class HomeComponent {
  dashboard?: DailyAnalytics;
  message = 'Connecting to Express and the latest Stellar dataset.';
  changingDate = false;
  pendingDate: string | null = null;
  private requestVersion = 0;

  constructor(public router: Router, public data: MockDataService) { void this.load(); }

  get sourceLabel(): string {
    return this.data.health?.source === 'mongodb' ? 'MongoDB · latest database' : this.data.backendOnline ? 'Latest database cache · Mongo fallback' : 'Connecting…';
  }

  async load(date?: string): Promise<void> {
    const version = ++this.requestVersion;
    this.changingDate = Boolean(this.dashboard);
    this.pendingDate = date || null;
    try {
      const result = await this.data.dashboardSummary(date);
      if (version !== this.requestVersion) return;
      this.dashboard = result;
      this.message = '';
    } catch {
      if (version !== this.requestVersion) return;
      this.message = 'Could not load that date. The existing dashboard is still available; try the date again.';
    } finally {
      if (version === this.requestVersion) {
        this.changingDate = false;
        this.pendingDate = null;
      }
    }
  }

  get canGoPrevious(): boolean {
    return Boolean(this.dashboard?.navigation?.previousDate);
  }

  get canGoNext(): boolean {
    return Boolean(this.dashboard?.navigation?.nextDate);
  }

  async goPrevious(): Promise<void> {
    const date = this.dashboard?.navigation?.previousDate;
    if (date && this.canGoPrevious) await this.load(date);
  }

  async goNext(): Promise<void> {
    const date = this.dashboard?.navigation?.nextDate;
    if (date && this.canGoNext) await this.load(date);
  }

  async goLatest(): Promise<void> {
    const date = this.dashboard?.navigation?.latestCompleteDate;
    if (date) await this.load(date);
  }

  async chooseDate(event: Event): Promise<void> {
    const value = (event.target as HTMLInputElement).value;
    if (value) await this.load(value);
  }

  private shiftDate(value: string, days: number): string {
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return value;
    return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d));
  }
}
