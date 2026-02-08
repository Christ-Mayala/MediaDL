import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../api/api.service';

// Import dynamique pour ytdl-core (évite les erreurs de build)
declare const require: any;
let ytdl: any = null;

// Charger ytdl-core dynamiquement
try {
  ytdl = require('@distube/ytdl-core');
} catch (e) {
  console.warn('ytdl-core non disponible en mode développement');
}

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
    contentLength?: number;
    url?: string;
    height?: string;
  }>;
}

export interface DownloadProgress {
  percent: number;
  speed: number;
  eta: number;
  downloaded: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
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
   * Télécharger une vidéo YouTube avec ytdl-core côté client
   */
  async downloadVideo(
    url: string, 
    filename: string, 
    mediaType: 'video' | 'audio',
    quality?: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Vérifier si ytdl est disponible
        if (!ytdl) {
          // Fallback: utiliser l'API backend
          await this.downloadViaBackend(url, filename, mediaType, quality);
          resolve();
          return;
        }

        // Récupérer les métadonnées via ytdl-core côté client
        const info = await ytdl.getInfo(url);
        
        // Sélectionner le meilleur format
        const format = this.selectBestFormat(info.formats, mediaType, quality);
        
        if (!format) {
          reject(new Error('Aucun format disponible pour ce type de média'));
          return;
        }

        // Créer le stream de téléchargement
        const stream = ytdl.downloadFromInfo(info, { 
          format: format,
          quality: 'highest'
        });
        
        // Créer un blob pour le téléchargement
        const chunks: any[] = [];
        let downloaded = 0;
        const total = (format as any).contentLength || 0;
        
        stream.on('data', (chunk: any) => {
          chunks.push(chunk);
          downloaded += chunk.length;
          
          // Calculer la progression
          if (onProgress && total > 0) {
            const percent = Math.round((downloaded / total) * 100);
            const speed = downloaded / 1024 / 1024; // MB/s
            const eta = total > 0 ? (total - downloaded) / (speed * 1024 * 1024) : 0;
            
            onProgress({ percent, speed, eta, downloaded, total });
          }
        });
        
        stream.on('end', () => {
          const blob = new Blob(chunks, { 
            type: mediaType === 'audio' ? 'audio/mp4' : 'video/mp4' 
          });
          const downloadUrl = URL.createObjectURL(blob);
          
          // Créer un élément de lien temporaire
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = filename || this.sanitizeFilename(info.videoDetails.title);
          link.style.display = 'none';
          
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Nettoyer l'URL objet après un délai
          setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
          
          resolve();
        });
        
        stream.on('error', (error: Error) => {
          reject(new Error(`Erreur de téléchargement: ${error.message}`));
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Fallback: téléchargement via backend
   */
  private async downloadViaBackend(
    url: string, 
    filename: string, 
    mediaType: 'video' | 'audio',
    quality?: string
  ): Promise<void> {
    // Créer un lien vers un service de téléchargement tiers
    const downloadUrl = this.buildThirdPartyDownloadUrl(url, mediaType, quality);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || 'youtube-video';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Construire une URL de téléchargement via service tiers
   */
  private buildThirdPartyDownloadUrl(
    url: string, 
    mediaType: 'video' | 'audio',
    quality?: string
  ): string {
    const videoId = this.extractVideoId(url);
    if (!videoId) return url;
    
    // Utiliser y2mate comme fallback
    const baseUrl = 'https://www.y2mate.com';
    const type = mediaType === 'audio' ? 'mp3' : 'mp4';
    
    return `${baseUrl}/youtube/${videoId}/${type}`;
  }

  /**
   * Extraire l'ID vidéo d'une URL YouTube
   */
  private extractVideoId(url: string): string | null {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Sélectionner le meilleur format selon les préférences
   */
  private selectBestFormat(formats: any[], mediaType: 'video' | 'audio', quality?: string): any {
    const filteredFormats = formats.filter(format => {
      if (mediaType === 'audio') {
        return format.hasAudio && !format.hasVideo && format.container === 'mp4';
      } else {
        return format.hasVideo && format.hasAudio && format.container === 'mp4';
      }
    });

    if (filteredFormats.length === 0) return null;

    // Prioriser la qualité spécifiée
    if (quality) {
      const qualityMap: { [key: string]: number } = {
        '4320p': 4320, '2160p': 2160, '1440p': 1440, '1080p': 1080,
        '720p': 720, '480p': 480, '360p': 360, '240p': 240
      };
      
      const targetHeight = qualityMap[quality] || 1080;
      const bestMatch = filteredFormats.find(f => {
        const height = parseInt(f.height) || 0;
        return height <= targetHeight;
      });
      
      if (bestMatch) return bestMatch;
    }

    // Sinon prendre le meilleur format disponible
    return filteredFormats.reduce((best, current) => {
      const currentHeight = parseInt(current.height) || 0;
      const bestHeight = parseInt(best.height) || 0;
      return currentHeight > bestHeight ? current : best;
    });
  }

  /**
   * Nettoyer le nom de fichier
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .substring(0, 80)
      .trim() || 'youtube-video';
  }

  /**
   * Vérifier si une URL est une URL YouTube
   */
  isYoutubeUrl(url: string): boolean {
    return url.includes('youtube.com') || url.includes('youtu.be');
  }

  /**
   * Nettoyer une URL YouTube
   */
  cleanYoutubeUrl(url: string): string {
    try {
      const cleanUrl = new URL(url);
      if (cleanUrl.hostname === 'youtu.be') {
        return `https://www.youtube.com/watch?v=${cleanUrl.pathname.slice(1)}`;
      }
      return cleanUrl.toString();
    } catch {
      return url;
    }
  }

  /**
   * Vérifier si ytdl-core est disponible
   */
  isYtdlAvailable(): boolean {
    return ytdl !== null;
  }
}
