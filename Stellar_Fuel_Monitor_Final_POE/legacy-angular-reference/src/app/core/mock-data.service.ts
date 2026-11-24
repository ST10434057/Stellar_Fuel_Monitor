import { ApplicationRef, Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { AlertStatus, AnalyticsSettings, ApiHealth, DailyAnalytics, FuelAlert, FuelTransaction, RecentFuelHistory, TruckMonthlyFuelHistory, TrailerSummary, TripAnalysis, TripWeightContext, Vehicle, VehicleAnalytics } from './models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MockDataService {
  vehicles: Vehicle[] = [];
  transactions: FuelTransaction[] = [];
  alerts: FuelAlert[] = [];
  backendOnline = false;
  lastSync = 'Connecting…';
  health: ApiHealth | null = null;
  private timer?: number;

  // Small client-side caches keep date switching and back/forward navigation instant.
  // They are cleared whenever server data/settings are changed.
  private dashboardCache = new Map<string, DailyAnalytics>();
  private alertsCache = new Map<string, FuelAlert[]>();
  private transactionCache = new Map<string, FuelTransaction[]>();
  private tripCache = new Map<string, TripAnalysis>();
  // V17 keeps the V16 single-request Trip Investigation path. Keep its full-cycle response
  // separate from the lightweight core cache so a core-only object can never masquerade as
  // the complete investigation.
  private fullTripCache = new Map<string, TripAnalysis>();
  private tripHistoryCache = new Map<string, RecentFuelHistory>();
  private tripPageCache = new Map<string, { items: TripAnalysis[]; total: number; offset: number; limit: number; hasMore: boolean; registration: string }>();
  private vehicleAnalyticsCache = new Map<string, VehicleAnalytics>();
  private destinationsCache = new Map<string, { destination: string; count: number }[]>();
  private analyticsDatesCache: { dates: string[]; latestCompleteDate: string | null } | null = null;
  private vehiclesLoaded = false;

  constructor(private http: HttpClient, private appRef: ApplicationRef, private zone: NgZone) {
    void this.refreshHealth();
    this.timer = window.setInterval(() => void this.refreshHealth(), 60000);
  }

  /** Presentation-safe request wrapper.
   *  - no GET can leave a page spinning forever
   *  - the repaint is scheduled AFTER the component's await continuation assigns its fields
   */
  private async wait<T>(observable: any, timeoutMs = 8000): Promise<T> {
    try {
      return await firstValueFrom(observable.pipe(timeout(timeoutMs))) as T;
    } finally {
      window.setTimeout(() => {
        try { this.zone.run(() => this.appRef.tick()); } catch {}
      }, 0);
    }
  }

  private repaintSoon(): void {
    window.setTimeout(() => {
      try { this.zone.run(() => this.appRef.tick()); } catch {}
    }, 0);
  }

  async refreshHealth(): Promise<void> {
    try {
      this.health = await this.wait<ApiHealth>(this.http.get<ApiHealth>(`${environment.apiBaseUrl}/health`), 4000);
      this.backendOnline = true;
      this.lastSync = new Date().toLocaleTimeString();
    } catch {
      this.backendOnline = false;
      this.lastSync = 'API unavailable';
    }
  }

  async loadVehicles(force = false): Promise<Vehicle[]> {
    if (this.vehiclesLoaded && !force && this.vehicles.length) { this.repaintSoon(); return this.vehicles; }
    const vehicles = await this.wait<Vehicle[]>(this.http.get<Vehicle[]>(`${environment.apiBaseUrl}/vehicles`), 6000);
    this.vehicles.splice(0, this.vehicles.length, ...vehicles);
    this.backendOnline = true;
    this.lastSync = new Date().toLocaleTimeString();
    this.vehiclesLoaded = true;
    return this.vehicles;
  }

  async loadTransactions(date = '', force = false): Promise<FuelTransaction[]> {
    const cacheKey = date || '__latest__';
    if (!force && this.transactionCache.has(cacheKey)) {
      const cached = this.transactionCache.get(cacheKey)!;
      this.transactions.splice(0, this.transactions.length, ...cached);
      return cached;
    }
    let params = new HttpParams().set('limit', '1000');
    if (date) params = params.set('date', date);
    const transactions = await this.wait<FuelTransaction[]>(this.http.get<FuelTransaction[]>(`${environment.apiBaseUrl}/transactions`, { params }), 6000);
    this.transactionCache.set(cacheKey, transactions);
    this.transactions.splice(0, this.transactions.length, ...transactions);
    this.backendOnline = true;
    this.lastSync = new Date().toLocaleTimeString();
    return transactions;
  }

  async transactionsForDate(date: string): Promise<FuelTransaction[]> {
    return await this.loadTransactions(date);
  }

  async loadAlerts(date = '', force = false): Promise<FuelAlert[]> {
    const cacheKey = date || '__latest__';
    if (!force && this.alertsCache.has(cacheKey)) {
      const cached = this.alertsCache.get(cacheKey)!;
      this.alerts.splice(0, this.alerts.length, ...cached);
      return cached;
    }
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    const alerts = await this.wait<FuelAlert[]>(this.http.get<FuelAlert[]>(`${environment.apiBaseUrl}/alerts`, { params }), 6000);
    this.alertsCache.set(cacheKey, alerts);
    this.alerts.splice(0, this.alerts.length, ...alerts);
    this.backendOnline = true;
    this.lastSync = new Date().toLocaleTimeString();
    return alerts;
  }

  async alertsForDate(date: string): Promise<FuelAlert[]> {
    return await this.loadAlerts(date);
  }

  async refresh(): Promise<void> {
    try {
      await Promise.all([this.refreshHealth(), this.loadVehicles()]);
    } catch {
      this.backendOnline = false;
      this.lastSync = 'API unavailable';
    }
  }

  vehicle(registration: string): Vehicle | undefined {
    return this.vehicles.find(v => v.registration.toLowerCase() === registration.toLowerCase());
  }

  vehicleTransactions(registration: string): FuelTransaction[] {
    return this.transactions.filter(t => t.registration.toLowerCase() === registration.toLowerCase());
  }

  alert(id: string): FuelAlert | undefined {
    return this.alerts.find(a => a.id === id);
  }

  async getAlert(id: string): Promise<FuelAlert> {
    return await this.wait<FuelAlert>(this.http.get<FuelAlert>(`${environment.apiBaseUrl}/alerts/${encodeURIComponent(id)}`), 6000);
  }

  async dashboardSummary(date?: string): Promise<DailyAnalytics> {
    const key = date || '__latest__';
    const cached = this.dashboardCache.get(key);
    if (cached) { this.repaintSoon(); return cached; }

    const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
    const result = await this.wait<DailyAnalytics>(this.http.get<DailyAnalytics>(`${environment.apiBaseUrl}/dashboard/summary${suffix}`), 5000);
    this.dashboardCache.set(key, result);
    if (result.date) this.dashboardCache.set(result.date, result);
    if (!date) this.dashboardCache.set('__latest__', result);

    if (result.source) {
      this.health = result.source;
      this.backendOnline = true;
      this.lastSync = new Date().toLocaleTimeString();
    }

    // Quietly fetch the adjacent operating days. Clicking Previous / Next is then usually
    // a pure memory lookup instead of another wait.
    void this.prefetchDashboard(result.navigation?.previousDate || null);
    void this.prefetchDashboard(result.navigation?.nextDate || null);
    return result;
  }

  private async prefetchDashboard(date: string | null): Promise<void> {
    if (!date || this.dashboardCache.has(date)) return;
    try {
      const result = await this.wait<DailyAnalytics>(this.http.get<DailyAnalytics>(`${environment.apiBaseUrl}/dashboard/summary?date=${encodeURIComponent(date)}`), 5000);
      this.dashboardCache.set(date, result);
    } catch {
      // Prefetch is optional; the normal foreground request will retry if needed.
    }
  }

  async dashboard(date?: string): Promise<DailyAnalytics> {
    const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
    const result = await this.wait<DailyAnalytics>(this.http.get<DailyAnalytics>(`${environment.apiBaseUrl}/dashboard${suffix}`), 8000);
    if (result.source) {
      this.health = result.source;
      this.backendOnline = true;
      this.lastSync = new Date().toLocaleTimeString();
    }
    return result;
  }

  async analyticsDates(): Promise<{ dates: string[]; latestCompleteDate: string | null }> {
    if (this.analyticsDatesCache) { this.repaintSoon(); return this.analyticsDatesCache; }
    this.analyticsDatesCache = await this.wait<{ dates: string[]; latestCompleteDate: string | null }>(this.http.get<{ dates: string[]; latestCompleteDate: string | null }>(`${environment.apiBaseUrl}/analytics/dates`), 5000);
    return this.analyticsDatesCache;
  }

  async vehicleAnalytics(reg: string, limit = 80): Promise<VehicleAnalytics> {
    const key = `${reg.toUpperCase()}|${limit}`;
    if (this.vehicleAnalyticsCache.has(key)) { this.repaintSoon(); return this.vehicleAnalyticsCache.get(key)!; }
    const value = await this.wait<VehicleAnalytics>(this.http.get<VehicleAnalytics>(`${environment.apiBaseUrl}/analytics/vehicles/${encodeURIComponent(reg)}?limit=${limit}`), 7000);
    this.vehicleAnalyticsCache.set(key, value);
    return value;
  }

  async destinations(reg: string): Promise<{ destination: string; count: number }[]> {
    const key = reg.toUpperCase();
    if (this.destinationsCache.has(key)) { this.repaintSoon(); return this.destinationsCache.get(key)!; }
    const value = await this.wait<{ destination: string; count: number }[]>(this.http.get<{ destination: string; count: number }[]>(`${environment.apiBaseUrl}/analytics/vehicles/${encodeURIComponent(key)}/destinations`), 5000);
    this.destinationsCache.set(key, value);
    return value;
  }

  async dayTrips(date?: string): Promise<TripAnalysis[]> {
    const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
    const result = await this.wait<{ date: string; items: TripAnalysis[] }>(this.http.get<{ date: string; items: TripAnalysis[] }>(`${environment.apiBaseUrl}/analytics/day-trips${suffix}`), 6000);
    return result.items;
  }

  async tripCore(id: string): Promise<TripAnalysis> {
    if (this.tripCache.has(id)) { this.repaintSoon(); return this.tripCache.get(id)!; }
    if (!id) throw new Error('Trip id is required');

    const encodedId = encodeURIComponent(id);
    let value: TripAnalysis;

    try {
      // Preferred V15 endpoint: lightweight core only.
      value = await this.wait<TripAnalysis>(
        this.http.get<TripAnalysis>(`${environment.apiBaseUrl}/analytics/trips/${encodedId}/core`),
        4500
      );
    } catch (coreError) {
      // Compatibility fallback. This also protects the live site if an older Express
      // process is accidentally still running and does not yet expose /core.
      value = await this.wait<TripAnalysis>(
        this.http.get<TripAnalysis>(`${environment.apiBaseUrl}/analytics/trips/${encodedId}`),
        4500
      );
    }

    this.tripCache.set(id, value);
    this.backendOnline = true;
    this.lastSync = new Date().toLocaleTimeString();
    return value;
  }

  async tripRecentHistory(id: string): Promise<RecentFuelHistory> {
    if (this.tripHistoryCache.has(id)) { this.repaintSoon(); return this.tripHistoryCache.get(id)!; }
    const value = await this.wait<RecentFuelHistory>(this.http.get<RecentFuelHistory>(`${environment.apiBaseUrl}/analytics/trips/${encodeURIComponent(id)}/recent-history`), 8000);
    this.tripHistoryCache.set(id, value);
    return value;
  }

  async monthlyFuelHistory(registration: string, month: string): Promise<TruckMonthlyFuelHistory> {
    const params = new HttpParams().set('month', month).set('limit', '500');
    return await this.wait<TruckMonthlyFuelHistory>(
      this.http.get<TruckMonthlyFuelHistory>(`${environment.apiBaseUrl}/analytics/vehicles/${encodeURIComponent(registration)}/fuel-history`, { params }),
      8000
    );
  }

  async trip(id: string): Promise<TripAnalysis> {
    // V17: retain the proven V16 one-request loader; the response is now one complete full-cycle investigation.
    // One browser request returns the complete Trip Investigation, including recent history.
    if (this.fullTripCache.has(id)) { this.repaintSoon(); return this.fullTripCache.get(id)!; }
    if (!id) throw new Error('Trip id is required');
    const value = await this.wait<TripAnalysis>(
      this.http.get<TripAnalysis>(`${environment.apiBaseUrl}/analytics/trips/${encodeURIComponent(id)}`),
      8000
    );
    this.fullTripCache.set(id, value);
    // Also seed the core cache for any other screen that asks for the same trip.
    this.tripCache.set(id, value);
    this.backendOnline = true;
    this.lastSync = new Date().toLocaleTimeString();
    return value;
  }

  async tripPage(registration: string, destination = '', from = '', to = '', limit = 100, offset = 0): Promise<{ items: TripAnalysis[]; total: number; offset: number; limit: number; hasMore: boolean; registration: string }> {
    let params = new HttpParams()
      .set('registration', registration)
      .set('limit', String(limit))
      .set('offset', String(offset));
    if (destination) params = params.set('destination', destination);
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    const key = `${registration.toUpperCase()}|${destination}|${from}|${to}|${limit}|${offset}`;
    if (this.tripPageCache.has(key)) { this.repaintSoon(); return this.tripPageCache.get(key)!; }
    const value = await this.wait<{ items: TripAnalysis[]; total: number; offset: number; limit: number; hasMore: boolean; registration: string }>(this.http.get<{ items: TripAnalysis[]; total: number; offset: number; limit: number; hasMore: boolean; registration: string }>(`${environment.apiBaseUrl}/analytics/trips-list`, { params }), 7000);
    if (this.tripPageCache.size > 120) this.tripPageCache.clear();
    this.tripPageCache.set(key, value);
    return value;
  }

  async trips(registration: string, destination = '', from = '', to = ''): Promise<TripAnalysis[]> {
    let params = new HttpParams().set('registration', registration).set('limit', '500');
    if (destination) params = params.set('destination', destination);
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return await this.wait<TripAnalysis[]>(this.http.get<TripAnalysis[]>(`${environment.apiBaseUrl}/analytics/trips`, { params }), 8000);
  }

  async trailers(search = ''): Promise<TrailerSummary[]> {
    const params = new HttpParams().set('search', search).set('limit', '500');
    return await this.wait<TrailerSummary[]>(this.http.get<TrailerSummary[]>(`${environment.apiBaseUrl}/trailers`, { params }), 6000);
  }

  async saveTripContext(id: string, context: TripWeightContext): Promise<TripAnalysis> {
    const value = await this.wait<TripAnalysis>(this.http.put<TripAnalysis>(`${environment.apiBaseUrl}/trips/${encodeURIComponent(id)}/context`, context), 120000);
    this.clearAnalyticsCaches();
    this.tripCache.set(id, value);
    this.tripHistoryCache.delete(id);
    return value;
  }

  async getSettings(): Promise<AnalyticsSettings> {
    return await this.wait<AnalyticsSettings>(this.http.get<AnalyticsSettings>(`${environment.apiBaseUrl}/settings/analytics`), 6000);
  }

  async saveSettings(settings: Partial<AnalyticsSettings>): Promise<AnalyticsSettings> {
    const result = await this.wait<AnalyticsSettings>(this.http.patch<AnalyticsSettings>(`${environment.apiBaseUrl}/settings/analytics`, settings), 120000);
    this.clearAnalyticsCaches();
    return result;
  }

  async refreshServerData(): Promise<ApiHealth> {
    const result = await this.wait<ApiHealth>(this.http.post<ApiHealth>(`${environment.apiBaseUrl}/admin/refresh-data`, {}), 120000);
    this.clearAnalyticsCaches();
    await this.refreshHealth();
    return result;
  }

  async auditLog(): Promise<any[]> {
    return await this.wait<any[]>(this.http.get<any[]>(`${environment.apiBaseUrl}/audit`), 6000);
  }

  async updateAlert(id: string, status: AlertStatus, comment?: string): Promise<void> {
    await this.wait(this.http.patch(`${environment.apiBaseUrl}/alerts/${encodeURIComponent(id)}`, { status, comment }), 10000);
    const existing = this.alerts.find(a => a.id === id);
    if (existing) {
      existing.status = status;
      existing.comment = comment || '';
    }
    for (const rows of this.alertsCache.values()) {
      const row = rows.find(a => a.id === id);
      if (row) {
        row.status = status;
        row.comment = comment || '';
      }
    }
  }

  private clearAnalyticsCaches(): void {
    this.dashboardCache.clear();
    this.alertsCache.clear();
    this.transactionCache.clear();
    this.tripCache.clear();
    this.fullTripCache.clear();
    this.tripHistoryCache.clear();
    this.tripPageCache.clear();
    this.vehicleAnalyticsCache.clear();
    this.destinationsCache.clear();
    this.analyticsDatesCache = null;
    this.vehiclesLoaded = false;
  }
}
