import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, catchError, finalize, of, switchMap, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../api/api.service';
import { YoutubeDownloaderService, YoutubeMetadata } from '../../services/youtube-downloader.service';
import { DownloadItem, MediaType } from '../../api/types';
import { AuthService } from '../../auth/auth.service';
import { TruncateUrlPipe } from '../../pipes/truncate-url.pipe';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-downloads-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TruncateUrlPipe, LucideAngularModule],
  templateUrl: './downloads.page.html',
  styleUrl: './downloads.page.scss'
})
export class DownloadsPageComponent implements OnInit, OnDestroy {
  downloads: DownloadItem[] = [];
  lastCreatedId = '';
  startError = '';
  listError = '';
  actionError = '';
  actionSuccess = '';
  loadingStart = false;
  actionLoading: Record<string, string> = {};
  page = 1;
  limit = 10;
  pollIntervalMs = 7000;
  private pollSub?: Subscription;
  private mediaTypeSub?: Subscription;

  // Afficher les métadonnées YouTube dans l'UI (optionnel)
  displayYoutubeMetadata?: YoutubeMetadata;
  showMetadataPreview = false;

  form = this.fb.nonNullable.group({
    url: ['', [Validators.required]],
    mediaType: ['video' as MediaType, [Validators.required]],
    filename: [''],
    maxHeight: [1080]
  });

  constructor(private fb: FormBuilder, private api: ApiService, private auth: AuthService, private youtubeDownloader: YoutubeDownloaderService) {}

  ngOnInit() {
    this.startPolling();
    this.mediaTypeSub = this.form.controls.mediaType.valueChanges.subscribe((value) => {
      if (value !== 'video') {
        this.form.controls.maxHeight.setValue(0);
        this.form.controls.maxHeight.disable({ emitEvent: false });
      } else {
        this.form.controls.maxHeight.enable({ emitEvent: false });
        if (!this.form.controls.maxHeight.value || this.form.controls.maxHeight.value === 0) {
          this.form.controls.maxHeight.setValue(1080);
        }
      }
    });
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    this.mediaTypeSub?.unsubscribe();
  }

  startPolling() {
    this.pollSub = timer(0, this.pollIntervalMs)
      .pipe(switchMap(() => this.fetchDownloads()))
      .subscribe((res) => this.handleListResponse(res));
  }

  refreshNow() {
    this.fetchDownloads().subscribe((res) => this.handleListResponse(res));
  }

  /**
   * Afficher un aperçu des métadonnées YouTube
   */
  showYoutubeMetadataPreview(metadata: YoutubeMetadata) {
    this.displayYoutubeMetadata = metadata;
    this.showMetadataPreview = true;
  }

  /**
   * Masquer l'aperçu des métadonnées
   */
  hideMetadataPreview() {
    this.showMetadataPreview = false;
  }

  submitStart() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loadingStart = true;
    this.startError = '';
    this.actionSuccess = '';
    const raw = this.form.getRawValue();
    const url = raw.url.trim();

    // Vérifier si c'est une URL YouTube
    if (this.isYoutubeUrl(url)) {
      this.downloadYoutubeVideo(url, raw.mediaType as MediaType, raw.filename);
    } else {
      // Utiliser l'ancienne méthode pour les autres plateformes
      this.downloadOtherPlatform(url, raw.mediaType as MediaType, raw.filename, raw.maxHeight);
    }
  }

  /**
   * Télécharger une vidéo YouTube côté client
   */
  private async downloadYoutubeVideo(url: string, mediaType: MediaType, filename?: string) {
    try {
      this.actionSuccess = 'Préparation du téléchargement YouTube...';
      
      // Récupérer les métadonnées
      const metadata = await this.youtubeDownloader.getVideoMetadata(url);
      this.showYoutubeMetadataPreview(metadata);
      
      this.actionSuccess = `Téléchargement de "${metadata.title}"...`;
      
      // Convertir MediaType en 'video' | 'audio' pour le service
      const youtubeMediaType = mediaType === 'image' ? 'video' : mediaType;
      
      // Récupérer la qualité depuis le formulaire
      const quality = this.form.controls.maxHeight.value ? 
        `${this.form.controls.maxHeight.value}p` : '1080p';
      
      // Lancer le téléchargement côté client avec progression
      await this.youtubeDownloader.downloadVideo(
        url, 
        filename || this.sanitizeFilename(metadata.title), 
        youtubeMediaType,
        quality,
        (progress) => {
          this.actionSuccess = `Téléchargement: ${progress.percent}% (${progress.speed.toFixed(1)} MB/s)`;
        }
      );
      
      this.hideMetadataPreview();
      this.actionSuccess = `Téléchargement de "${metadata.title}" terminé !`;
      this.refreshNow();
      
    } catch (error: any) {
      this.startError = error?.message || 'Erreur lors du téléchargement YouTube.';
      this.loadingStart = false;
    }
  }

  /**
   * Télécharger depuis les autres plateformes (ancienne méthode)
   */
  private downloadOtherPlatform(url: string, mediaType: MediaType, filename?: string, maxHeight?: number) {
    const payload = {
      url: url.trim(),
      mediaType: mediaType,
      filename: filename?.trim() || undefined,
      maxHeight:
        mediaType === 'video' && maxHeight && Number(maxHeight) > 0
          ? Number(maxHeight)
          : undefined
    };

    this.api
      .startDownload(payload)
      .pipe(finalize(() => (this.loadingStart = false)))
      .subscribe({
        next: (res) => {
          if (!res.success || !res.data?.id) {
            this.startError = res.message || 'Échec du téléchargement.';
            return;
          }
          this.lastCreatedId = res.data.id;
          this.refreshNow();
          this.scrollToList();
        },
        error: (err) => {
          this.startError = err?.error?.message || 'Échec du téléchargement.';
        }
      });
  }

  /**
   * Vérifier si l'URL est YouTube
   */
  private isYoutubeUrl(url: string): boolean {
    return url.includes('youtube.com') || url.includes('youtu.be');
  }

  /**
   * Nettoyer le nom de fichier
   */
  private sanitizeFilename(title: string): string {
    return title
      .replace(/[<>:"/\\|?*]/g, '_')
      .substring(0, 80)
      .trim() || 'video';
  }

  statusClass(status?: string) {
    const value = (status || 'pending').toLowerCase();
    if (value.includes('run')) {
      return 'running';
    }
    if (value.includes('done') || value.includes('complete')) {
      return 'done';
    }
    if (value.includes('cancel')) {
      return 'error';
    }
    if (value.includes('error') || value.includes('fail')) {
      return 'error';
    }
    return 'pending';
  }

  statusLabel(status?: string) {
    const value = (status || 'pending').toLowerCase();
    if (value.includes('run')) return 'en cours';
    if (value.includes('done') || value.includes('complete')) return 'termine';
    if (value.includes('cancel')) {
      return 'error';
    }
    if (value.includes('error') || value.includes('fail')) {
      return 'erreur';
    }
    if (value.includes('cancel')) return 'annule';
    if (value.includes('error') || value.includes('fail')) return 'erreur';
    return 'en attente';
  }

  expireLabel(item: DownloadItem) {
    if (!item.expiresAt || item.jobStatus !== 'done') return '';
    const diffMs = new Date(item.expiresAt).getTime() - Date.now();
    if (Number.isNaN(diffMs)) return '';
    if (diffMs <= 0) return 'Expire';
    const minutes = Math.ceil(diffMs / 60000);
    return `Expire dans ${minutes} min`;
  }

  canCancel(item: DownloadItem) {
    return item.jobStatus === 'running' || item.jobStatus === 'pending';
  }

  canDownload(item: DownloadItem) {
    return item.jobStatus === 'done';
  }

  canDelete(item: DownloadItem) {
    return item.jobStatus === 'done' || item.jobStatus === 'error' || item.jobStatus === 'cancelled';
  }

  cancelDownload(item: DownloadItem) {
    if (!item._id || this.actionLoading[item._id]) return;
    this.actionError = '';
    this.actionSuccess = '';
    this.actionLoading[item._id] = 'cancel';
    this.api.cancelDownload(item._id).pipe(finalize(() => delete this.actionLoading[item._id])).subscribe({
      next: () => this.refreshNow(),
      error: (err) => {
        this.actionError = err?.error?.message || 'Annulation impossible.';
      }
    });
  }

  deleteDownload(item: DownloadItem) {
    if (!item._id || this.actionLoading[item._id]) return;
    this.actionError = '';
    this.actionSuccess = '';
    this.actionLoading[item._id] = 'delete';
    this.api.deleteDownload(item._id).pipe(finalize(() => delete this.actionLoading[item._id])).subscribe({
      next: () => this.refreshNow(),
      error: (err) => {
        this.actionError = err?.error?.message || 'Suppression impossible.';
      }
    });
  }

  downloadFile(item: DownloadItem) {
    if (!item._id || this.actionLoading[item._id]) return;
    this.actionError = '';
    this.actionSuccess = '';
    this.actionLoading[item._id] = 'download';
    this.api.downloadFile(item._id).pipe(finalize(() => delete this.actionLoading[item._id])).subscribe({
      next: (res) => {
        const blob = res.body;
        if (!blob) {
          this.actionError = 'Fichier indisponible.';
          return;
        }
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          blob.text().then((text: string) => {
            try {
              const parsed = JSON.parse(text);
              this.actionError = parsed?.message || 'Téléchargement impossible.';
            } catch {
              this.actionError = 'Téléchargement impossible.';
            }
          });
          return;
        }
        const header = res.headers.get('content-disposition') || '';
        const headerFilename = this.extractFilename(header);
        const filename = this.buildDownloadFilename(item, headerFilename, contentType);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        if (err?.error instanceof Blob) {
          err.error.text().then((text: string) => {
            try {
              const parsed = JSON.parse(text);
              this.actionError = parsed?.message || 'Téléchargement impossible.';
            } catch {
              this.actionError = 'Téléchargement impossible.';
            }
          });
          return;
        }
        this.actionError = err?.error?.message || 'Téléchargement impossible.';
      }
    });
  }

  copyDirectLink(item: DownloadItem) {
    if (!item._id) return;
    this.actionError = '';
    this.actionSuccess = '';
    const token = this.auth.token;
    if (!token) {
      this.actionError = 'Token introuvable. Reconnectez-vous.';
      return;
    }
    const url = `${environment.apiBaseUrl}/api/v1/mediadl/downloads/${item._id}/file?token=${encodeURIComponent(token)}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          this.actionSuccess = 'Lien copie.';
        })
        .catch(() => {
          this.actionError = 'Copie impossible.';
        });
      return;
    }
    const fallback = document.createElement('textarea');
    fallback.value = url;
    document.body.appendChild(fallback);
    fallback.select();
    try {
      document.execCommand('copy');
      this.actionSuccess = 'Lien copie.';
    } catch {
      this.actionError = 'Copie impossible.';
    } finally {
      document.body.removeChild(fallback);
    }
  }

  private extractFilename(header: string) {
    const match = /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i.exec(header);
    return decodeURIComponent(match?.[1] || match?.[2] || '');
  }

  private buildDownloadFilename(item: DownloadItem, headerFilename: string, contentType: string) {
    const preferred = (item.filename || '').trim();
    const fallback = (headerFilename || '').trim();
    const extFromHeader = this.getExtension(fallback);
    const extFromType = this.extensionFromType(contentType);

    if (preferred) {
      if (this.hasExtension(preferred)) {
        return preferred;
      }
      const ext = extFromHeader || extFromType;
      return ext ? `${preferred}.${ext}` : preferred;
    }

    if (fallback) {
      return fallback;
    }

    const base = item._id ? `media_${item._id}` : 'media_download';
    return extFromType ? `${base}.${extFromType}` : base;
  }

  private hasExtension(name: string) {
    return Boolean(this.getExtension(name));
  }

  private getExtension(name: string) {
    if (!name) return '';
    const clean = name.split('?')[0].split('#')[0];
    const lastDot = clean.lastIndexOf('.');
    const lastSlash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
    if (lastDot > lastSlash && lastDot < clean.length - 1) {
      return clean.slice(lastDot + 1);
    }
    return '';
  }

  private extensionFromType(contentType: string) {
    const type = contentType.split(';')[0].trim().toLowerCase();
    switch (type) {
      case 'video/mp4':
        return 'mp4';
      case 'video/webm':
        return 'webm';
      case 'audio/mpeg':
        return 'mp3';
      case 'audio/mp4':
        return 'm4a';
      case 'audio/webm':
        return 'webm';
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      default:
        return '';
    }
  }

  private fetchDownloads() {
    return this.api.listDownloads(this.page, this.limit).pipe(
      catchError((err) => {
        this.listError = err?.error?.message || 'Impossible de charger les téléchargements.';
        return of(null);
      })
    );
  }

  private handleListResponse(res: any) {
    if (!res) {
      return;
    }
    if (!res.success) {
      this.listError = res.message || 'Impossible de charger les téléchargements.';
      return;
    }
    this.listError = '';
    this.downloads = res.data || [];
  }

  // Nouvelles méthodes pour l'interface améliorée
  trackById(index: number, item: DownloadItem) {
    return item._id;
  }

  getMediaTypeIcon(type?: string) {
    switch (type) {
      case 'video': return 'video';
      case 'audio': return 'music';
      case 'image': return 'image';
      default: return 'file-text';
    }
  }

  getMediaTypeLabel(type?: string) {
    switch (type) {
      case 'video': return 'Vidéo';
      case 'audio': return 'Audio';
      case 'image': return 'Image';
      default: return 'Inconnu';
    }
  }

  getStatusIcon(status?: string) {
    const value = (status || 'pending').toLowerCase();
    if (value.includes('run') || value.includes('process')) return 'clock';
    if (value.includes('done') || value.includes('complete')) return 'circle-check-big';
    if (value.includes('cancel')) return 'circle-x';
    if (value.includes('error') || value.includes('fail')) return 'circle-alert';
    return 'clock';
  }

  getStatusLabel(status?: string) {
    const value = (status || 'pending').toLowerCase();
    if (value.includes('run') || value.includes('process')) return 'En cours';
    if (value.includes('done') || value.includes('complete')) return 'Terminé';
    if (value.includes('cancel')) return 'Annulé';
    if (value.includes('error') || value.includes('fail')) return 'Erreur';
    return 'En attente';
  }

  getRelativeTime(dateString?: string) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'à l\'instant';
    if (diffMins < 60) return `il y a ${diffMins} min`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `il y a ${diffHours}h`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `il y a ${diffDays}j`;
  }

  refreshOne(id: string) {
    if (!id || this.actionLoading[id]) return;
    this.actionError = '';
    this.actionSuccess = '';
    this.actionLoading[id] = 'refresh';
    
    this.api.getDownload(id).pipe(
      finalize(() => delete this.actionLoading[id])
    ).subscribe({
      next: () => this.refreshNow(),
      error: (err) => {
        this.actionError = err?.error?.message || 'Mise à jour impossible.';
      }
    });
  }

  scrollToForm() {
    document.querySelector('.start-card')?.scrollIntoView({ 
      behavior: 'smooth' 
    });
  }

  scrollToList() {
    setTimeout(() => {
      document.querySelector('#downloads-list')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 150);
  }
}
