import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { apiConfig } from './api.config';
import {
  ApiResponse,
  DownloadItem,
  DownloadStartPayload,
  LoginPayload,
  LoginResponse,
  RegisterPayload
} from './types';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = apiConfig.baseUrl;

  constructor(private http: HttpClient) {}

  register(payload: RegisterPayload) {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/user/register`, payload);
  }

  login(payload: LoginPayload) {
    return this.http.post<ApiResponse<LoginResponse>>(`${this.baseUrl}/user/login`, payload);
  }

  startDownload(payload: DownloadStartPayload) {
    return this.http.post<ApiResponse<{ id: string; status: string }>>(
      `${this.baseUrl}/downloads/start`,
      payload
    );
  }

  getDownload(id: string) {
    return this.http.get<ApiResponse<DownloadItem>>(`${this.baseUrl}/downloads/${id}`);
  }

  listDownloads(page = 1, limit = 10) {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    return this.http.get<ApiResponse<DownloadItem[]>>(`${this.baseUrl}/downloads`, { params });
  }

  downloadFile(id: string) {
    return this.http.get(`${this.baseUrl}/downloads/${id}/file`, {
      responseType: 'blob',
      observe: 'response'
    });
  }

  cancelDownload(id: string) {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/downloads/${id}/cancel`, {});
  }

  deleteDownload(id: string) {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/downloads/${id}`);
  }
}
