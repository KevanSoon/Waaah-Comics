const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types
export interface GeneratedImage {
  id: string;
  image_url: string;
  prompt: string | null;
  source_type: string;
  created_at: string;
}

export interface Comic {
  id: string;
  user_id: string;
  title: string | null;
  layout_json: any;
  panels: ComicPanel[];
  created_at: string;
  updated_at: string;
}

export interface ComicPanel {
  id: string;
  comic_id: string;
  panel_index: number;
  sketch_url: string | null;
  generated_image_url: string | null;
  prompt: string | null;
}

export interface GenerateImageRequest {
  prompt: string;
  sketch_base64?: string;
  style?: string;
}

export interface GenerateImageResponse {
  image_url: string;
  prompt: string;
  enhanced_prompt: string;
}

// Storage asset listing (from Supabase bucket via backend)
export interface StorageAssetItem {
  path: string;
  name: string;
  url: string;
  size?: number;
  last_modified?: string;
}

export interface StorageAssetList {
  user_id: string;
  bucket: string;
  items: StorageAssetItem[];
}

// API Service class
class ApiService {
  private getAuthHeader: (() => Promise<string | null>) | null = null;

  setAuthGetter(getter: () => Promise<string | null>) {
    this.getAuthHeader = getter;
  }

  private async getHeaders(): Promise<Headers> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    
    if (this.getAuthHeader) {
      const token = await this.getAuthHeader();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }
    
    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = await this.getHeaders();
    
    // Merge headers if options has headers
    if (options.headers) {
      const optHeaders = new Headers(options.headers);
      optHeaders.forEach((value, key) => headers.set(key, value));
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP error ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  async syncUser(): Promise<{ synced: boolean; user_id: string }> {
    return this.request('/api/auth/sync', { method: 'POST' });
  }

  async getCurrentUser(): Promise<{ clerk_id: string; email: string; db_id: string }> {
    return this.request('/api/auth/me');
  }

  // Image endpoints
  async generateImage(data: GenerateImageRequest): Promise<GenerateImageResponse> {
    return this.request('/api/images/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUserImages(): Promise<GeneratedImage[]> {
    return this.request('/api/images/');
  }

  async deleteImage(imageId: string): Promise<void> {
    return this.request(`/api/images/${imageId}`, { method: 'DELETE' });
  }

  async uploadImage(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const headers = new Headers();
    if (this.getAuthHeader) {
      const token = await this.getAuthHeader();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    const response = await fetch(`${API_BASE_URL}/api/images/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
  }

  // Comic endpoints
  async createComic(data: any): Promise<Comic> {
    return this.request('/api/comics/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUserComics(): Promise<Comic[]> {
    return this.request('/api/comics/');
  }

  async getComic(comicId: string): Promise<Comic> {
    return this.request(`/api/comics/${comicId}`);
  }

  async updateComic(comicId: string, data: any): Promise<Comic> {
    return this.request(`/api/comics/${comicId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteComic(comicId: string): Promise<void> {
    return this.request(`/api/comics/${comicId}`, { method: 'DELETE' });
  }

  // Video endpoints
  async generateVideo(panelImageBase64: string, prompt: string): Promise<{ video_url: string; status: string }> {
    return this.request('/api/video/generate', {
      method: 'POST',
      body: JSON.stringify({ panel_image_base64: panelImageBase64, prompt }),
    });
  }

  // Storage listing
  async listUserStorageImages(userId: string, signed = false, limit = 100, offset = 0): Promise<StorageAssetList> {
    const params = new URLSearchParams({ user_id: userId, signed: String(signed), limit: String(limit), offset: String(offset) });
    return this.request(`/assets/user-images?${params.toString()}`);
  }

  async listUserStorageVideos(userId: string, signed = false, limit = 100, offset = 0): Promise<StorageAssetList> {
    const params = new URLSearchParams({ user_id: userId, signed: String(signed), limit: String(limit), offset: String(offset) });
    return this.request(`/assets/user-videos?${params.toString()}`);
  }
}

// Export singleton instance
export const apiService = new ApiService();
