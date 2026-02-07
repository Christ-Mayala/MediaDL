import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../api/api.service';

export interface YoutubeMetadata {
  title: string;
  duration: number;
  thumbnail: string;
  author: string;
  viewCount: number;
  publishDate: string;
  description: string;
  formats: Array<{
    quality: string;
    container: string;
    hasVideo: boolean;
    hasAudio: boolean;
    resolution: string;
    bitrate: string;
  }>;
}

export interface DownloadProgress {
  progress: number;
  downloaded: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class YoutubeDownloaderService {
  
  constructor(private http: HttpClient, private api: ApiService) {}

  /**
   * Récupérer les métadonnées YouTube via l'API
   */
  async getVideoMetadata(url: string): Promise<YoutubeMetadata> {
    try {
      const response = await this.api.getYoutubeMetadata(url).toPromise();
      
      // Vérifier si la réponse existe et est valide
      if (!response || !response.success) {
        throw new Error('Erreur lors de la récupération des métadonnées');
      }
      
      // Vérifier si les données existent
      if (!response.data) {
        throw new Error('Aucune donnée trouvée pour cette vidéo');
      }
      
      return response.data;
    } catch (error: any) {
      throw new Error(error?.message || 'Erreur lors de la récupération des métadonnées');
    }
  }

  /**
   * Télécharger une vidéo YouTube directement dans le navigateur
   */
  async downloadVideo(
    url: string, 
    filename: string, 
    mediaType: 'video' | 'audio',
    quality?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Créer un élément de lien temporaire pour le téléchargement
        const link = document.createElement('a');
        link.style.display = 'none';
        
        // Récupérer les métadonnées pour avoir l'URL de téléchargement
        this.getVideoMetadata(url).then(metadata => {
          // Sélectionner le meilleur format selon les préférences
          const selectedFormat = this.selectBestFormat(metadata.formats, mediaType, quality);
          
          if (!selectedFormat) {
            reject(new Error('Aucun format disponible pour ce type de média'));
            return;
          }
          
          // Construire l'URL de téléchargement direct
          const downloadUrl = this.buildDownloadUrl(url, selectedFormat);
          
          link.href = downloadUrl;
          link.download = filename || this.sanitizeFilename(metadata.title);
          
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          resolve();
        }).catch(reject);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Suivre la progression d'un téléchargement (simulation)
   */
  simulateDownloadProgress(url: string, mediaType: 'video' | 'audio'): Promise<DownloadProgress> {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 10; // Simulation de progression
        if (progress >= 100) {
          clearInterval(interval);
          resolve({ progress: 100, downloaded: 100, total: 100 });
        } else {
          resolve({ progress, downloaded: progress, total: 100 });
        }
      }, 500);
    });
  }

  /**
   * Sélectionner le meilleur format selon les préférences
   */
  private selectBestFormat(formats: YoutubeMetadata['formats'], mediaType: 'video' | 'audio', quality?: string) {
    const filteredFormats = formats.filter(format => {
      if (mediaType === 'audio') {
        return format.hasAudio && !format.hasVideo;
      } else {
        return format.hasVideo && format.hasAudio && format.container === 'mp4';
      }
    });

    if (filteredFormats.length === 0) return null;

    // Trier par qualité si spécifiée
    if (quality) {
      const formatByQuality = filteredFormats.find(f => 
        f.quality.toLowerCase().includes(quality.toLowerCase())
      );
      if (formatByQuality) return formatByQuality;
    }

    // Sinon prendre le meilleur (prioriser la résolution)
    return filteredFormats.reduce((best, current) => {
      const currentHeight = parseInt(current.resolution) || 0;
      const bestHeight = parseInt(best.resolution) || 0;
      return bestHeight > currentHeight ? best : current;
    });
  }

  /**
   * Construire l'URL de téléchargement YouTube
   */
  private buildDownloadUrl(url: string, format: any): string {
    // Pour l'instant, on utilise une URL directe
    // En production, vous pourriez utiliser un service de proxy si nécessaire
    return url;
  }

  /**
   * Nettoyer le nom de fichier pour éviter les caractères invalides
   */
  private sanitizeFilename(title: string): string {
    return title
      .replace(/[<>:"/\\|?*]/g, '_')
      .substring(0, 80)
      .trim() || 'video';
  }
}
