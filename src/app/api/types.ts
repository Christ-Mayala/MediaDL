export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
  requestId?: string;
  pagination?: {
    total: number;
    count: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role?: string;
  status?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export type MediaType = 'video' | 'audio' | 'image';

export interface DownloadStartPayload {
  url: string;
  mediaType: MediaType;
  filename?: string;
  maxHeight?: number;
}

export interface DownloadItem {
  _id: string;
  url: string;
  platform?: string;
  mediaType: MediaType;
  filename?: string;
  maxHeight?: number;
  jobStatus?: string;
  progress?: number;
  error?: string;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  expiresAt?: string;
}
