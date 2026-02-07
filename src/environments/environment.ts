const runtimeEnv = (window as any).__env || {};

export const environment = {
  apiBaseUrl: runtimeEnv.API_BASE_URL || 'https://dryapi.onrender.com',
  appSlug: 'mediadl'
};
