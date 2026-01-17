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

// Project types
export interface ProjectPanel {
  id: string;
  project_id: string;
  image_url: string;
  panel_order: number;
  created_at?: string;
}

export interface ProjectVideo {
  id: string;
  project_id: string;
  video_url: string;
  video_order: number;
  name?: string;
  created_at?: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  created_at?: string;
  updated_at?: string;
  panels: ProjectPanel[];
  videos: ProjectVideo[];
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  cover_image_url?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  cover_image_url?: string;
}

export interface AddPanelRequest {
  image_url: string;
  panel_order?: number;
}

export interface AddVideoRequest {
  video_url: string;
  video_order?: number;
  name?: string;
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

  async deleteStorageAsset(path: string, userId: string): Promise<{ status: string; path: string }> {
    const params = new URLSearchParams({ path, user_id: userId });
    return this.request(`/assets/storage?${params.toString()}`, { method: 'DELETE' });
  }

  async uploadImageToStorage(file: File, userId: string): Promise<{ bucket: string; path: string; public_url: string | null }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userId);

    const headers = new Headers();
    if (this.getAuthHeader) {
      const token = await this.getAuthHeader();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    const response = await fetch(`${API_BASE_URL}/comics/upload-panel`, {
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

  // Project endpoints
  async listProjects(userId: string): Promise<Project[]> {
    return this.request(`/projects?user_id=${userId}`);
  }

  async createProject(userId: string, data: CreateProjectRequest): Promise<Project> {
    return this.request(`/projects?user_id=${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProject(projectId: string, userId: string): Promise<Project> {
    return this.request(`/projects/${projectId}?user_id=${userId}`);
  }

  async updateProject(projectId: string, userId: string, data: UpdateProjectRequest): Promise<Project> {
    return this.request(`/projects/${projectId}?user_id=${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(projectId: string, userId: string): Promise<void> {
    return this.request(`/projects/${projectId}?user_id=${userId}`, { method: 'DELETE' });
  }

  async addPanelToProject(projectId: string, userId: string, data: AddPanelRequest): Promise<ProjectPanel> {
    return this.request(`/projects/${projectId}/panels?user_id=${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deletePanelFromProject(projectId: string, panelId: string, userId: string): Promise<void> {
    return this.request(`/projects/${projectId}/panels/${panelId}?user_id=${userId}`, { method: 'DELETE' });
  }

  async addVideoToProject(projectId: string, userId: string, data: AddVideoRequest): Promise<ProjectVideo> {
    return this.request(`/projects/${projectId}/videos?user_id=${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteVideoFromProject(projectId: string, videoId: string, userId: string): Promise<void> {
    return this.request(`/projects/${projectId}/videos/${videoId}?user_id=${userId}`, { method: 'DELETE' });
  }
}

// Export singleton instance
export const apiService = new ApiService();
