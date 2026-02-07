import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncateUrl',
  standalone: true
})
export class TruncateUrlPipe implements PipeTransform {
  transform(url: string | undefined | null, maxLength: number = 50): string {
    if (!url) return '';
    
    if (url.length <= maxLength) return url;
    
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname + urlObj.search;
      
      if (domain.length + 10 > maxLength) {
        return url.substring(0, maxLength - 3) + '...';
      }
      
      const remainingLength = maxLength - domain.length - 3;
      const truncatedPath = path.length > remainingLength ? 
        path.substring(0, remainingLength) + '...' : path;
      
      return domain + truncatedPath;
    } catch {
      return url.substring(0, maxLength - 3) + '...';
    }
  }
}
