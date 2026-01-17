import { GoogleGenAI } from '@google/genai';
import { MultiStripVideoProgress, StripVideoInput } from '@/types';

// API Key - in production, use environment variables
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

export interface GenerateVideoResponse {
  video_id: string;
  status: 'processing' | 'completed' | 'failed';
  video_url?: string;
  error?: string;
}

export interface MultiStripVideoResult {
  success: boolean;
  stripVideos: { stripId: string; name: string; videoUrl: string }[];
  combinedVideoUrl?: string;
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
        model: 'veo-3.0-generate-001',
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

  /**
   * Generate videos for multiple comic strips and combine them into one final video
   * Each strip maintains its strict format - the final video shows strips sequentially
   * @param strips - Array of comic strips with their images and metadata
   * @param onProgress - Callback for progress updates
   * @returns Combined video URL or individual strip videos
   */
  async generateMultiStripVideo(
    strips: StripVideoInput[],
    onProgress?: (progress: MultiStripVideoProgress) => void
  ): Promise<MultiStripVideoResult> {
    const stripVideos: { stripId: string; name: string; videoUrl: string }[] = [];

    try {
      console.log(`[VideoService] Starting multi-strip video generation for ${strips.length} strips`);
      
      // Log all strips being processed
      strips.forEach((strip, i) => {
        console.log(`[VideoService] Strip ${i + 1}: ${strip.name}, has image: ${!!strip.imageBase64}, size: ${strip.imageBase64?.length || 0}`);
      });

      // APPROACH: Create a combined image with all strips stacked vertically,
      // then generate ONE video from that combined image
      if (strips.length > 1) {
        onProgress?.({
          currentStrip: 1,
          totalStrips: strips.length,
          stage: 'combining',
          stripName: 'Creating combined comic layout...',
        });

        try {
          // Create a combined image with all strips
          const combinedImage = await this.combineStripImages(strips);
          
          // Calculate combined dimensions
          const maxWidth = Math.max(...strips.map(s => s.width));
          const totalHeight = strips.reduce((sum, s) => sum + s.height, 0) + (strips.length - 1) * 20; // 20px gap between strips

          onProgress?.({
            currentStrip: 1,
            totalStrips: 1,
            stage: 'generating',
            stripName: 'Generating combined video...',
          });

          // Build combined context from all strips
          const combinedContext = strips
            .map((s, i) => s.context ? `Strip ${i + 1} (${s.name}): ${s.context}` : '')
            .filter(Boolean)
            .join('\n');

          console.log('[VideoService] Generating video for combined image...');
          
          const response = await this.generateVideo(
            combinedImage,
            undefined, // use default prompt for strict format
            maxWidth,
            totalHeight,
            combinedContext || `Combined comic with ${strips.length} strips arranged vertically. Animate each strip's contents while keeping the overall layout frozen.`
          );

          if (response.status === 'completed' && response.video_url) {
            // Create strip video entries for each original strip
            strips.forEach(strip => {
              stripVideos.push({
                stripId: strip.id,
                name: strip.name,
                videoUrl: response.video_url!,
              });
            });

            onProgress?.({
              currentStrip: strips.length,
              totalStrips: strips.length,
              stage: 'completed',
            });

            return {
              success: true,
              stripVideos,
              combinedVideoUrl: response.video_url,
            };
          } else {
            throw new Error(response.error || 'Combined video generation failed');
          }
        } catch (combineError) {
          console.error('[VideoService] Combined approach failed, falling back to individual videos:', combineError);
          // Fall back to individual video generation
        }
      }

      // Fallback: Generate individual videos for each strip
      for (let i = 0; i < strips.length; i++) {
        const strip = strips[i];
        
        onProgress?.({
          currentStrip: i + 1,
          totalStrips: strips.length,
          stage: 'generating',
          stripName: strip.name,
        });

        console.log(`[VideoService] Generating video for strip ${i + 1}/${strips.length}: ${strip.name}`);
        console.log(`[VideoService] Strip image size: ${strip.imageBase64?.length || 0} chars`);

        if (!strip.imageBase64 || strip.imageBase64.length < 100) {
          console.error(`[VideoService] Strip ${strip.name} has invalid or empty image data`);
          continue;
        }

        const response = await this.generateVideo(
          strip.imageBase64,
          undefined, // use default prompt for strict format
          strip.width,
          strip.height,
          strip.context
        );

        if (response.status === 'completed' && response.video_url) {
          stripVideos.push({
            stripId: strip.id,
            name: strip.name,
            videoUrl: response.video_url,
          });
          console.log(`[VideoService] Successfully generated video for strip: ${strip.name}`);
        } else {
          console.error(`[VideoService] Failed to generate video for strip: ${strip.name}`, response.error);
          // Continue with other strips even if one fails
        }
      }

      if (stripVideos.length === 0) {
        return {
          success: false,
          stripVideos: [],
          error: 'Failed to generate any videos. Please check that all strips have valid images.',
        };
      }

      onProgress?.({
        currentStrip: strips.length,
        totalStrips: strips.length,
        stage: 'completed',
      });

      // Return individual videos (can't properly combine on client-side)
      return {
        success: true,
        stripVideos,
        combinedVideoUrl: stripVideos.length === 1 ? stripVideos[0].videoUrl : undefined,
        error: stripVideos.length > 1 ? 'Multiple videos generated. Use the combined approach or download individually.' : undefined,
      };

    } catch (error) {
      console.error('[VideoService] Multi-strip error:', error);
      onProgress?.({
        currentStrip: 0,
        totalStrips: strips.length,
        stage: 'failed',
        error: error instanceof Error ? error.message : 'Multi-strip video generation failed',
      });

      return {
        success: false,
        stripVideos,
        error: error instanceof Error ? error.message : 'Multi-strip video generation failed',
      };
    }
  }

  /**
   * Combine multiple strip images into a single vertically stacked image
   */
  private async combineStripImages(strips: StripVideoInput[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const maxWidth = Math.max(...strips.map(s => s.width));
      const gap = 20; // Gap between strips
      const totalHeight = strips.reduce((sum, s) => sum + s.height, 0) + (strips.length - 1) * gap;

      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not create canvas context'));
        return;
      }

      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, maxWidth, totalHeight);

      let loadedCount = 0;
      let currentY = 0;
      const imagePositions: { y: number; height: number }[] = [];

      // Calculate positions first
      strips.forEach((strip, i) => {
        imagePositions.push({ y: currentY, height: strip.height });
        currentY += strip.height + (i < strips.length - 1 ? gap : 0);
      });

      // Load and draw all images
      strips.forEach((strip, index) => {
        const img = new Image();
        img.onload = () => {
          // Center the image horizontally if it's narrower than maxWidth
          const x = (maxWidth - strip.width) / 2;
          ctx.drawImage(img, x, imagePositions[index].y, strip.width, strip.height);
          
          loadedCount++;
          if (loadedCount === strips.length) {
            // All images loaded, return the combined image
            resolve(canvas.toDataURL('image/png'));
          }
        };
        img.onerror = () => {
          console.error(`[VideoService] Failed to load image for strip: ${strip.name}`);
          loadedCount++;
          if (loadedCount === strips.length) {
            // Still resolve even if some images failed
            resolve(canvas.toDataURL('image/png'));
          }
        };
        img.src = strip.imageBase64;
      });
    });
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
