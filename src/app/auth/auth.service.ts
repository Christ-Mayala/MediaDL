import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthUser } from '../api/types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenKey = 'mediadl.token';
  private userKey = 'mediadl.user';

  private tokenSubject = new BehaviorSubject<string | null>(this.readToken());
  private userSubject = new BehaviorSubject<AuthUser | null>(this.readUser());

  readonly token$ = this.tokenSubject.asObservable();
  readonly user$ = this.userSubject.asObservable();

  get token(): string | null {
    return this.tokenSubject.value;
  }

  get user(): AuthUser | null {
    return this.userSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.tokenSubject.value;
  }

  setSession(token: string, user: AuthUser) {
    this.safeSet(this.tokenKey, token);
    this.safeSet(this.userKey, JSON.stringify(user));
    this.tokenSubject.next(token);
    this.userSubject.next(user);
  }

  logout() {
    this.safeRemove(this.tokenKey);
    this.safeRemove(this.userKey);
    this.tokenSubject.next(null);
    this.userSubject.next(null);
  }

  private readToken(): string | null {
    return this.safeGet(this.tokenKey);
  }

  private readUser(): AuthUser | null {
    const raw = this.safeGet(this.userKey);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  private safeGet(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private safeSet(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      return;
    }
  }

  private safeRemove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      return;
    }
  }
}
