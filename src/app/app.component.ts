import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from './auth/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  isMobileMenuOpen = false;
  currentYear = new Date().getFullYear();

  private auth = inject(AuthService);
  private readonly onScrollHandler = this.onScroll.bind(this);

  ngOnInit() {
    // Gestion du scroll pour l'header
    this.isMobileMenuOpen = false;
    this.updateScrollLock();
    window.addEventListener('scroll', this.onScrollHandler);
    this.onScroll();
  }

  get isAuthed(): boolean {
    return this.auth.isAuthenticated();
  }

  get userLabel(): string {
    const user = this.auth.user;
    if (!user) {
      return 'Invite';
    }
    return user.name || user.email || 'User';
  }

  logout() {
    this.auth.logout();
  }

  ngOnDestroy() {
    window.removeEventListener('scroll', this.onScrollHandler);
    this.isMobileMenuOpen = false;
    this.updateScrollLock();
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    this.updateScrollLock();
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
    this.updateScrollLock();
  }

  onScroll() {
    const header = document.querySelector('.header');
    if (window.scrollY > 50) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  }

  private updateScrollLock() {
    const shouldLock = this.isMobileMenuOpen;
    document.body.classList.toggle('menu-open', shouldLock);
    document.documentElement.classList.toggle('menu-open', shouldLock);
    if (!shouldLock) {
      document.body.style.removeProperty('overflow');
      document.documentElement.style.removeProperty('overflow');
    }
  }

}
