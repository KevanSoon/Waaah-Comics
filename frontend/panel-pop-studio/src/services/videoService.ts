import { GoogleGenAI } from '@google/genai';

// API Key - in production, use environment variables
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

export interface GenerateVideoResponse {
  video_id: string;
  status: 'processing' | 'completed' | 'failed';
  video_url?: string;
  error?: string;
}

// Veo 2 supported aspect ratios
type VeoAspectRatio = '16:9' | '9:16';

class VideoService {
  private client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
  }

  /**
   * Convert width/height to nearest supported Veo aspect ratio
   */
  private getVeoAspectRatio(width: number, height: number): VeoAspectRatio {
    const ratio = width / height;
    // Veo 2 supports: 16:9 (landscape) and 9:16 (portrait)
    // 16:9 = 1.78, 9:16 = 0.56
    if (ratio >= 1) {
      return '16:9'; // Landscape or square -> use landscape
    } else {
      return '9:16'; // Portrait
    }
  }

  /**
   * Generate a video from a comic image using Veo 2
   * @param imageBase64 - The base64 encoded image
   * @param prompt - Optional animation prompt
   * @param width - Width of the source image (for aspect ratio)
   * @param height - Height of the source image (for aspect ratio)
   * @param context - Optional comic context (story, characters, scene description)
   */
  async generateVideo(
    imageBase64: string, 
    prompt?: string,
    width?: number,
    height?: number,
    context?: string
  ): Promise<GenerateVideoResponse> {
    const videoId = crypto.randomUUID();
    
    try {
      // Extract base64 data and mime type
      let base64Data: string;
      let mimeType = 'image/png';
      
      if (imageBase64.includes(',')) {
        const [header, data] = imageBase64.split(',');
        base64Data = data;
        if (header.includes('image/jpeg') || header.includes('image/jpg')) {
          mimeType = 'image/jpeg';
        }
      } else {
        base64Data = imageBase64;
      }

      // Determine aspect ratio from dimensions
      const aspectRatio = width && height 
        ? this.getVeoAspectRatio(width, height) 
        : '16:9';

      console.log(`[VideoService] Using aspect ratio: ${aspectRatio} (from ${width}x${height})`);

      // Build context section if provided
      const contextSection = context ? `
        COMIC CONTEXT (use to inform subtle animations):
        ${context}
        
        Use this context to add appropriate subtle movements that match the scene's mood and characters.
        
      ` : '';

      // Animation prompt - comic strip with animated panel contents, no transitions
      const animationPrompt = prompt || `
        ${contextSection}CRITICAL: Do NOT generate new images or frames. Do NOT create transitions.
        
        This is a static comic page layout that must NEVER change:
        - The page layout is FROZEN
        - Panel borders are FROZEN  
        - Panel positions are FROZEN
        - White/colored gutters between panels are FROZEN
        - All text is FROZEN
        
        ONLY add subtle motion to the EXISTING artwork inside each panel:
        - Gentle character breathing
        - Slow eye blinks
        - Hair swaying slightly
        - Clothes rippling
        - Background elements like smoke or particles
        
        DO NOT:
        - Generate any new content
        - Create transitions between scenes
        - Morph or transform the image
        - Move the camera in any way
        - Change the composition
        - Add new characters or objects
        - Zoom into individual panels
        
        This is a cinemagraph of a comic page - the structure stays perfectly still, only tiny movements within the drawn art.
        
        Seamless loop. Entire image visible. No cuts.
      `;

      console.log('[VideoService] Starting video generation...');

      // Call Veo 2 API
      const operation = await this.client.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: animationPrompt,
        image: {
          imageBytes: base64Data,
          mimeType: mimeType,
        },
        config: {
          aspectRatio: aspectRatio,
          numberOfVideos: 1,
        },
      });

      console.log('[VideoService] Operation started, waiting for completion...');

      // Poll for completion
      let currentOp = operation;
      while (!currentOp.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        currentOp = await this.client.operations.get({ operation: currentOp });
        console.log('[VideoService] Still processing...');
      }

      console.log('[VideoService] Operation completed!');

      // Get the video result
      if (currentOp.response?.generatedVideos?.[0]) {
        const video = currentOp.response.generatedVideos[0];
        
        // Try to get video data
        let videoUrl: string | undefined;
        
        if (video.video?.uri) {
          // Try to download with API key
          try {
            const uri = video.video.uri;
            const separator = uri.includes('?') ? '&' : '?';
            const downloadUrl = `${uri}${separator}key=${GOOGLE_API_KEY}`;
            
            const response = await fetch(downloadUrl);
            if (response.ok) {
              const blob = await response.blob();
              // Convert blob to base64
              const reader = new FileReader();
              const base64Promise = new Promise<string>((resolve) => {
                reader.onloadend = () => {
                  resolve(reader.result as string);
                };
              });
              reader.readAsDataURL(blob);
              videoUrl = await base64Promise;
            } else {
              console.log('[VideoService] Could not download, using URI');
              videoUrl = uri;
            }
          } catch (downloadErr) {
            console.error('[VideoService] Download error:', downloadErr);
            videoUrl = video.video.uri;
          }
        }

        return {
          video_id: videoId,
          status: 'completed',
          video_url: videoUrl,
        };
      }

      return {
        video_id: videoId,
        status: 'failed',
        error: 'No video generated',
      };

    } catch (error) {
      console.error('[VideoService] Error:', error);
      return {
        video_id: videoId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Video generation failed',
      };
    }
  }
}

export const videoService = new VideoService();

/**
 * Save a video to Supabase storage via the backend API
 */
export async function saveVideoToStorage(
  videoUrl: string,
  userId?: string,
  comicId?: string,
  panelId?: string
): Promise<{ bucket: string; path: string; public_url?: string }> {
  // Fetch the video blob from the URL (could be base64 data URL or http URL)
  let blob: Blob;

  if (videoUrl.startsWith('data:')) {
    // Convert base64 data URL to blob
    const response = await fetch(videoUrl);
    blob = await response.blob();
  } else {
    // Fetch from URL
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch video');
    }
    blob = await response.blob();
  }

  // Create form data
  const formData = new FormData();
  formData.append('file', blob, `comic-video-${Date.now()}.mp4`);
  if (userId) formData.append('user_id', userId);
  if (comicId) formData.append('comic_id', comicId);
  if (panelId) formData.append('panel_id', panelId);

  // Upload to backend
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const response = await fetch(`${backendUrl}/comics/upload-video`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(error.detail || 'Failed to save video');
  }

  return response.json();
}
