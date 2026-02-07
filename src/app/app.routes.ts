import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { AuthPageComponent } from './pages/auth/auth.page';
import { DownloadsPageComponent } from './pages/downloads/downloads.page';
import { HomePage } from './pages/home/home.page';

export const routes: Routes = [
  { path: 'auth', component: AuthPageComponent },
  { path: 'downloads', component: DownloadsPageComponent, canActivate: [authGuard] },
  { path: 'profile', redirectTo: 'downloads', pathMatch: 'full' },
  { path: '', component: HomePage },
  { path: '**', redirectTo: '' }
];
