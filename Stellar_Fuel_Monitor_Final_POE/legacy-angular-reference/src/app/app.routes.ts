import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { ShellComponent } from './layout/shell.component';
import { HomeComponent } from './pages/home/home.component';
import { VehicleComponent } from './pages/vehicle/vehicle.component';
import { FuelOilComponent } from './pages/fuel-oil/fuel-oil.component';
import { FuelHistoryComponent } from './pages/fuel-history/fuel-history.component';
import { FuelEstimateComponent } from './pages/fuel-estimate/fuel-estimate.component';
import { AlertsComponent } from './pages/alerts/alerts.component';
import { AlertDetailComponent } from './pages/alert-detail/alert-detail.component';
import { FleetComponent } from './pages/fleet/fleet.component';
import { VehicleProfileComponent } from './pages/vehicle-profile/vehicle-profile.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { AdminComponent } from './pages/admin/admin.component';
import { TripAnalyticsComponent } from './pages/trip-analytics/trip-analytics.component';
import { TripDetailComponent } from './pages/trip-detail/trip-detail.component';
import { ProfileComponent } from './pages/profile/profile.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, title: 'Stellar - Login' },
  {
    path: 'app', component: ShellComponent, children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: HomeComponent, title: 'Stellar - Home' },
      { path: 'vehicle', component: VehicleComponent, title: 'Stellar - Vehicle' },
      { path: 'fuel-oil', component: FuelOilComponent, title: 'Stellar - Fuel & Oil' },
      { path: 'fuel-history', component: FuelHistoryComponent, title: 'Stellar - Truck Fuel History' },
      { path: 'fuel-estimate', component: FuelEstimateComponent, title: 'Stellar - Fuel Estimate' },
      { path: 'analytics', component: TripAnalyticsComponent, title: 'Stellar - Trip Analytics' },
      { path: 'trips/:id', component: TripDetailComponent, title: 'Stellar - Trip Investigation' },
      { path: 'alerts', component: AlertsComponent, title: 'Stellar - Alerts' },
      { path: 'alerts/:id', component: AlertDetailComponent, title: 'Stellar - Alert Review' },
      { path: 'fleet', component: FleetComponent, title: 'Stellar - Fleet' },
      { path: 'fleet/:reg', component: VehicleProfileComponent, title: 'Stellar - Vehicle Profile' },
      { path: 'reports', component: ReportsComponent, title: 'Stellar - Reports' },
      { path: 'admin', component: AdminComponent, title: 'Stellar - Administration' },
      { path: 'profile', component: ProfileComponent, title: 'Stellar - My Profile' }
    ]
  },
  { path: '**', redirectTo: 'app/home' }
];
