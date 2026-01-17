'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Download, RotateCcw, ZoomIn, Save, Video, Sparkles, ChevronDown, FolderOpen, Plus, Film, Layers } from 'lucide-react';
import { TEMPLATES } from '@/types/constants';
import { useAssets } from '@/context/AssetContext';
import { ComicCanvas } from '@/components/comic/ComicCanvas';
import { ComicState, PanelImageState, TabView, Template, ComicStrip, MultiStripVideoProgress, StripVideoInput } from '@/types';
import { useAuth } from '@clerk/nextjs';
import { apiService, Comic, Project } from '@/services/apiService';
import ProtectedRoute from '@/components/shared/ProtectedRoute';
import { useProjects } from '@/context/ProjectsContext';

import { VideoModal } from '@/components/comic/VideoModal';
import { MultiStripVideoModal } from '@/components/comic/MultiStripVideoModal';
import { videoService } from '@/services/videoService';


// Dynamic import for sidebar only (no ref needed)
const ComicSidebar = dynamic(
  () => import('@/components/comic/ComicSidebar').then(mod => ({ default: mod.ComicSidebar })),
  { ssr: false }
);

export default function ComicStudioPage() {
  return (
    <ProtectedRoute>
      <ComicStudioContent />
    </ProtectedRoute>
  );
}

function ComicStudioContent() {
  const { getToken, isSignedIn, userId } = useAuth();
  const { assets } = useAssets();
  
  const [activeTab, setActiveTab] = useState<TabView>('templates');
  const [currentTemplate, setCurrentTemplate] = useState<Template>(TEMPLATES[0]);
  const [images, setImages] = useState<ComicState>({});
  const [userImages, setUserImages] = useState<string[]>([]);
  const [canvasScale, setCanvasScale] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // Video generation state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoError, setVideoError] = useState<string | undefined>();
  const [showVideoContextInput, setShowVideoContextInput] = useState(false);
  const [videoContext, setVideoContext] = useState('');

  // Multi-strip video state
  const [isMultiStripModalOpen, setIsMultiStripModalOpen] = useState(false);
  const [savedStrips, setSavedStrips] = useState<ComicStrip[]>([]);
  const [isGeneratingMultiStripVideo, setIsGeneratingMultiStripVideo] = useState(false);
  const [multiStripProgress, setMultiStripProgress] = useState<MultiStripVideoProgress | undefined>();
  const [multiStripVideos, setMultiStripVideos] = useState<{ stripId: string; name: string; videoUrl: string }[]>([]);
  const [combinedVideoUrl, setCombinedVideoUrl] = useState<string | undefined>();
  const [multiStripError, setMultiStripError] = useState<string | undefined>();
  const [stripCounter, setStripCounter] = useState(1);

  const { addAsset } = useAssets();
  const [savedComics, setSavedComics] = useState<Comic[]>([]);
  const [currentComicId, setCurrentComicId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Get projects from shared context
  const { 
    projects, 
    selectedProjectId, 
    setSelectedProjectId, 
    createProject,
    refreshProjects 
  } = useProjects();
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const stageRef = useRef<any>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  // Ensure component is mounted (for SSR)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate scale to fit canvas in viewport
  useEffect(() => {
    const calculateScale = () => {
      if (!canvasWrapperRef.current) return;
      
      const wrapper = canvasWrapperRef.current;
      const padding = 32; // p-4 = 16px * 2
      const availableWidth = wrapper.clientWidth - padding;
      const availableHeight = wrapper.clientHeight - padding;
      
      const scaleX = availableWidth / currentTemplate.width;
      const scaleY = availableHeight / currentTemplate.height;
      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
      
      setCanvasScale(scale);
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [currentTemplate]);

  // Debug: log when images state changes
  useEffect(() => {
    console.log('[State] Images updated:', images, 'Panel count:', Object.keys(images).length);
  }, [images]);

  // Initialize API service with auth token
  useEffect(() => {
    apiService.setAuthGetter(getToken);
  }, [getToken]);

  // Load user's saved comics
  useEffect(() => {
    async function loadComics() {
      if (isSignedIn) {
        try {
          const comics = await apiService.getUserComics();
          setSavedComics(comics);
        } catch (error) {
          console.error('Failed to load comics:', error);
        }
      }
    }
    loadComics();
  }, [isSignedIn]);

  // Sync assets to userImages
  useEffect(() => {
    const assetUrls = assets.map(a => a.url);
    setUserImages(prev => {
      const combined = Array.from(new Set([...assetUrls, ...prev]));
      return combined;
    });
  }, [assets]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const src = e.dataTransfer.getData('image-src');
    console.log('[Drop] Image src:', src ? src.substring(0, 50) + '...' : 'EMPTY');

    if (!src) {
      console.error('[Drop] ERROR: No image source data! Make sure drag started correctly.');
      return;
    }

    // Get the canvas container element
    const containerEl = canvasContainerRef.current;
    if (!containerEl) {
      console.error('[Drop] ERROR: Canvas container not ready!');
      return;
    }

    const containerRect = containerEl.getBoundingClientRect();
    
    // The getBoundingClientRect returns the SCALED dimensions
    // So we need to calculate the position within the scaled rect first,
    // then convert to unscaled coordinates
    const scaledX = e.clientX - containerRect.left;
    const scaledY = e.clientY - containerRect.top;
    
    // Convert to unscaled coordinates (the actual template coordinates)
    const x = scaledX / canvasScale;
    const y = scaledY / canvasScale;

    console.log('[Drop] Drop position:', { scaledX, scaledY, x, y, canvasScale });
    console.log('[Drop] Container rect:', { width: containerRect.width, height: containerRect.height });
    console.log('[Drop] Template size:', { width: currentTemplate.width, height: currentTemplate.height });

    const targetPanel = currentTemplate.panels.find(panel => {
      const inPanel = (
        x >= panel.x &&
        x <= panel.x + panel.width &&
        y >= panel.y &&
        y <= panel.y + panel.height
      );
      console.log(`[Drop] Checking panel ${panel.id}:`, { 
        panelBounds: { x: panel.x, y: panel.y, x2: panel.x + panel.width, y2: panel.y + panel.height },
        dropPos: { x, y },
        inPanel 
      });
      return inPanel;
    });

    if (targetPanel) {
      console.log('[Drop] Found target panel:', targetPanel.id);
      placeImageInPanel(src, targetPanel);
    } else {
      console.log('[Drop] No target panel found at position', { x, y });
    }
  };

  const placeImageInPanel = (src: string, targetPanel: typeof currentTemplate.panels[0]) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Convert to data URL to avoid CORS issues during export
      let finalSrc = src;
      if (!src.startsWith('data:')) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            finalSrc = canvas.toDataURL('image/png');
          }
        } catch (err) {
          console.warn('[Drop] Could not convert to data URL, using original src');
        }
      }

      const imageWidth = img.width;
      const imageHeight = img.height;
      const panelWidth = targetPanel.width;
      const panelHeight = targetPanel.height;

      const scaleX = panelWidth / imageWidth;
      const scaleY = panelHeight / imageHeight;
      const scale = Math.max(scaleX, scaleY);

      const fittedWidth = imageWidth * scale;
      const fittedHeight = imageHeight * scale;
      const imgX = (panelWidth - fittedWidth) / 2;
      const imgY = (panelHeight - fittedHeight) / 2;

      setImages(prev => {
        // Find if this image is already used in another panel
        const previousPanelId = Object.keys(prev).find(
          panelId => prev[panelId]?.src === src && panelId !== targetPanel.id
        );

        // Create new state object
        const newImages = { ...prev };

        // Remove from previous panel if exists
        if (previousPanelId) {
          console.log('[Drop] Removing image from previous panel:', previousPanelId);
          delete newImages[previousPanelId];
        }

        // Add to target panel with converted data URL
        newImages[targetPanel.id] = {
          src: finalSrc,
          x: imgX,
          y: imgY,
          scale,
        };

        console.log('[Drop] Image placed successfully in panel:', targetPanel.id);
        console.log('[Drop] Current images state:', Object.keys(newImages));
        return newImages;
      });
    };
    img.onerror = () => {
      console.error('[Drop] ERROR: Failed to load image');
    };
    img.src = src;
  };

  // Helper function to get canvas data URL
  const getCanvasDataURL = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!stageRef.current) {
        reject(new Error('Canvas not ready'));
        return;
      }

      try {
        const stage = stageRef.current;
        const uri = stage.toDataURL({ 
          pixelRatio: 2,
          mimeType: 'image/png',
        });
        resolve(uri);
      } catch (error) {
        reject(error);
      }
    });
  };

  // Get data URL for a specific panel by cropping the full canvas image
  const getPanelDataURL = async (panelId: string): Promise<string> => {
    const panel = currentTemplate.panels.find(p => p.id === panelId);
    if (!panel) throw new Error('Panel not found');
    if (!stageRef.current) throw new Error('Canvas not ready');

    const pixelRatio = 2; // keep quality consistent with full export
    const fullURI = stageRef.current.toDataURL({ pixelRatio, mimeType: 'image/png' });

    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = panel.width * pixelRatio;
          canvas.height = panel.height * pixelRatio;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas context not available');

          // Crop area from the full image
          ctx.drawImage(
            img,
            panel.x * pixelRatio,
            panel.y * pixelRatio,
            panel.width * pixelRatio,
            panel.height * pixelRatio,
            0,
            0,
            panel.width * pixelRatio,
            panel.height * pixelRatio
          );

          resolve(canvas.toDataURL('image/png'));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load canvas image for cropping'));
      img.src = fullURI;
    });
  };

  const dataURLToFile = (dataUrl: string, filename: string): File => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/i)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  };

  const handleExport = async () => {
    console.log('[Export] Checking - stageRef.current:', stageRef.current, 'images:', images, 'keys:', Object.keys(images));
    if (!stageRef.current) {
      console.error('[Export] stageRef.current is null!');
      alert('Canvas not ready. Please wait a moment and try again.');
      return;
    }
    if (Object.keys(images).length === 0) {
      alert('Please add some images to the comic before downloading.');
      return;
    }
    
    setIsExporting(true);
    
    try {
      // Wait for images to be fully rendered
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const uri = await getCanvasDataURL();
      
      // Create and trigger download
      const link = document.createElement('a');
      link.download = `comic-${currentTemplate.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
      link.href = uri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('[Export] Error exporting canvas:', error);
      alert('Failed to export comic. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveToAssets = async () => {
    if (!stageRef.current || Object.keys(images).length === 0) {
      alert('Please add some images to the comic before saving.');
      return;
    }
    
    setIsExporting(true);
    
    try {
      // Wait for images to be fully rendered
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const uri = await getCanvasDataURL();
      
      // Add to assets
      const assetName = `Comic: ${currentTemplate.name}`;
      addAsset(uri, assetName, 'comic', 'image');
      
      // Also add to user images for immediate use
      setUserImages(prev => [uri, ...prev]);
      setActiveTab('upload');
      
      alert('Comic saved to assets!');
    } catch (error) {
      console.error('[Save] Error saving to assets:', error);
      alert('Failed to save comic. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleUploadPanel = async () => {
    if (!isSignedIn) {
      alert('Please sign in to upload your comic panel.');
      return;
    }
    if (!stageRef.current || Object.keys(images).length === 0) {
      alert('Please add some images before uploading.');
      return;
    }
    if (!selectedProjectId) {
      alert('Please select a project to upload the panel to.');
      return;
    }

    setIsUploading(true);
    try {
      // Small delay to ensure render is up-to-date
      await new Promise(resolve => setTimeout(resolve, 300));

      const dataUrl = selectedPanelId
        ? await getPanelDataURL(selectedPanelId)
        : await getCanvasDataURL();

      const filenameBase = `comic-${currentTemplate.name.replace(/\s+/g, '-').toLowerCase()}`;
      const filename = selectedPanelId ? `${filenameBase}-${selectedPanelId}.png` : `${filenameBase}-full.png`;
      const file = dataURLToFile(dataUrl, filename);

      const form = new FormData();
      form.append('file', file);
      if (userId) form.append('user_id', userId);
      if (currentComicId) form.append('comic_id', currentComicId);
      if (selectedPanelId) form.append('panel_id', selectedPanelId);

      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      const res = await fetch(`${baseUrl}/comics/upload-panel`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed: ${text}`);
      }

      const json = await res.json();
      const publicUrl: string | null = json?.public_url || null;

      // Add panel to selected project
      if (publicUrl && userId) {
        await apiService.addPanelToProject(selectedProjectId, userId, {
          image_url: publicUrl,
        });

        // Refresh projects from context to get updated panel list
        await refreshProjects();
      }

      // Add to user images if public URL is available; otherwise keep local data URL
      if (publicUrl) {
        setUserImages(prev => [publicUrl, ...prev]);
      } else {
        setUserImages(prev => [dataUrl, ...prev]);
      }

      alert('Panel uploaded to project successfully!');
    } catch (err) {
      console.error('[Upload] Error:', err);
      alert('Failed to upload panel. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    setIsCreatingProject(true);
    try {
      const project = await createProject(
        newProjectName.trim(),
        undefined
      );
      setSelectedProjectId(project.id);
      setShowCreateProjectModal(false);
      setNewProjectName('');
    } catch (err) {
      console.error('Failed to create project:', err);
      alert('Failed to create project. Please try again.');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const handleReset = () => {
    if (window.confirm('Clear all panels?')) {
      setImages({});
      setSelectedPanelId(null);
      setCurrentComicId(null);
    }
  };

  const handleSaveComic = async () => {
    if (!isSignedIn) return;
    
    setIsSaving(true);
    try {
      const comicData = {
        title: `Comic - ${new Date().toLocaleDateString()}`,
        layout_type: currentTemplate.id,
        aspect_ratio: `${currentTemplate.width}:${currentTemplate.height}`,
        panels: currentTemplate.panels.map((panel, index) => ({
          index,
          bounds: { x: panel.x, y: panel.y, width: panel.width, height: panel.height },
          z_index: index,
          sketch_url: null,
          generated_image_url: images[panel.id]?.src || null,
          prompt: null,
        })),
      };

      if (currentComicId) {
        // Update existing comic
        await apiService.updateComic(currentComicId, {
          layout_json: comicData,
        });
      } else {
        // Create new comic
        const newComic = await apiService.createComic(comicData);
        setCurrentComicId(newComic.id);
        setSavedComics(prev => [newComic, ...prev]);
      }
    } catch (error) {
      console.error('Failed to save comic:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadComic = async (comicId: string) => {
    try {
      const comic = await apiService.getComic(comicId);
      setCurrentComicId(comic.id);
      
      // Find matching template
      const templateId = comic.layout_json?.layout_type;
      const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
      setCurrentTemplate(template);
      
      // Restore panel images
      const restoredImages: ComicState = {};
      if (comic.layout_json?.panels) {
        comic.layout_json.panels.forEach((panel: any) => {
          if (panel.generated_image_url) {
            const panelConfig = template.panels[panel.index];
            if (panelConfig) {
              restoredImages[panelConfig.id] = {
                src: panel.generated_image_url,
                x: 0,
                y: 0,
                scale: 1,
              };
            }
          }
        });
      }
      setImages(restoredImages);
    } catch (error) {
      console.error('Failed to load comic:', error);
    }
  };

  // Open video context input modal
  const handleOpenVideoContext = () => {
    if (!stageRef.current || Object.keys(images).length === 0) {
      alert('Please add some images to the comic before generating a video.');
      return;
    }
    setShowVideoContextInput(true);
  };

  // Video generation handler
  const handleGenerateVideo = async () => {
    if (!stageRef.current || Object.keys(images).length === 0) {
      alert('Please add some images to the comic before generating a video.');
      return;
    }

    // Close context input and open video modal
    setShowVideoContextInput(false);
    setIsVideoModalOpen(true);
    setIsGeneratingVideo(true);
    setVideoUrl(undefined);
    setVideoError(undefined);
    setVideoProgress(0);

    try {
      // Get the comic as a single image
      await new Promise(resolve => setTimeout(resolve, 300));
      const comicImage = await getCanvasDataURL();

      // Generate the video directly from frontend with template dimensions for aspect ratio
      const response = await videoService.generateVideo(
        comicImage,
        undefined, // use default prompt
        currentTemplate.width,
        currentTemplate.height,
        videoContext.trim() || undefined // pass context if provided
      );

      if (response.status === 'completed' && response.video_url) {
        setVideoUrl(response.video_url);
        setIsGeneratingVideo(false);
      } else {
        throw new Error(response.error || 'Video generation failed');
      }
    } catch (error) {
      console.error('[Video] Error generating video:', error);
      setVideoError(error instanceof Error ? error.message : 'Failed to generate video');
      setIsGeneratingVideo(false);
    }
  };

  const handleRetryVideo = () => {
    handleGenerateVideo();
  };

  const handleCloseVideoModal = () => {
    if (!isGeneratingVideo) {
      setIsVideoModalOpen(false);
      setVideoUrl(undefined);
      setVideoError(undefined);
      setVideoProgress(0);
    }
  };

  // Multi-strip video handlers
  const handleOpenMultiStripModal = () => {
    setIsMultiStripModalOpen(true);
  };

  const handleCloseMultiStripModal = () => {
    if (!isGeneratingMultiStripVideo) {
      setIsMultiStripModalOpen(false);
    }
  };

  const handleAddCurrentStrip = async () => {
    if (!stageRef.current || Object.keys(images).length === 0) {
      alert('Please add some images to the comic before saving as a strip.');
      return;
    }

    try {
      // Wait for images to be fully rendered
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const thumbnail = await getCanvasDataURL();
      
      console.log('[MultiStrip] Captured thumbnail, length:', thumbnail?.length || 0);
      
      if (!thumbnail || thumbnail.length < 100) {
        alert('Failed to capture comic image. Please try again.');
        return;
      }

      const newStrip: ComicStrip = {
        id: crypto.randomUUID(),
        name: `Strip ${stripCounter}`,
        template: { ...currentTemplate },
        images: { ...images },
        thumbnail,
        context: videoContext.trim() || undefined,
        createdAt: new Date(),
      };

      setSavedStrips(prev => {
        const updated = [...prev, newStrip];
        console.log('[MultiStrip] Total strips after add:', updated.length);
        updated.forEach((s, i) => {
          console.log(`[MultiStrip] Strip ${i + 1}: ${s.name}, thumbnail length: ${s.thumbnail?.length || 0}`);
        });
        return updated;
      });
      setStripCounter(prev => prev + 1);
      
      // Clear current canvas for a new strip
      setImages({});
      setSelectedPanelId(null);
      setVideoContext('');
      
      console.log('[MultiStrip] Strip added:', newStrip.name);
    } catch (error) {
      console.error('[MultiStrip] Error adding strip:', error);
      alert('Failed to save strip. Please try again.');
    }
  };

  const handleRemoveStrip = (stripId: string) => {
    setSavedStrips(prev => prev.filter(s => s.id !== stripId));
    // Also remove any generated video for this strip
    setMultiStripVideos(prev => prev.filter(v => v.stripId !== stripId));
  };

  const handleReorderStrips = (reorderedStrips: ComicStrip[]) => {
    setSavedStrips(reorderedStrips);
  };

  const handleUpdateStrip = (stripId: string, updates: Partial<ComicStrip>) => {
    setSavedStrips(prev => prev.map(strip => 
      strip.id === stripId ? { ...strip, ...updates } : strip
    ));
  };

  const handleGenerateMultiStripVideo = async () => {
    if (savedStrips.length === 0) {
      alert('Please add at least one strip before generating a video.');
      return;
    }

    console.log('[MultiStrip] Starting video generation with', savedStrips.length, 'strips');
    savedStrips.forEach((strip, i) => {
      console.log(`[MultiStrip] Strip ${i + 1}: ${strip.name}, thumbnail: ${strip.thumbnail?.length || 0} chars`);
    });

    setIsGeneratingMultiStripVideo(true);
    setMultiStripVideos([]);
    setCombinedVideoUrl(undefined);
    setMultiStripError(undefined);
    setMultiStripProgress({
      currentStrip: 0,
      totalStrips: savedStrips.length,
      stage: 'generating',
    });

    try {
      // Prepare strip inputs using stored thumbnails
      const stripInputs: StripVideoInput[] = savedStrips.map((strip) => {
        console.log(`[MultiStrip] Preparing strip: ${strip.name}, thumbnail length: ${strip.thumbnail?.length || 0}`);
        return {
          id: strip.id,
          name: strip.name,
          imageBase64: strip.thumbnail || '',
          width: strip.template.width,
          height: strip.template.height,
          context: strip.context,
        };
      });

      console.log('[MultiStrip] Strip inputs prepared:', stripInputs.length);
      stripInputs.forEach((s, i) => {
        console.log(`[MultiStrip] Input ${i + 1}: ${s.name}, imageBase64 length: ${s.imageBase64?.length || 0}`);
      });

      const result = await videoService.generateMultiStripVideo(
        stripInputs,
        (progress) => {
          setMultiStripProgress(progress);
        }
      );

      if (result.success) {
        setMultiStripVideos(result.stripVideos);
        setCombinedVideoUrl(result.combinedVideoUrl);
        if (result.error) {
          // Partial success - videos generated but not combined
          setMultiStripError(result.error);
        }
      } else {
        setMultiStripError(result.error || 'Video generation failed');
      }
    } catch (error) {
      console.error('[MultiStrip] Error generating videos:', error);
      setMultiStripError(error instanceof Error ? error.message : 'Failed to generate videos');
    } finally {
      setIsGeneratingMultiStripVideo(false);
    }
  };

  const handleNewUserImage = (url: string) => {
    setUserImages(prev => [url, ...prev]);
    setActiveTab('upload');
  };

  const handleSelectTemplate = (template: Template) => {
    setCurrentTemplate(template);
    setImages({});
    setSelectedPanelId(null);
  };

  const handleImageClick = (src: string) => {
    console.log('[ImageClick] Clicked image, selectedPanelId:', selectedPanelId);
    if (selectedPanelId) {
      const targetPanel = currentTemplate.panels.find(p => p.id === selectedPanelId);
      console.log('[ImageClick] Target panel:', targetPanel);
      if (targetPanel) {
        placeImageInPanel(src, targetPanel);
        setSelectedPanelId(null);
      }
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-slate-100 overflow-hidden font-sans text-slate-900">
      <ComicSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userImages={userImages}
        onUploadImage={handleNewUserImage}
        onSelectTemplate={handleSelectTemplate}
        currentTemplateId={currentTemplate.id}
        placedImages={images}
        selectedPanelId={selectedPanelId}
        onImageClick={handleImageClick}
      />

      <div className="flex-1 flex flex-col relative h-full">
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-700 hidden sm:block">
              {currentTemplate.name}
            </h2>
            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded-md border border-slate-200 hidden sm:block">
              {currentTemplate.width} x {currentTemplate.height} px
              {currentTemplate.aspectRatio && ` (${currentTemplate.aspectRatio})`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
              title="Clear All Panels"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              onClick={handleSaveComic}
              disabled={isSaving}
              className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
              title="Save Comic"
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">{isSaving ? 'Saving...' : (currentComicId ? 'Update' : 'Save')}</span>
            </button>
            <div className="h-6 w-px bg-slate-200 mx-2"></div>

            {/* Project Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors border border-slate-200"
              >
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline max-w-[120px] truncate">
                  {selectedProject ? selectedProject.name : 'Select Project'}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showProjectDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowProjectDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 z-20 overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                      <p className="text-xs text-slate-500 font-medium px-2 py-1">Select a project</p>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {projects.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500">
                          No projects yet
                        </div>
                      ) : (
                        projects.map((project) => (
                          <button
                            key={project.id}
                            onClick={() => {
                              setSelectedProjectId(project.id);
                              setShowProjectDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                              selectedProjectId === project.id ? 'bg-purple-50 text-purple-700' : 'text-slate-700'
                            }`}
                          >
                            <FolderOpen className="w-4 h-4 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{project.name}</p>
                              <p className="text-xs text-slate-500">{project.panels.length} panels</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="p-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setShowProjectDropdown(false);
                          setShowCreateProjectModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Create New Project
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleOpenVideoContext}
              disabled={isExporting || isGeneratingVideo || Object.keys(images).length === 0}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-purple-400 disabled:to-pink-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-md hover:shadow-lg transform active:scale-95 duration-100"
              title="Generate Video with AI"
            >
              <Video className="w-4 h-4" />
              <Sparkles className="w-3 h-3" />
              <span className="hidden sm:inline">Animate</span>
            </button>
            <button
              onClick={handleOpenMultiStripModal}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-md hover:shadow-lg transform active:scale-95 duration-100 relative"
              title="Multi-Strip Video - Combine multiple comic strips into one video"
            >
              <Film className="w-4 h-4" />
              <Layers className="w-3 h-3" />
              <span className="hidden sm:inline">Multi-Strip</span>
              {savedStrips.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 rounded-full text-xs flex items-center justify-center font-bold">
                  {savedStrips.length}
                </span>
              )}
            </button>
            <button
              onClick={handleUploadPanel}
              disabled={isUploading || Object.keys(images).length === 0 || !selectedProjectId}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-md hover:shadow-lg transform active:scale-95 duration-100"
              title={selectedProjectId ? "Upload Selected Panel to Project" : "Select a project first"}
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">{isUploading ? 'Uploading...' : 'Upload Panel'}</span>
            </button>

            <button
              onClick={handleExport}
              disabled={isExporting || Object.keys(images).length === 0}
              className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-500 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-md hover:shadow-lg transform active:scale-95 duration-100"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Download'}</span>
            </button>
          </div>
        </div>

        <div
          ref={canvasWrapperRef}
          className="flex-1 bg-slate-100 overflow-hidden flex items-center justify-center p-4 md:p-8 relative"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {Object.keys(images).length === 0 && !selectedPanelId && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-slate-200 text-xs text-slate-500 pointer-events-none z-20 flex items-center gap-2">
              <ZoomIn className="w-3 h-3" /> Click a panel to select it, then click an image to place it.
            </div>
          )}

          {selectedPanelId && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-full shadow-sm text-xs font-medium pointer-events-none z-20">
              Panel selected! Click an image in the sidebar to place it.
            </div>
          )}

          <div
            ref={canvasContainerRef}
            className="bg-white shadow-2xl rounded-sm border border-slate-300"
            style={{
              width: currentTemplate.width,
              height: currentTemplate.height,
              transform: `scale(${canvasScale})`,
              transformOrigin: 'center center',
            }}
          >
            {isMounted && (
              <ComicCanvas
                ref={stageRef}
                template={currentTemplate}
                images={images}
                selectedPanelId={selectedPanelId}
                onPanelClick={setSelectedPanelId}
              />
            )}
          </div>
        </div>
      </div>

      {/* Video Context Input Modal */}
      {showVideoContextInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowVideoContextInput(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Animate Your Comic</h2>
                  <p className="text-sm text-slate-500">Add context to enhance the animation</p>
                </div>
              </div>
              
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Comic Context (optional)
              </label>
              <textarea
                value={videoContext}
                onChange={(e) => setVideoContext(e.target.value)}
                placeholder="Describe your comic's story, characters, mood, or specific animations you'd like to see...&#10;&#10;Example: A superhero scene with dramatic tension. The hero is about to save the day. Add wind effects and intense lighting."
                className="w-full h-32 px-4 py-3 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
              <p className="mt-2 text-xs text-slate-500">
                This helps the AI understand what kind of subtle animations to add to your comic panels.
              </p>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowVideoContextInput(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateVideo}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
                >
                  <Video className="w-4 h-4" />
                  Generate Animation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Generation Modal */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={handleCloseVideoModal}
        videoUrl={videoUrl}
        isGenerating={isGeneratingVideo}
        progress={videoProgress}
        error={videoError}
        onRetry={handleRetryVideo}
        userId={userId ?? undefined}
      />

      {/* Multi-Strip Video Modal */}
      <MultiStripVideoModal
        isOpen={isMultiStripModalOpen}
        onClose={handleCloseMultiStripModal}
        strips={savedStrips}
        onAddCurrentStrip={handleAddCurrentStrip}
        onRemoveStrip={handleRemoveStrip}
        onReorderStrips={handleReorderStrips}
        onUpdateStrip={handleUpdateStrip}
        onGenerateVideo={handleGenerateMultiStripVideo}
        isGenerating={isGeneratingMultiStripVideo}
        progress={multiStripProgress}
        stripVideos={multiStripVideos}
        combinedVideoUrl={combinedVideoUrl}
        error={multiStripError}
        userId={userId ?? undefined}
        hasCurrentStripImages={Object.keys(images).length > 0}
      />

      {/* Create Project Modal */}
      {showCreateProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowCreateProjectModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FolderOpen className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Create New Project</h2>
                  <p className="text-sm text-slate-500">Organize your comic panels</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My Comic Story"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newProjectName.trim()) {
                      handleCreateProject();
                    }
                  }}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateProjectModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim() || isCreatingProject}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  {isCreatingProject ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
