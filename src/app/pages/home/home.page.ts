import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss'
})
export class HomePage {
  private router = inject(Router);
  private auth = inject(AuthService);

  get isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  goToAuth() {
    this.router.navigate(['/auth']);
  }

  goToDownloads() {
    this.router.navigate(['/downloads']);
  }

  scrollToFeatures() {
    document.getElementById('features')?.scrollIntoView({ 
      behavior: 'smooth' 
    });
  }
}
