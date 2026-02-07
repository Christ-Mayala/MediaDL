import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { finalize } from 'rxjs';
import { ApiService } from '../../api/api.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LucideAngularModule],
  templateUrl: './auth.page.html',
  styleUrl: './auth.page.scss'
})
export class AuthPageComponent {
  tab: 'login' | 'register' = 'login';
  errorMessage = '';
  successMessage = '';
  loadingLogin = false;
  loadingRegister = false;

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  registerForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private auth: AuthService,
    private router: Router
  ) {}

  switchTab(tab: 'login' | 'register') {
    this.tab = tab;
    this.errorMessage = '';
    this.successMessage = '';
  }

  submitLogin() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loadingLogin = true;
    this.errorMessage = '';
    this.successMessage = '';
    const payload = this.loginForm.getRawValue();

    this.api
      .login(payload)
      .pipe(finalize(() => (this.loadingLogin = false)))
      .subscribe({
        next: (res) => {
          if (!res.success || !res.data?.token) {
            this.errorMessage = res.message || 'Connexion impossible.';
            return;
          }
          this.auth.setSession(res.data.token, res.data.user);
          this.router.navigate(['/']);
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Connexion impossible.';
        }
      });
  }

  submitRegister() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loadingRegister = true;
    this.errorMessage = '';
    this.successMessage = '';
    const payload = this.registerForm.getRawValue();

    this.api
      .register(payload)
      .pipe(finalize(() => (this.loadingRegister = false)))
      .subscribe({
        next: (res) => {
          if (!res.success) {
            this.errorMessage = res.message || 'Création impossible.';
            return;
          }
          this.tab = 'login';
          this.successMessage = 'Compte créé. Connectez-vous.';
          this.loginForm.patchValue({ email: payload.email });
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Création impossible.';
        }
      });
  }
}
