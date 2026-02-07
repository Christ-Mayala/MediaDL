import { environment } from '../../environments/environment';

export const apiConfig = {
  apiBaseUrl: environment.apiBaseUrl,
  appSlug: environment.appSlug,
  baseUrl: `${environment.apiBaseUrl}/api/v1/${environment.appSlug}`
};
