import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TrailerSummary, TripAnalysis, TripWeightContext } from '../../core/models';
import { MockDataService } from '../../core/mock-data.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { IconComponent } from '../../shared/icon.component';

// V22 keeps the V21 readable dropdown layout but restores the detailed V20 investigation comparisons.
@Component({
 selector:'app-trip-detail',standalone:true,imports:[CommonModule,FormsModule,PageHeaderComponent,IconComponent],
 template:`
<app-page-header title="Trip Investigation" breadcrumb="trip analytics / investigation" icon="chart"></app-page-header>
@if(trip){
<section class="content-card investigation-actions no-print">
 <div><strong>Trip investigation · {{trip.registration}}</strong><p>Read the quick result first, then open only the evidence you need.</p></div>
 <div class="action-buttons"><button class="secondary-btn" (click)="router.navigate(['/app/analytics'],{queryParams:{registration:trip.registration}})">Back to Trip Analytics</button><button class="secondary-btn" (click)="openMonthlyHistory()">Monthly Fuel History</button><button class="primary-btn" (click)="printInvestigation()"><app-icon name="report"></app-icon> Print / PDF</button></div>
</section>

<section class="content-card trip-hero">
 <div class="profile-main"><div class="vehicle-avatar"><app-icon name="truck"></app-icon></div><div><span class="eyebrow">{{trip.startDate || trip.date}} → {{trip.endDate || trip.date}}</span><h2>{{trip.registration}}</h2><p>Stellar → {{trip.destination || 'Destination unavailable'}} → Stellar · {{trip.kilometers===null?'No distance':(trip.kilometers|number:'1.0-0')+' km'}} · {{trip.litres===null?'No fuel total':(trip.litres|number:'1.0-1')+' L'}}</p></div></div>
 <div class="trip-rating-panel"><span class="rating-badge large" [attr.data-rating]="trip.rating">{{trip.rating}}</span><strong>{{trip.analysedKmL===null?'—':(trip.analysedKmL|number:'1.2-2')}} km/L</strong><small>{{trip.deviationPct===null?'No benchmark yet':(((trip.deviationPct||0)>0?'+':'')+(trip.deviationPct|number:'1.1-1')+'% vs target')}}</small></div>
</section>

<details class="investigation-dropdown" open>
 <summary><div><strong>Quick read</strong><small>What happened on this trip?</small></div><span class="summary-value">{{trip.rating}} · {{trip.analysedKmL==null?'—':(trip.analysedKmL|number:'1.2-2')+' km/L'}}</span></summary>
 <div class="dropdown-body">
  <div class="plain-result" [attr.data-rating]="trip.rating"><app-icon [name]="trip.rating==='Poor'||trip.rating==='Review'?'alert':'check'"></app-icon><div><strong>{{plainSummaryTitle}}</strong><p>{{plainSummaryText}}</p></div></div>
  <div class="comparison-heading"><div><strong>What the truck did vs what it should have done</strong><small>The expected figures come from the current historical benchmark and, when entered, the trailer/product load adjustment.</small></div><span class="confidence-pill">{{trip.confidenceScore}}% confidence</span></div>
  <div class="actual-vs-expected-wrap"><table class="actual-vs-expected-table"><thead><tr><th>Measure</th><th>What it did</th><th>What it should have done</th><th>Difference</th><th>Interpretation</th></tr></thead><tbody>
   <tr><td><strong>Fuel efficiency</strong><small>Complete-cycle km/L</small></td><td>{{trip.analysedKmL==null?'—':(trip.analysedKmL|number:'1.2-2')+' km/L'}}</td><td>{{trip.loadAdjustedExpectedKmL==null?'—':(trip.loadAdjustedExpectedKmL|number:'1.2-2')+' km/L'}}</td><td><strong [class.negative]="(trip.deviationPct||0)<0" [class.positive-text]="(trip.deviationPct||0)>0">{{efficiencyGapKmL==null?'—':((efficiencyGapKmL>0?'+':'')+(efficiencyGapKmL|number:'1.2-2')+' km/L')}}@if(trip.deviationPct!=null){<small>{{(trip.deviationPct||0)>0?'+':''}}{{trip.deviationPct|number:'1.1-1'}}%</small>}</strong></td><td>{{efficiencyMeaning}}</td></tr>
   <tr><td><strong>Fuel used</strong><small>All counted top-ups + closing full-up</small></td><td>{{trip.litres==null?'—':(trip.litres|number:'1.0-1')+' L'}}</td><td>{{trip.expectedLitres==null?'—':(trip.expectedLitres|number:'1.0-1')+' L'}}</td><td><strong [class.negative]="(trip.excessLitres||0)>0" [class.positive-text]="(trip.excessLitres||0)<0">{{trip.excessLitres==null?'—':(((trip.excessLitres||0)>0?'+':'')+(trip.excessLitres|number:'1.0-1')+' L')}}@if(trip.fuelVariancePct!=null){<small>{{(trip.fuelVariancePct||0)>0?'+':''}}{{trip.fuelVariancePct|number:'1.1-1'}}%</small>}</strong></td><td>{{fuelVarianceMeaning}}</td></tr>
   <tr><td><strong>Distance</strong><small>Opening to closing odometer</small></td><td>{{trip.kilometers==null?'—':(trip.kilometers|number:'1.0-0')+' km'}}</td><td>{{trip.expectedDistanceKm==null?'—':(trip.expectedDistanceKm|number:'1.0-0')+' km'}}</td><td><strong [class.negative]="(trip.extraKm||0)>0">{{trip.extraKm==null?'—':(((trip.extraKm||0)>0?'+':'')+(trip.extraKm|number:'1.0-0')+' km')}}@if(trip.distanceVariancePct!=null){<small>{{(trip.distanceVariancePct||0)>0?'+':''}}{{trip.distanceVariancePct|number:'1.1-1'}}%</small>}</strong></td><td>{{distanceDifferenceMeaning}}</td></tr>
   @if(trip.googleRoadBenchmark?.available){<tr><td><strong>Google DRIVE road benchmark</strong><small>External road-distance context</small></td><td>{{trip.kilometers|number:'1.0-0'}} km actual</td><td>{{trip.googleRoadBenchmark?.benchmarkKm|number:'1.0-0'}} km</td><td><strong [class.negative]="(trip.googleRoadBenchmark?.varianceKm||0)>0">{{(trip.googleRoadBenchmark?.varianceKm||0)>0?'+':''}}{{trip.googleRoadBenchmark?.varianceKm|number:'1.0-0'}} km<small>{{(trip.googleRoadBenchmark?.variancePct||0)>0?'+':''}}{{trip.googleRoadBenchmark?.variancePct|number:'1.1-1'}}%</small></strong></td><td>Road-route benchmark only - investigate legitimate route, access and operational differences.</td></tr>}
   <tr><td><strong>Fuel rate</strong><small>Litres per 100 km</small></td><td>{{actualLPer100Km==null?'—':(actualLPer100Km|number:'1.2-2')+' L/100 km'}}</td><td>{{expectedLPer100Km==null?'—':(expectedLPer100Km|number:'1.2-2')+' L/100 km'}}</td><td><strong [class.negative]="(lPer100Gap||0)>0" [class.positive-text]="(lPer100Gap||0)<0">{{lPer100Gap==null?'—':(((lPer100Gap||0)>0?'+':'')+(lPer100Gap|number:'1.2-2')+' L/100 km')}}</strong></td><td>{{fuelRateMeaning}}</td></tr>
  </tbody></table></div>
  <div class="quick-grid detail-quick-grid">
   <div><span>Historical sample</span><strong>{{trip.benchmark?.sampleSize || 0}} trips</strong><small>{{trip.benchmark?.distinctTruckCount || 1}} comparable truck(s)</small></div>
   <div><span>Historical median</span><strong>{{trip.benchmark?.medianKmL==null?'—':(trip.benchmark?.medianKmL|number:'1.2-2')+' km/L'}}</strong><small>middle completed trip</small></div>
   <div><span>Source readings</span><strong>{{trip.sourceReadingCount || 0}}</strong><small>inside the complete fuel cycle</small></div>
   <div><span>Deliveries</span><strong>{{trip.deliveryCount || 0}}</strong><small>{{trip.intermediateTopUpCount || 0}} intermediate top-up(s)</small></div>
   <div><span>Performance index</span><strong>{{trip.performanceIndex==null?'—':(trip.performanceIndex|number:'1.0-1')+' / 100'}}</strong><small>supporting score</small></div>
   <div><span>Load adjustment</span><strong>{{trip.weight?.applied?'Applied':'Not applied'}}</strong><small>{{trip.weight?.applied?'trailer/product context included':'raw benchmark target'}}</small></div>
  </div>
 </div>
</details>

<details class="investigation-dropdown" open>
 <summary><div><strong>Historical benchmark</strong><small>Original simple benchmark view · same model + route where enough history exists</small></div><span class="summary-value">{{trip.benchmark?.averageKmL==null?'Baseline':(trip.benchmark?.averageKmL|number:'1.2-2')+' km/L avg'}}</span></summary>
 <div class="dropdown-body">
  @if(trip.benchmark){
   <div class="benchmark-meter"><div class="benchmark-track"><span class="benchmark-band" [style.left.%]="bandLeft" [style.width.%]="bandWidth"></span><span class="benchmark-marker" [style.left.%]="markerLeft"></span></div><div class="meter-labels"><span>{{meterMin|number:'1.2-2'}}</span><strong>{{trip.benchmark.scope}}</strong><span>{{meterMax|number:'1.2-2'}} km/L</span></div></div>
   <div class="benchmark-original-grid">
    <div><span>Weighted average</span><strong>{{trip.benchmark.averageKmL|number:'1.2-2'}} km/L</strong></div>
    <div><span>Historical median</span><strong>{{trip.benchmark.medianKmL|number:'1.2-2'}} km/L</strong></div>
    <div><span>Historical sample</span><strong>{{trip.benchmark.sampleSize}} trips</strong></div>
    <div><span>Comparable trucks</span><strong>{{trip.benchmark.distinctTruckCount || 1}}</strong></div>
    <div><span>Average trip distance</span><strong>{{trip.benchmark.averageDistanceKm==null?'—':(trip.benchmark.averageDistanceKm|number:'1.0-0')+' km'}}</strong></div>
    <div><span>Benchmark confidence</span><strong>{{trip.benchmark.confidence}}</strong></div>
   </div>
   <div class="benchmark-note"><app-icon name="info"></app-icon><div><strong>{{trip.benchmarkSelection==='model-route'?'Primary: same model + same route':'Primary: exact truck + same route fallback'}}</strong><p>{{trip.benchmark.method}}</p></div></div>
   <details class="inner-details benchmark-detail-panel"><summary>Show detailed benchmark evidence and comparisons</summary><div class="benchmark-detail-body">
    <div class="benchmark-original-grid detailed-benchmark-grid">
     <div><span>History window</span><strong>{{trip.benchmark.historyStartDate || 'Earliest'}} → {{trip.benchmark.historyEndDate || trip.startDate || trip.date}}</strong><small>{{trip.benchmark.historyMonths || 36}} month benchmark window</small></div>
     <div><span>Total historical distance</span><strong>{{trip.benchmark.totalDistanceKm==null?'—':(trip.benchmark.totalDistanceKm|number:'1.0-0')+' km'}}</strong><small>all comparable completed trips combined</small></div>
     <div><span>Total historical fuel</span><strong>{{trip.benchmark.totalLitres==null?'—':(trip.benchmark.totalLitres|number:'1.0-1')+' L'}}</strong><small>all comparable completed trips combined</small></div>
     <div><span>Simple trip mean</span><strong>{{trip.benchmark.arithmeticAverageKmL==null?'—':(trip.benchmark.arithmeticAverageKmL|number:'1.2-2')+' km/L'}}</strong><small>shown for reference; not the primary weighted benchmark</small></div>
     <div><span>Expected performance band</span><strong>{{trip.benchmark.lowKmL|number:'1.2-2'}} – {{trip.benchmark.highKmL|number:'1.2-2'}} km/L</strong><small>historical comparison range</small></div>
     <div><span>Current vs model average</span><strong [class.negative]="(modelGapPct||0)<0" [class.positive-text]="(modelGapPct||0)>0">{{modelGapPct==null?'—':(((modelGapPct||0)>0?'+':'')+(modelGapPct|number:'1.1-1')+'%')}}</strong><small>current full trip compared with pooled benchmark</small></div>
    </div>
    <div class="benchmark-explanation"><strong>Why weighted average + median are both useful</strong><p>The weighted average answers: “Across all comparable historical kilometres and litres, what fuel efficiency was actually achieved?” The median answers: “What did the typical completed trip achieve?” A genuinely poor historical trip remains in both datasets unless it is a verified data-quality problem.</p></div>
   </div></details>
   @if(trip.truckBenchmark){<details class="inner-details"><summary>This exact truck's own route history</summary><div class="mini-grid own-history-grid"><div><span>Own weighted average</span><strong>{{trip.truckBenchmark.averageKmL|number:'1.2-2'}} km/L</strong></div><div><span>Own median</span><strong>{{trip.truckBenchmark.medianKmL|number:'1.2-2'}} km/L</strong></div><div><span>Own prior trips</span><strong>{{trip.truckBenchmark.sampleSize}}</strong></div><div><span>Current vs own average</span><strong [class.negative]="(ownGapPct||0)<0" [class.positive-text]="(ownGapPct||0)>0">{{ownGapPct==null?'—':(((ownGapPct||0)>0?'+':'')+(ownGapPct|number:'1.1-1')+'%')}}</strong></div></div><div class="benchmark-explanation"><p>{{ownHistoryMeaning}}</p></div></details>}
  } @else {<p class="muted">Not enough comparable prior completed cycles are available yet. This trip remains Baseline rather than being forced into Good/Poor.</p>}
 </div>
</details>

<details class="investigation-dropdown" open>
 <summary><div><strong>Truck history · written summary</strong><small>A plain-English history for this vehicle and route</small></div><span class="summary-value">{{trip.modelLabel || trip.asset?.model || 'Truck history'}}</span></summary>
 <div class="dropdown-body story-copy">@for(p of truckStoryParagraphs;track p){<p>{{p}}</p>}<button class="secondary-btn no-print" (click)="openMonthlyHistory()">Open complete monthly fuel history</button></div>
</details>

<details class="investigation-dropdown">
 <summary><div><strong>How this full trip was calculated</strong><small>Opening full-up → route work / top-ups → closing full-up</small></div><span class="summary-value">{{trip.kilometers|number:'1.0-0'}} km ÷ {{trip.litres|number:'1.0-1'}} L</span></summary>
 <div class="dropdown-body">
  <div class="cycle-flow"><div><span>Opening full-up</span><strong>{{trip.startDate || trip.openingDate || trip.date}}</strong><small>{{trip.startFullUpLocation || trip.openingFillLocation || 'Stellar'}} · {{trip.startKm==null?'—':(trip.startKm|number:'1.0-0')}} km</small></div><b>→</b><div><span>Route / destination</span><strong>{{trip.destination || 'Unresolved'}}</strong><small>{{trip.deliveryCount || 0}} delivery record(s) · {{trip.intermediateTopUpCount || 0}} intermediate top-up(s)</small></div><b>→</b><div><span>Closing full-up</span><strong>{{trip.endDate || trip.closingDate || trip.date}}</strong><small>{{trip.closingFullUpLocation || trip.closingFillLocation || 'Stellar'}} · {{trip.endKm==null?'—':(trip.endKm|number:'1.0-0')}} km</small></div></div>
  <div class="quick-grid cycle-detail-grid"><div><span>Opening odometer</span><strong>{{trip.recentFuelHistory?.summary?.openingOdometer==null?(trip.startKm==null?'—':(trip.startKm|number:'1.0-0')):(trip.recentFuelHistory?.summary?.openingOdometer|number:'1.0-0')}}</strong></div><div><span>Closing odometer</span><strong>{{trip.recentFuelHistory?.summary?.closingOdometer==null?(trip.endKm==null?'—':(trip.endKm|number:'1.0-0')):(trip.recentFuelHistory?.summary?.closingOdometer|number:'1.0-0')}}</strong></div><div><span>Counted distance</span><strong>{{trip.kilometers==null?'—':(trip.kilometers|number:'1.0-0')+' km'}}</strong></div><div><span>Counted fuel</span><strong>{{trip.litres==null?'—':(trip.litres|number:'1.0-1')+' L'}}</strong></div><div><span>Fuel rate</span><strong>{{actualLPer100Km==null?'—':(actualLPer100Km|number:'1.2-2')+' L/100 km'}}</strong></div><div><span>Counted source rows</span><strong>{{trip.recentFuelHistory?.summary?.highlightedRecordCount || trip.sourceReadingCount || 0}}</strong></div></div>
  <div class="formula-box"><strong>{{trip.kilometers|number:'1.0-0'}} km ÷ {{trip.litres|number:'1.0-1'}} L = {{trip.analysedKmL|number:'1.2-2'}} km/L</strong><p>A low internal reading is never discarded. Every counted interval contributes its actual kilometres and litres. We do not equally average 2.9, 2.3, 0.8, etc. A 100 km interval only contributes its 100 km and the litres used over that 100 km.</p></div>
 </div>
</details>

<details class="investigation-dropdown" open>
 <summary><div><strong>Nearby fuel history</strong><small>Only a few records before and after this selected trip</small></div><span class="summary-value">{{historyWindowDescription}}</span></summary>
 <div class="dropdown-body">
  @if((trip.recentFuelHistory?.rows?.length || 0)>0){
   <div class="trip-contribution-legend"><span class="legend-green"></span><strong>Green = part of this selected full trip</strong><small>The starting boundary is green but its litres are excluded. Every later green fuel event is counted.</small></div>
   <div class="history-summary-grid compact-history-summary"><div><span>Opening odometer</span><strong>{{trip.recentFuelHistory?.summary?.openingOdometer==null?'—':(trip.recentFuelHistory?.summary?.openingOdometer|number:'1.0-0')}}</strong></div><div><span>Closing odometer</span><strong>{{trip.recentFuelHistory?.summary?.closingOdometer==null?'—':(trip.recentFuelHistory?.summary?.closingOdometer|number:'1.0-0')}}</strong></div><div><span>Counted fuel</span><strong>{{trip.recentFuelHistory?.summary?.dieselTotalLitres==null?'—':(trip.recentFuelHistory?.summary?.dieselTotalLitres|number:'1.0-1')+' L'}}</strong></div><div><span>Counted distance</span><strong>{{trip.recentFuelHistory?.summary?.kmTotal==null?'—':(trip.recentFuelHistory?.summary?.kmTotal|number:'1.0-0')+' km'}}</strong></div><div><span>Weighted result</span><strong>{{trip.recentFuelHistory?.summary?.vehicleConsumptionKmL==null?'—':(trip.recentFuelHistory?.summary?.vehicleConsumptionKmL|number:'1.2-2')+' km/L'}}</strong></div><div><span>Fuel rate</span><strong>{{trip.recentFuelHistory?.summary?.vehicleConsumptionLPer100Km==null?'—':(trip.recentFuelHistory?.summary?.vehicleConsumptionLPer100Km|number:'1.2-2')+' L/100 km'}}</strong></div></div>
   <div class="history-table-wrap"><table class="nearby-table detailed-nearby-table"><thead><tr><th>Date</th><th>Driver</th><th>Fill-up</th><th>Destination</th><th>Start KM</th><th>End KM</th><th>KM</th><th>Expected KM</th><th>Extra KM</th><th>Litres</th><th>Reading km/L</th><th>Trip contribution</th></tr></thead><tbody>
    @for(row of trip.recentFuelHistory?.rows || [];track row.id){<tr [class.trip-contributor-row]="row.contributesToCycle" [class.trip-opening-boundary-row]="row.isOpeningBoundary"><td>{{row.date}}</td><td>{{row.driver || '—'}}</td><td>{{row.fillUpLocation || '—'}}</td><td>{{row.destination || '—'}}</td><td>{{row.startKm==null?'—':(row.startKm|number:'1.0-0')}}</td><td>{{row.endKm==null?'—':(row.endKm|number:'1.0-0')}}</td><td>{{row.kilometers==null?'—':(row.kilometers|number:'1.0-0')+' km'}}</td><td>{{row.expectedDistanceKm==null?'—':(row.expectedDistanceKm|number:'1.0-0')+' km'}}</td><td><span class="history-distance-chip" [class.over]="(row.extraKm||0)>0" [class.under]="(row.extraKm||0)<0">{{row.extraKm==null?'—':(((row.extraKm||0)>0?'+':'')+(row.extraKm|number:'1.0-0')+' km')}}</span></td><td>{{row.litres==null?'—':(row.litres|number:'1.0-1')+' L'}}</td><td>{{row.consumptionKmL==null?'—':(row.consumptionKmL|number:'1.2-2')+' km/L'}}</td><td>@if(row.contributesToCycle){<span class="trip-contribution-chip" [class.boundary]="row.isOpeningBoundary" [class.counted]="row.countedFuel">{{row.isOpeningBoundary?'START BOUNDARY':'COUNTED'}}</span><small class="contribution-small">{{row.contributionRole}}@if(row.countedFuel){ · {{row.distanceSharePct|number:'1.1-1'}}% of trip km · {{row.fuelSharePct|number:'1.1-1'}}% of fuel}</small>} @else {<span class="trip-contribution-chip not-counted">NEARBY</span>}</td></tr>}
   </tbody></table></div>
   <div class="history-note"><app-icon name="info"></app-icon><span>This compact ledger deliberately shows only the selected cycle plus a few surrounding fuel records. For the full month, use Monthly Fuel History.</span></div>
   <button class="secondary-btn no-print" (click)="openMonthlyHistory()">View all {{monthlyHistoryMonth}} fuel records</button>
  } @else {<p class="muted">No nearby fuel evidence is available for this truck.</p>}
 </div>
</details>

<details class="investigation-dropdown">
 <summary><div><strong>Why was it rated this way?</strong><small>Detailed supporting calculations behind Good / Average / Review / Poor</small></div><span class="summary-value">{{trip.performanceIndex==null?'Supporting maths':(trip.performanceIndex|number:'1.0-1')+' / 100'}}</span></summary>
 <div class="dropdown-body">
  <div class="benchmark-note warning-note"><app-icon name="info"></app-icon><div><strong>Google DRIVE road-route benchmark</strong><p>@if(trip.googleRoadBenchmark?.available){Google Routes estimates {{trip.googleRoadBenchmark?.benchmarkKm|number:'1.0-0'}} km for the comparable DRIVE road route versus {{trip.kilometers|number:'1.0-0'}} km recorded by the full fuel cycle. }@else{Google road-route benchmark status: {{trip.googleRoadBenchmark?.status || 'not available'}}. }{{trip.googleRoadBenchmark?.disclaimer}}</p></div></div>
  <div class="benchmark-original-grid rating-detail-grid">
   <div><span>Source readings</span><strong>{{trip.sourceReadingCount || 0}}</strong><small>all source rows inside the full cycle</small></div>
   <div><span>Weighted trip result</span><strong>{{trip.calculatedKmL==null?'—':(trip.calculatedKmL|number:'1.2-2')+' km/L'}}</strong><small>total km ÷ total litres</small></div>
   <div><span>Target used for rating</span><strong>{{trip.loadAdjustedExpectedKmL==null?'—':(trip.loadAdjustedExpectedKmL|number:'1.2-2')+' km/L'}}</strong><small>{{trip.weight?.applied?'load adjusted':'historical raw target'}}</small></div>
   <div><span>Expected fuel</span><strong>{{trip.expectedLitres==null?'—':(trip.expectedLitres|number:'1.0-1')+' L'}}</strong><small>for the actual distance travelled</small></div>
   <div><span>Fuel variance</span><strong [class.negative]="(trip.excessLitres||0)>0" [class.positive-text]="(trip.excessLitres||0)<0">{{trip.excessLitres==null?'—':(((trip.excessLitres||0)>0?'+':'')+(trip.excessLitres|number:'1.0-1')+' L')}}</strong><small>{{fuelVarianceMeaning}}</small></div>
   <div><span>Performance index</span><strong>{{trip.performanceIndex==null?'—':(trip.performanceIndex|number:'1.0-1')+' / 100'}}</strong><small>supporting indicator, not a separate trip</small></div>
   <div><span>Valid poor history removed</span><strong>0</strong><small>real bad trips remain in historical average/median</small></div>
   <div><span>Data quality</span><strong>{{trip.likelyDataError?'Warning':'Accepted'}}</strong><small>{{trip.corrected?'source correction applied':'no correction required'}}</small></div>
  </div>
  @if(trip.corrected){<div class="benchmark-note"><app-icon name="check"></app-icon><div><strong>Automatic data correction used for analysis</strong><p>{{trip.correction}}. The original source value remains untouched.</p></div></div>}
  @if(trip.likelyDataError){<div class="benchmark-note warning-note"><app-icon name="alert"></app-icon><div><strong>Data-quality warning</strong><p>This cycle is treated cautiously because the source evidence appears unreliable. A data warning is not interpreted as exceptional driver performance.</p></div></div>}
  @if((trip.explanations?.length || 0)>0){<div class="explanation-list detailed-explanations">@for(e of trip.explanations;track e){<div><app-icon name="check"></app-icon><span>{{e}}</span></div>}</div>}
 </div>
</details>

<details class="investigation-dropdown">
 <summary><div><strong>Distance check</strong><small>Was the full cycle longer or shorter than normal?</small></div><span class="summary-value">{{trip.extraKm==null?'No benchmark':(((trip.extraKm||0)>0?'+':'')+(trip.extraKm|number:'1.0-0')+' km')}}</span></summary>
 <div class="dropdown-body">
  <div class="quick-grid"><div><span>Actual distance</span><strong>{{trip.kilometers==null?'—':(trip.kilometers|number:'1.0-0')+' km'}}</strong></div><div><span>Expected distance</span><strong>{{trip.expectedDistanceKm==null?'—':(trip.expectedDistanceKm|number:'1.0-0')+' km'}}</strong></div><div><span>Difference</span><strong>{{trip.extraKm==null?'—':(((trip.extraKm||0)>0?'+':'')+(trip.extraKm|number:'1.0-0')+' km')}}</strong></div><div><span>Status</span><strong>{{trip.distanceStatus || 'Unavailable'}}</strong></div></div>
  <div class="benchmark-note"><app-icon name="info"></app-icon><p>{{distanceInvestigationText}}</p></div>
 </div>
</details>

<details class="investigation-dropdown">
 <summary><div><strong>Truck, trailer & product load calculator</strong><small>Adjust the expected benchmark for the actual combination</small></div><span class="summary-value">{{trip.weight?.applied?'Load applied':'Optional'}}</span></summary>
 <div class="dropdown-body">
  <div class="calculator-start no-print">
   <label><span>1 · Weight unit</span><select [(ngModel)]="massUnit" (ngModelChange)="onMassUnitChange($event)"><option value="t">Tonnes (t)</option><option value="kg">Kilograms (kg)</option></select></label>
   <label><span>2 · Trailer number plate</span><select [(ngModel)]="context.trailerRegistration" (ngModelChange)="onTrailerChange($event)"><option value="">Select trailer</option>@for(t of trailers;track t.registration){<option [value]="t.registration">{{t.registration}} · {{t.description}}</option>}</select></label>
   <label><span>3 · Product</span><input [(ngModel)]="context.productName" placeholder="e.g. AN Prill / Emulsion"></label>
   <label><span>4 · Product weight ({{massUnit==='t'?'tonnes':'kg'}})</span><input type="number" min="0" step="0.1" [(ngModel)]="productWeightInput"></label>
  </div>
  <div class="tare-grid"><div><span>Truck tare</span><strong>{{autoTruckTareKg==null?'—':((autoTruckTareKg/1000)|number:'1.1-1')+' t'}}</strong><small>automatic from {{trip.registration}}</small></div><div><span>Trailer tare</span><strong>{{autoTrailerTareKg==null?'Select trailer':((autoTrailerTareKg/1000)|number:'1.1-1')+' t'}}</strong><small>{{selectedTrailer?.tareEstimateSource || 'fleet estimate'}}</small></div><div><span>Combination tare</span><strong>{{combinationTareKg==null?'—':((combinationTareKg/1000)|number:'1.1-1')+' t'}}</strong></div><div><span>Reference payload</span><strong>{{selectedReferencePayloadKg==null?'—':((selectedReferencePayloadKg/1000)|number:'1.1-1')+' t'}}</strong></div></div>
  <div class="calculator-secondary no-print"><label><span>Loaded distance (%)</span><input type="number" min="0" max="100" [(ngModel)]="context.loadedDistancePct"></label><label><span>Product remaining on return ({{massUnit==='t'?'t':'kg'}})</span><input type="number" min="0" step="0.1" [(ngModel)]="returnWeightInput"></label><label><span>Evidence source</span><select [(ngModel)]="context.evidenceSource"><option value="calculator">Estimated / calculator</option><option value="dispatch">Dispatch</option><option value="weighbridge">Weighbridge</option><option value="timeworx">TimeWorx</option><option value="verified-manual">Verified manual</option></select></label><label><span>Reference</span><input [(ngModel)]="context.sourceReference" placeholder="dispatch / weighbridge ref"></label></div>
  <button class="primary-btn recalc-btn no-print" [disabled]="!canRecalculate || recalculating" (click)="recalculate()">{{recalculating?'Recalculating…':'Recalculate trip performance'}}</button>
  <div class="calculator-impact"><div><strong>Calculation impact</strong><small>The measured trip never changes. The calculator only changes what this load should reasonably have achieved.</small></div></div>
  <div class="benchmark-original-grid calculator-result-grid"><div><span>Historical raw benchmark</span><strong>{{trip.benchmark?.averageKmL==null?'—':(trip.benchmark?.averageKmL|number:'1.2-2')+' km/L'}}</strong><small>unchanged historical result</small></div><div><span>Load-adjusted target</span><strong>{{trip.loadAdjustedExpectedKmL==null?'—':(trip.loadAdjustedExpectedKmL|number:'1.2-2')+' km/L'}}</strong><small>{{trip.weight?.applied?'current load applied':'same as raw benchmark until load is entered'}}</small></div><div><span>Actual full-trip result</span><strong>{{trip.analysedKmL==null?'—':(trip.analysedKmL|number:'1.2-2')+' km/L'}}</strong><small>measured; never manipulated</small></div><div><span>Expected fuel</span><strong>{{trip.expectedLitres==null?'—':(trip.expectedLitres|number:'1.0-1')+' L'}}</strong><small>for actual distance at target</small></div><div><span>Actual fuel</span><strong>{{trip.litres==null?'—':(trip.litres|number:'1.0-1')+' L'}}</strong><small>counted full-cycle fuel</small></div><div><span>Recalculated rating</span><strong><span class="rating-badge" [attr.data-rating]="trip.rating">{{trip.rating}}</span></strong><small>{{trip.deviationPct==null?'no benchmark':(((trip.deviationPct||0)>0?'+':'')+(trip.deviationPct|number:'1.1-1')+'% vs target')}}</small></div></div>
 </div>
</details>

<details class="investigation-dropdown">
 <summary><div><strong>Fuel & Loading Instruction evidence</strong><small>Where the fuel and destination evidence came from</small></div><span class="summary-value">{{trip.fuelAttributionConfidence || 'unknown'}} confidence</span></summary>
 <div class="dropdown-body">
  <div class="fuel-story compact-fuel-story"><div class="story-step"><span>1 · Counted fuel</span><strong>{{trip.litres==null?'—':(trip.litres|number:'1.0-1')+' L'}}</strong><small>all top-ups after opening boundary + closing full-up</small></div><div class="story-arrow">→</div><div class="story-step"><span>2 · Odometer movement</span><strong>{{trip.kilometers==null?'—':(trip.kilometers|number:'1.0-0')+' km'}}</strong><small>complete full-up cycle distance</small></div><div class="story-arrow">→</div><div class="story-step"><span>3 · Weighted result</span><strong>{{trip.analysedKmL==null?'—':(trip.analysedKmL|number:'1.2-2')+' km/L'}}</strong><small>{{actualLPer100Km==null?'':(actualLPer100Km|number:'1.2-2')+' L/100 km'}}</small></div></div>
  <div class="benchmark-original-grid fuel-evidence-grid"><div><span>Fuel source</span><strong>{{fuelSourceLabel}}</strong><small>{{trip.fuelInterval?.capturedBy ? 'captured by '+trip.fuelInterval?.capturedBy : 'linked source data'}}</small></div><div><span>Fuel-link confidence</span><strong>{{trip.fuelAttributionConfidence || 'unknown'}}</strong><small>{{fuelConfidenceMeaning}}</small></div><div><span>Source readings</span><strong>{{trip.sourceReadingCount || 0}}</strong><small>inside selected cycle</small></div><div><span>Loading Instructions</span><strong>{{trip.linkedLoadingInstructions?.length || 0}}</strong><small>route / destination evidence</small></div><div><span>Expected fuel</span><strong>{{trip.expectedLitres==null?'—':(trip.expectedLitres|number:'1.0-1')+' L'}}</strong><small>what the benchmark expected for this distance</small></div><div><span>Fuel difference</span><strong [class.negative]="(trip.excessLitres||0)>0" [class.positive-text]="(trip.excessLitres||0)<0">{{trip.excessLitres==null?'—':(((trip.excessLitres||0)>0?'+':'')+(trip.excessLitres|number:'1.0-1')+' L')}}</strong><small>{{fuelVarianceMeaning}}</small></div></div>
  @if((trip.linkedLoadingInstructions?.length || 0)>0){<div class="li-list">@for(li of trip.linkedLoadingInstructions;track li.loadingInstructionNo){<div class="li-row"><div><span>Loading Instruction</span><strong>{{li.loadingInstructionNo}}</strong><small>{{li.transactionDate || '—'}}</small></div><div><span>Route</span><strong>{{li.loadLocation || '—'}} → {{li.offloadLocation || '—'}}</strong><small>{{li.customerName || li.customerCode || '—'}}</small></div><div><span>Standing time</span><strong>{{li.totalStandingHours==null?'—':(li.totalStandingHours|number:'1.0-1')+' h'}}</strong></div></div>}</div>}
 </div>
</details>

<details class="investigation-dropdown">
 <summary><div><strong>Route & source evidence</strong><small>Technical audit trail</small></div><span class="summary-value">{{trip.destinationConfidence || 'unknown'}} destination confidence</span></summary>
 <div class="dropdown-body"><div class="benchmark-original-grid"><div><span>Destination</span><strong>{{trip.destination || 'Unavailable'}}</strong></div><div><span>Destination source</span><strong>{{trip.destinationSource}}</strong></div><div><span>Loading Instruction</span><strong>{{trip.loadingInstructionNo || 'Not matched'}}</strong></div><div><span>Route match</span><strong>{{trip.routeMatchConfidence}}</strong></div><div><span>Full-up anchors</span><strong>{{trip.startFullUpLocation || 'Stellar'}} → {{trip.closingFullUpLocation || 'Stellar'}}</strong></div><div><span>Analysis confidence</span><strong>{{trip.confidenceScore}}%</strong></div></div></div>
</details>

@if(message){<section class="content-card status-message"><p>{{message}}</p></section>}
} @else {
<section class="content-card loading-card"><h2>{{loading?'Loading trip…':'Trip could not be loaded'}}</h2><p>{{message || (loading?'Retrieving the selected full-trip investigation from the analytics API.':'The selected trip is unavailable.')}}</p>@if(!loading){<div class="button-row"><button class="secondary-btn" (click)="retry()">Retry</button><button class="secondary-btn" (click)="router.navigate(['/app/analytics'])">Back to Trip Analytics</button></div>}</section>
}
`,
 styles:[`
.investigation-actions{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:18px}.investigation-actions p{margin:4px 0 0;color:#69727e}.action-buttons{display:flex;gap:8px;flex-wrap:wrap}.action-buttons button{display:flex;align-items:center;gap:6px}.trip-hero{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-top:18px}.trip-hero h2{margin:2px 0}.trip-hero p{margin:0;color:#68717d}.trip-rating-panel{text-align:right}.trip-rating-panel strong{display:block;font-size:24px;margin-top:8px}.trip-rating-panel small{display:block;color:#747d88;margin-top:4px}
.investigation-dropdown{margin-top:14px;border:1px solid #d8dde4;background:#fff;box-shadow:0 1px 2px rgba(20,31,45,.03)}.investigation-dropdown>summary{list-style:none;cursor:pointer;padding:15px 18px;display:flex;justify-content:space-between;align-items:center;gap:16px;background:#f7f8fa}.investigation-dropdown>summary::-webkit-details-marker{display:none}.investigation-dropdown>summary:after{content:'▾';font-size:18px;color:#6f7884;transition:transform .15s}.investigation-dropdown:not([open])>summary:after{transform:rotate(-90deg)}.investigation-dropdown>summary div{flex:1}.investigation-dropdown>summary strong{display:block;font-size:16px}.investigation-dropdown>summary small{display:block;color:#737c88;margin-top:3px}.summary-value{font-size:12px;font-weight:700;color:#596574;background:#fff;border:1px solid #dbe0e6;padding:6px 9px;border-radius:14px;white-space:nowrap}.dropdown-body{padding:17px 18px}.plain-result{display:flex;gap:11px;padding:14px;border-left:5px solid #7b8593;background:#f7f8fa}.plain-result[data-rating="Poor"]{border-left-color:#b9504a;background:#fbf0ef}.plain-result[data-rating="Review"]{border-left-color:#bc8b2d;background:#fcf7eb}.plain-result[data-rating="Good"],.plain-result[data-rating="Outstanding"]{border-left-color:#4e8a61;background:#eef7f1}.plain-result p{margin:4px 0 0;color:#5d6672;line-height:1.45}
.quick-grid,.benchmark-original-grid,.tare-grid,.calculator-start,.calculator-secondary,.mini-grid{display:grid;gap:10px}.quick-grid{grid-template-columns:repeat(6,minmax(0,1fr));margin-top:13px}.benchmark-original-grid{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:14px}.quick-grid>div,.benchmark-original-grid>div,.tare-grid>div,.mini-grid>div{border:1px solid #dfe3e8;background:#f8f9fb;padding:12px}.quick-grid span,.benchmark-original-grid span,.tare-grid span,.calculator-start span,.calculator-secondary span,.mini-grid span{display:block;font-size:11px;text-transform:uppercase;color:#737b87;margin-bottom:5px}.quick-grid strong,.benchmark-original-grid strong,.tare-grid strong,.mini-grid strong{font-size:16px}.quick-grid small,.benchmark-original-grid small,.tare-grid small{display:block;color:#7b8390;margin-top:4px}.negative{color:#a54842}.positive-text{color:#347257}
.benchmark-meter{margin:5px 0 12px}.benchmark-track{position:relative;height:12px;background:#edf0f3;border-radius:10px}.benchmark-band{position:absolute;top:0;bottom:0;background:#dce7df;border-radius:10px}.benchmark-marker{position:absolute;top:-5px;width:3px;height:22px;background:#4d5868}.meter-labels{display:flex;justify-content:space-between;gap:10px;margin-top:7px;font-size:11px;color:#717a86}.meter-labels strong{text-align:center;color:#4e5866}.benchmark-note,.history-note{display:flex;gap:10px;align-items:flex-start;margin-top:13px;padding:12px;background:#f3f6f9;border-left:4px solid #687b91;color:#586473}.benchmark-note p,.history-note p{margin:3px 0 0;line-height:1.45}.inner-details{margin-top:13px;border:1px solid #dfe3e8}.inner-details summary{cursor:pointer;padding:11px 13px;font-weight:600}.inner-details .mini-grid{padding:0 13px 13px;grid-template-columns:repeat(3,minmax(0,1fr))}.story-copy p{line-height:1.55;color:#505b68;margin:0 0 12px}.story-copy button{margin-top:4px}
.cycle-flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:12px;align-items:center}.cycle-flow>div{border:1px solid #dfe3e8;background:#f8f9fb;padding:13px}.cycle-flow span{display:block;font-size:11px;text-transform:uppercase;color:#737b87;margin-bottom:5px}.cycle-flow small{display:block;color:#7b8390;margin-top:4px}.cycle-flow b{color:#89919b}.formula-box{margin-top:13px;padding:14px;background:#f4f7fa;border-left:5px solid #65798f}.formula-box strong{font-size:18px}.formula-box p{margin:6px 0 0;color:#596472;line-height:1.45}
.trip-contribution-legend{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:13px;padding:11px 13px;background:#f3f8f4;border:1px solid #cfe2d3;border-left:5px solid #4e8a61}.trip-contribution-legend small{flex-basis:100%;margin-left:21px;color:#617068}.legend-green{width:12px;height:12px;border-radius:2px;background:#dff1e4;border:1px solid #7eb08a}.history-table-wrap{overflow:auto;border:1px solid #dfe3e8}.nearby-table{width:100%;min-width:1050px;border-collapse:collapse;font-size:12px}.nearby-table th{background:#eef1f5;text-align:left;padding:9px;border-bottom:1px solid #cfd5dd;white-space:nowrap}.nearby-table td{padding:9px;border-bottom:1px solid #e5e8ec;white-space:nowrap}.trip-contributor-row{background:#e9f6ec!important}.trip-opening-boundary-row{border-top:2px solid #7cad87}.trip-contributor-row td:first-child{box-shadow:inset 5px 0 0 #4e8a61}.trip-contribution-chip{display:inline-block;padding:4px 7px;border-radius:10px;font-size:10px;font-weight:700;text-transform:uppercase}.trip-contribution-chip.counted{background:#cfead6;color:#28653b}.trip-contribution-chip.boundary{background:#dcefe0;color:#356e45}.trip-contribution-chip.not-counted{background:#eef1f4;color:#747d88}.contribution-small{display:block;margin-top:4px;color:#5e6c63;white-space:normal;min-width:150px}.history-note{margin-bottom:12px}
.calculator-start{grid-template-columns:.8fr 1.6fr 1.1fr 1fr}.calculator-secondary{grid-template-columns:repeat(4,minmax(0,1fr));margin-top:12px}.calculator-start label,.calculator-secondary label{display:block}.calculator-start select,.calculator-start input,.calculator-secondary select,.calculator-secondary input{width:100%;min-height:42px;box-sizing:border-box}.tare-grid{grid-template-columns:repeat(4,minmax(0,1fr));margin:13px 0}.recalc-btn{margin-top:13px}.recalc-btn:disabled{opacity:.5}.result-grid{grid-template-columns:repeat(4,minmax(0,1fr));margin-top:15px}.li-list{margin-top:14px}.li-row{display:grid;grid-template-columns:150px 1fr 150px;gap:12px;padding:11px 0;border-top:1px solid #e1e5ea}.li-row span{display:block;font-size:11px;text-transform:uppercase;color:#737b87;margin-bottom:4px}.li-row small{display:block;color:#7b8390;margin-top:4px}.status-message{margin-top:14px}.loading-card{margin-top:18px}
.comparison-heading{display:flex;justify-content:space-between;align-items:center;gap:14px;margin:16px 0 9px;padding-top:4px}.comparison-heading strong{font-size:16px}.comparison-heading small{display:block;color:#747d88;margin-top:3px}.confidence-pill{display:inline-block;border:1px solid #d5dbe2;background:#f5f7f9;padding:6px 9px;border-radius:14px;font-size:11px;color:#5e6875;white-space:nowrap}.actual-vs-expected-wrap{overflow:auto;border:1px solid #dfe3e8}.actual-vs-expected-table{width:100%;min-width:900px;border-collapse:collapse;font-size:12px}.actual-vs-expected-table th{padding:10px;background:#eef1f5;text-align:left;border-bottom:1px solid #ccd3dc}.actual-vs-expected-table td{padding:11px;border-bottom:1px solid #e3e7eb;vertical-align:top}.actual-vs-expected-table td:first-child{background:#fafbfc;width:170px}.actual-vs-expected-table small{display:block;color:#7a838f;margin-top:4px}.detail-quick-grid{margin-top:13px}.benchmark-detail-panel summary{background:#fafbfc}.benchmark-detail-body{padding:0 13px 13px}.detailed-benchmark-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.benchmark-explanation{margin-top:12px;padding:12px 14px;background:#f8f9fb;border:1px solid #e0e4e9;color:#596472}.benchmark-explanation p{margin:5px 0 0;line-height:1.45}.own-history-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}.cycle-detail-grid{margin-top:13px}.history-summary-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:13px}.history-summary-grid>div{border:1px solid #dfe3e8;background:#f8f9fb;padding:11px}.history-summary-grid span{display:block;font-size:11px;text-transform:uppercase;color:#737b87;margin-bottom:5px}.history-summary-grid strong{font-size:15px}.detailed-nearby-table{min-width:1450px}.history-distance-chip{display:inline-block;padding:4px 7px;border-radius:10px;background:#f0f2f4;color:#66717d}.history-distance-chip.over{background:#f7e9e7;color:#9a4d47}.history-distance-chip.under{background:#eaf3ed;color:#3d7550}.rating-detail-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.warning-note{border-left-color:#b4832e;background:#fbf6ea}.explanation-list{margin-top:13px}.explanation-list>div{display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-top:1px solid #e4e8ec;color:#56616e}.calculator-impact{margin-top:15px;padding:11px 13px;background:#f4f7fa;border-left:4px solid #65798f}.calculator-impact small{display:block;color:#6f7884;margin-top:3px}.calculator-result-grid{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:12px}.fuel-story{display:flex;align-items:stretch;gap:10px;margin-bottom:13px}.story-step{flex:1;border:1px solid #dfe3e8;background:#f8f9fb;padding:12px}.story-step span{display:block;font-size:11px;text-transform:uppercase;color:#737b87;margin-bottom:5px}.story-step strong{font-size:16px}.story-step small{display:block;color:#7b8390;margin-top:4px}.story-arrow{align-self:center;color:#89919b;font-weight:700}.fuel-evidence-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
@media(max-width:1000px){.quick-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.benchmark-original-grid,.detailed-benchmark-grid,.rating-detail-grid,.calculator-result-grid,.fuel-evidence-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.history-summary-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.calculator-start,.calculator-secondary,.tare-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cycle-flow{grid-template-columns:1fr}.cycle-flow b{transform:rotate(90deg);justify-self:center}.li-row{grid-template-columns:1fr 1fr}.fuel-story{display:grid;grid-template-columns:1fr}.story-arrow{transform:rotate(90deg);justify-self:center}}
@media(max-width:700px){.investigation-actions,.trip-hero,.comparison-heading{display:block}.action-buttons{margin-top:12px;flex-direction:column}.action-buttons button{width:100%;justify-content:center}.trip-rating-panel{text-align:left;margin-top:14px}.investigation-dropdown>summary{align-items:flex-start}.summary-value{white-space:normal;text-align:right}.confidence-pill{margin-top:8px}.quick-grid,.benchmark-original-grid,.calculator-start,.calculator-secondary,.tare-grid,.mini-grid,.result-grid,.detailed-benchmark-grid,.rating-detail-grid,.calculator-result-grid,.fuel-evidence-grid,.history-summary-grid,.own-history-grid{grid-template-columns:1fr!important}.li-row{grid-template-columns:1fr}}
@media print{.no-print{display:none!important}.investigation-dropdown{break-inside:avoid}.investigation-dropdown>summary:after{display:none}.investigation-dropdown:not([open])>.dropdown-body{display:block!important}.dropdown-body{display:block!important}.summary-value{border:0}.trip-hero{margin-top:0}}
 `]
})
export class TripDetailComponent{
 trip?:TripAnalysis;
 trailers:TrailerSummary[]=[];
 context:TripWeightContext={trailerRegistration:'',productName:'',truckTareKg:null,trailerTareKg:null,outboundProductKg:null,returnProductKg:0,loadedDistancePct:50,referenceGrossKg:null,confirmed:false,evidenceSource:'calculator',sourceReference:'',notes:'',massInputUnit:'t'};
 message=''; loading=true; historyLoading=false; historyMessage=''; currentId=''; printGeneratedAt=''; recalculating=false;
 massUnit:'t'|'kg'='t'; private previousMassUnit:'t'|'kg'='t'; productWeightInput:number|null=null; returnWeightInput:number|null=0;
 private loadVersion=0;
 constructor(private route:ActivatedRoute,public router:Router,public data:MockDataService){
   this.route.paramMap.subscribe(params=>{this.currentId=params.get('id')||'';void this.load(this.currentId);});
 }

 async load(id=this.currentId){
   const version=++this.loadVersion;
   this.loading=true; this.historyLoading=false; this.historyMessage=''; this.message=''; this.trip=undefined;
   if(!id){this.loading=false;this.message='No trip id was supplied. Return to Trip Analytics and select a trip again.';return;}
   try{
     const trip=await this.data.trip(id);
     if(version!==this.loadVersion)return;
     this.trip=trip;
     this.context={...this.context,...(trip.weight||{})};
     this.massUnit=(this.context.massInputUnit==='kg'?'kg':'t');
     this.previousMassUnit=this.massUnit;
     this.context.truckTareKg=this.autoTruckTareKg;
     this.syncWeightInputsFromContext();
     this.loading=false;
     await this.loadTrailers();
   }catch{
     if(version!==this.loadVersion)return;
     this.loading=false;
     this.message='Trip could not be loaded. The single-request Trip Investigation loader is still active, but the API did not return this trip. Click Retry.';
   }
 }

 retry(){void this.load(this.currentId);}
 retryHistory(){void this.load(this.currentId);}
 printInvestigation(){if(!this.trip)return;this.printGeneratedAt=new Date().toLocaleString('en-ZA');setTimeout(()=>window.print(),50);}

 async loadTrailers(){
   try{
     this.trailers=await this.data.trailers();
     if(this.context.trailerRegistration)this.onTrailerChange(this.context.trailerRegistration,false);
   }catch{this.trailers=[];}
 }

 private toKg(value:number|null|undefined, unit:'t'|'kg'=this.massUnit){
   if(value===null||value===undefined)return null; const n=Number(value); if(!Number.isFinite(n))return null; return unit==='t'?n*1000:n;
 }
 private fromKg(value:number|null|undefined, unit:'t'|'kg'=this.massUnit){
   if(value===null||value===undefined)return null; const n=Number(value); if(!Number.isFinite(n))return null; return unit==='t'?n/1000:n;
 }
 private syncWeightInputsFromContext(){
   this.productWeightInput=this.fromKg(this.context.outboundProductKg,this.massUnit);
   this.returnWeightInput=this.fromKg(this.context.returnProductKg??0,this.massUnit) ?? 0;
 }
 onMassUnitChange(unit:'t'|'kg'){
   const productKg=this.toKg(this.productWeightInput,this.previousMassUnit);
   const returnKg=this.toKg(this.returnWeightInput,this.previousMassUnit);
   this.massUnit=unit; this.context.massInputUnit=unit;
   this.productWeightInput=this.fromKg(productKg,unit);
   this.returnWeightInput=this.fromKg(returnKg,unit) ?? 0;
   this.previousMassUnit=unit;
 }
 onTrailerChange(reg:string|null|undefined, syncInput=true){
   this.context.trailerRegistration=String(reg||'').trim().toUpperCase();
   const t=this.selectedTrailer;
   if(syncInput || !(Number(this.context.trailerTareKg)>0))this.context.trailerTareKg=t?.estimatedTareKg??null;
   this.context.truckTareKg=this.autoTruckTareKg;
   if(syncInput && !this.context.evidenceSource)this.context.evidenceSource='calculator';
 }

 async recalculate(){
   if(!this.trip || !this.canRecalculate)return;
   this.recalculating=true; this.message='';
   try{
     const productKg=this.toKg(this.productWeightInput);
     const returnKg=this.toKg(this.returnWeightInput) ?? 0;
     this.context={
       ...this.context,
       trailerRegistration:this.selectedTrailer?.registration || this.context.trailerRegistration || '',
       truckTareKg:this.autoTruckTareKg,
       trailerTareKg:this.autoTrailerTareKg,
       outboundProductKg:productKg,
       returnProductKg:returnKg,
       loadedDistancePct:Number.isFinite(Number(this.context.loadedDistancePct))?Math.max(0,Math.min(100,Number(this.context.loadedDistancePct))):50,
       referencePayloadKg:this.selectedReferencePayloadKg,
       massInputUnit:this.massUnit,
       evidenceSource:this.context.evidenceSource||'calculator',
       confirmed:['timeworx','dispatch','weighbridge','verified-manual'].includes(String(this.context.evidenceSource||'').toLowerCase()) && !!String(this.context.sourceReference||'').trim()
     };
     await this.data.saveTripContext(this.trip.id,this.context);
     await this.load(this.currentId);
     this.message='Trip recalculated. The page now uses the selected trailer, automatic truck/trailer tare and entered product mass.';
     setTimeout(()=>window.scrollTo({top:0,behavior:'smooth'}),50);
   }catch{
     this.message='Could not recalculate this trip. Check the trailer selection, product weight and API connection.';
   }finally{this.recalculating=false;}
 }

 get selectedTrailer(){const reg=(this.context.trailerRegistration||'').toUpperCase();return this.trailers.find(t=>t.registration.toUpperCase()===reg);}
 get selectedPermitCapacityKg(){const vals=(this.selectedTrailer?.permits||[]).map(p=>Number(p.permissibleWeightKgParsed)).filter(v=>Number.isFinite(v)&&v>=5000&&v<=50000);return vals.length?Math.max(...vals):this.trip?.trailerEvidence?.permitCapacityKg??null;}
 get selectedReferencePayloadKg(){return this.selectedTrailer?.referencePayloadKg ?? this.selectedPermitCapacityKg ?? this.trip?.weight?.referencePayloadKg ?? 30000;}
 get autoTruckTareKg(){const saved=Number(this.context.truckTareKg);if(Number.isFinite(saved)&&saved>0)return saved;const est=Number(this.trip?.asset?.estimatedTareKg);return Number.isFinite(est)&&est>0?est:null;}
 get autoTrailerTareKg(){const selected=Number(this.selectedTrailer?.estimatedTareKg);if(Number.isFinite(selected)&&selected>0)return selected;const saved=Number(this.context.trailerTareKg);return Number.isFinite(saved)&&saved>0?saved:null;}
 get combinationTareKg(){return this.autoTruckTareKg!=null&&this.autoTrailerTareKg!=null?this.autoTruckTareKg+this.autoTrailerTareKg:null;}
 get canRecalculate(){return !!this.selectedTrailer&&this.autoTruckTareKg!=null&&this.autoTrailerTareKg!=null&&this.toKg(this.productWeightInput)!=null&&Number(this.productWeightInput)>=0;}

 get fuelSourceLabel(){const v=this.trip?.fuelSourceConfirmation||'';if(v==='tank_report_exact_match')return 'Detailed report + tank report';if(v==='tank_report_daily_total_match')return 'Detailed report + daily tank total';if(v==='diesel_detailed_report_only')return 'Diesel detailed report';if(v==='historical_fuel_entry_exact_match')return 'Historical consumption + exact fuel-entry match';if(v==='historical_fuel_entry_match')return 'Historical consumption + matched fuel entry';if(v==='historical_consumption_report_only')return 'Historical vehicle-consumption report';return v||'Unavailable';}
 get plainSummaryTitle(){if(!this.trip)return '';if(this.trip.rating==='Baseline')return 'Completed trip recorded — building the same-route baseline.';if(this.trip.rating==='Data Warning')return 'This full trip needs a data check before judging performance.';if(this.trip.excessLitres==null)return this.trip.rating==='Poor'||this.trip.rating==='Review'?'Performance is below the available benchmark.':'Performance is within or above the available benchmark.';const l=Math.abs(this.trip.excessLitres);if(this.trip.excessLitres>0)return `About ${l.toFixed(1)} L more fuel than expected.`;if(this.trip.excessLitres<0)return `About ${l.toFixed(1)} L less fuel than expected.`;return 'Fuel use is almost exactly on the expected level.';}
 get plainSummaryText(){if(!this.trip)return '';const scope=this.trip.benchmark?.scope||'the available same-truck/same-destination history';const conf=this.trip.confidenceScore;const distance=this.trip.extraKm==null?'':` The complete trip was ${Math.abs(this.trip.extraKm).toFixed(0)} km ${this.trip.extraKm>0?'longer':'shorter'} than its distance benchmark.`;const load=this.trip.weight?.applied?` The expected efficiency has been load-adjusted to ${Number(this.trip.loadAdjustedExpectedKmL||0).toFixed(2)} km/L using the selected trailer and product mass.`:'';return `The truck recorded ${this.trip.analysedKmL==null?'no valid efficiency':this.trip.analysedKmL.toFixed(2)+' km/L'} and was compared with ${scope}.${load}${distance} Analysis confidence is ${conf}%. Individual readings inside the cycle were not scored.`;}
 get fuelRecordMeaning(){return 'all top-ups after the starting full-up through the closing full-up';}
 get fuelVarianceMeaning(){if(this.trip?.excessLitres==null)return 'not enough information';if(this.trip.excessLitres>0)return 'more fuel than the load-adjusted benchmark expected';if(this.trip.excessLitres<0)return 'less fuel than the load-adjusted benchmark expected';return 'almost exactly as expected';}
 get fuelConfidenceMeaning(){return 'confidence that the source fuel events belong to this completed full-up cycle';}
 get fuelPanelExplanation(){return 'Full-to-full fuel accounting: the starting full-up establishes the tank baseline; intermediate top-ups and the closing Stellar full-up are summed into one fuel total.';}
 get fuelEventLabel(){const f=this.trip?.fuelInterval;if(!f)return '';return `${f.startDate} → ${f.nextFuelDate} · ${this.trip?.cycleFuelEventCount || 0} counted fuel event(s)`;}
 get distanceDifferenceMeaning(){const x=this.trip?.extraKm;if(x==null)return 'not enough route history';if(x>0)return 'more kilometres than the normal route distance';if(x<0)return 'fewer kilometres than the normal route distance';return 'matches the expected route distance';}
 get distanceInvestigationText(){const d=this.trip?.distanceBenchmark;if(!d)return 'Not enough prior completed same-truck/same-destination full trips for a distance benchmark.';const diff=Math.abs(d.extraKm||0).toFixed(0);if((d.extraKm||0)>0)return `This complete full trip is about ${diff} km longer than the truck’s normal completed trip to this destination. Check legitimate route changes, extra runs or diversions; distance alone does not make the fuel score Poor.`;if((d.extraKm||0)<0)return `This complete full trip is about ${diff} km shorter than the truck’s prior trips to this destination. Confirm the cycle boundaries and route work.`;return 'The full-trip distance is in line with this truck’s prior completed trips to the same destination.';}
 get meterMin(){if(!this.trip?.benchmark)return 0;return Math.max(.1,Math.min(this.trip.benchmark.lowKmL,this.trip.analysedKmL||this.trip.benchmark.lowKmL)*.8);}
 get meterMax(){if(!this.trip?.benchmark)return 5;return Math.max(this.trip.benchmark.highKmL,this.trip.analysedKmL||0)*1.2;}
 pct(v:number|null|undefined){if(v==null)return 50;return Math.max(0,Math.min(100,((v-this.meterMin)/(this.meterMax-this.meterMin))*100));}
 get bandLeft(){return this.pct(this.trip?.benchmark?.lowKmL);}
 get bandWidth(){return Math.max(2,this.pct(this.trip?.benchmark?.highKmL)-this.bandLeft);}
 get markerLeft(){return this.pct(this.trip?.analysedKmL);}
 get efficiencyGapKmL(){const a=this.trip?.analysedKmL,e=this.trip?.loadAdjustedExpectedKmL;if(a==null||e==null)return null;return a-e;}
 get actualLPer100Km(){const k=this.trip?.analysedKmL;if(k==null||k<=0)return null;return 100/k;}
 get expectedLPer100Km(){const k=this.trip?.loadAdjustedExpectedKmL;if(k==null||k<=0)return null;return 100/k;}
 get lPer100Gap(){const a=this.actualLPer100Km,e=this.expectedLPer100Km;if(a==null||e==null)return null;return a-e;}
 get modelGapPct(){const a=this.trip?.analysedKmL,b=this.trip?.benchmark?.averageKmL;if(a==null||b==null||b===0)return null;return ((a-b)/b)*100;}
 get ownGapPct(){const a=this.trip?.analysedKmL,b=this.trip?.truckBenchmark?.averageKmL;if(a==null||b==null||b===0)return null;return ((a-b)/b)*100;}
 get efficiencyMeaning(){const d=this.trip?.deviationPct;if(d==null)return 'No reliable expected efficiency is available yet.';if(d<=-15)return 'Materially below target — investigate fuel use, route, load and mechanical condition.';if(d<=-7.5)return 'Below target — worth reviewing against the supporting evidence.';if(d>=10)return 'Well above the expected target for this comparable history.';if(d>=4)return 'Better than the expected target.';return 'Close to the expected target.';}
 get fuelRateMeaning(){const d=this.lPer100Gap;if(d==null)return 'No expected fuel rate available.';if(d>0)return 'Used more litres per 100 km than expected.';if(d<0)return 'Used fewer litres per 100 km than expected.';return 'Matched the expected fuel rate.';}
 get ownHistoryMeaning(){const g=this.ownGapPct,m=this.modelGapPct;if(g==null)return 'Not enough exact-truck history is available for a second comparison.';if(m!=null && g>=-4 && m<=-7.5)return 'This trip is close to this truck’s own normal history but worse than equivalent trucks. That can reveal a truck that has been consistently inefficient over time.';if(g<=-7.5 && (m==null||m<=-7.5))return 'This trip is worse than both the truck’s own history and the pooled equivalent-truck benchmark, which strengthens the case that this specific trip needs investigation.';if(g<=-7.5 && m!=null && m>-7.5)return 'This trip is worse than this truck’s own normal history, but still close to equivalent trucks. The truck may historically have been stronger than the peer group.';return 'This exact-truck comparison is secondary evidence; the pooled same-model/same-route benchmark remains the primary performance reference when enough comparable trucks exist.';}

 openMonthlyHistory(){if(!this.trip)return;void this.router.navigate(['/app/fuel-history'],{queryParams:{registration:this.trip.registration,month:this.monthlyHistoryMonth}});}
 get monthlyHistoryMonth(){const d=this.trip?.endDate||this.trip?.date||new Date().toISOString().slice(0,10);return String(d).slice(0,7);}
 get historyWindowDescription(){const rows=this.trip?.recentFuelHistory?.rows||[];if(!rows.length)return 'No nearby fuel rows';const highlighted=rows.filter(r=>r.contributesToCycle).length;const outside=Math.max(0,rows.length-highlighted);return `${highlighted} selected-trip row(s) + ${outside} nearby row(s)`;}
 get truckStoryParagraphs(){
   const t=this.trip;if(!t)return [] as string[];
   const model=t.modelLabel||[t.asset?.manufacturer,t.asset?.model].filter(Boolean).join(' ')||'fleet model unavailable';
   const start=t.startDate||t.openingDate||t.date;const end=t.endDate||t.closingDate||t.date;
   const route=t.destination||t.routeLabel||'an unresolved destination';
   const km=t.kilometers==null?'an unknown distance':`${Math.round(t.kilometers).toLocaleString('en-ZA')} km`;
   const litres=t.litres==null?'an unknown fuel total':`${Number(t.litres).toLocaleString('en-ZA',{maximumFractionDigits:1})} L`;
   const result=t.analysedKmL==null?'no valid full-trip efficiency':`${t.analysedKmL.toFixed(2)} km/L`;
   const out:string[]=[];
   out.push(`${t.registration} (${model}) completed the selected fuel cycle from ${start} to ${end}, travelling ${km} and using ${litres}. The weighted full-trip result is ${result}; individual fuel rows inside the cycle are not averaged equally.`);
   if(t.benchmark){const b=t.benchmark;out.push(`For ${route}, the primary historical benchmark uses ${b.sampleSize} prior completed comparable cycle(s)${(b.distinctTruckCount||0)>1?` across ${b.distinctTruckCount} equivalent trucks`:''}. Their distance/fuel-weighted average is ${b.averageKmL.toFixed(2)} km/L and their median completed-trip result is ${b.medianKmL.toFixed(2)} km/L.`);}
   if(t.truckBenchmark){out.push(`Looking only at ${t.registration}'s own previous trips on this route, ${t.truckBenchmark.sampleSize} prior cycle(s) produce a weighted average of ${t.truckBenchmark.averageKmL.toFixed(2)} km/L and a median of ${t.truckBenchmark.medianKmL.toFixed(2)} km/L. This helps show whether the truck itself has historically differed from equivalent vehicles.`);}
   if(t.deviationPct!=null){const d=Math.abs(t.deviationPct).toFixed(1);out.push(`This selected trip is ${d}% ${t.deviationPct<0?'below':'above'} the current expected target and is rated ${t.rating}. ${t.excessLitres==null?'':t.excessLitres>0?`It used about ${Math.abs(t.excessLitres).toFixed(1)} L more fuel than expected.`:`It used about ${Math.abs(t.excessLitres).toFixed(1)} L less fuel than expected.`}`.trim());}
   if(t.expectedLitres!=null && t.litres!=null){out.push(`For the ${t.kilometers==null?'recorded':Math.round(t.kilometers).toLocaleString('en-ZA')+' km'} cycle, the benchmark expected about ${t.expectedLitres.toFixed(1)} L while the truck actually used ${t.litres.toFixed(1)} L. ${t.excessLitres==null?'':t.excessLitres>0?`That is an excess of roughly ${Math.abs(t.excessLitres).toFixed(1)} L.`:`That is roughly ${Math.abs(t.excessLitres).toFixed(1)} L better than expected.`}`.trim());}
   if(t.distanceBenchmark && t.extraKm!=null){out.push(`Distance context: this cycle travelled ${Math.round(t.kilometers||0).toLocaleString('en-ZA')} km versus an expected ${Math.round(t.expectedDistanceKm||0).toLocaleString('en-ZA')} km, a ${t.extraKm>0?'+':''}${Math.round(t.extraKm).toLocaleString('en-ZA')} km difference. Distance is shown as investigation context and does not by itself create a Poor fuel rating.`);}
   const rows=t.recentFuelHistory?.rows||[];if(rows.length){const dates=rows.map(r=>r.date).filter(Boolean).sort();out.push(`The nearby ledger below shows only the records surrounding this investigation (${dates[0]||'—'} to ${dates.at(-1)||'—'}). Green rows belong to this selected full cycle. Use Monthly Fuel History for every available fuel record for the truck in a chosen month.`);}
   return out;
 }

}
