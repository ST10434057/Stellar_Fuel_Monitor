import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="login-page">
      <div class="login-overlay"></div>
      <section class="login-card">
        <img src="assets/stellar-logo.png" alt="Stellar Transport" class="login-logo">
        <div class="login-divider"></div>
        <form (ngSubmit)="login()">
          <label class="login-field">
            <app-icon name="user"></app-icon>
            <input [(ngModel)]="username" name="username" autocomplete="username" placeholder="Username">
          </label>
          <label class="login-field">
            <app-icon name="lock"></app-icon>
            <input [(ngModel)]="password" name="password" autocomplete="current-password" type="password" placeholder="Password">
          </label>
          @if (error) { <p class="login-error">{{ error }}</p> }
          <button class="login-btn" type="submit">Log In</button>
          <button class="login-home" type="button" (click)="demo()"><app-icon name="home"></app-icon> Prototype Demo</button>
          <p class="login-note">Fuel intelligence prototype — Express + latest Stellar dataset</p>
        </form>
      </section>
    </div>
  `
})
export class LoginComponent {
  username = 'matteo';
  password = 'prototype';
  error = '';

  constructor(private router: Router) {}

  login(): void {
    if (!this.username.trim() || !this.password.trim()) {
      this.error = 'Enter a username and password to continue.';
      return;
    }
    localStorage.setItem('stellarPrototypeUser', this.username.trim());
    this.router.navigate(['/app/home']);
  }

  demo(): void {
    this.username = 'matteo';
    this.password = 'prototype';
    this.login();
  }
}
