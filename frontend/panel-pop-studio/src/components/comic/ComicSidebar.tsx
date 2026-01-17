'use client';

import React, { useState, useEffect } from 'react';
import { Layout, Image as ImageIcon, Sparkles, Upload, Loader2, Grip, Video, RefreshCw } from 'lucide-react';
import { TabView, Template, Asset } from '@/types';
import { TEMPLATES } from '@/types/constants';
import { generateComicAsset } from '@/services/geminiService';
import { useAssets } from '@/context/AssetContext';
import { useAuth } from '@clerk/nextjs';
import { apiService } from '@/services/apiService';

// Helper function to calculate aspect ratio string from dimensions
const getAspectRatioLabel = (width: number, height: number): string => {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  const ratioW = width / divisor;
  const ratioH = height / divisor;
  
  // Simplify common ratios
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.05) return '1:1';
  if (Math.abs(ratio - 16/9) < 0.05) return '16:9';
  if (Math.abs(ratio - 9/16) < 0.05) return '9:16';
  if (Math.abs(ratio - 4/3) < 0.05) return '4:3';
  if (Math.abs(ratio - 3/4) < 0.05) return '3:4';
  if (Math.abs(ratio - 3/1) < 0.05) return '3:1';
  if (Math.abs(ratio - 1/3) < 0.05) return '1:3';
  if (Math.abs(ratio - 2/3) < 0.05) return '2:3';
  if (Math.abs(ratio - 3/2) < 0.05) return '3:2';
  if (Math.abs(ratio - 1/2) < 0.05) return '1:2';
  if (Math.abs(ratio - 2/1) < 0.05) return '2:1';
  
  // For other ratios, simplify if too complex
  if (ratioW > 20 || ratioH > 20) {
    if (ratio > 1) return `${ratio.toFixed(1)}:1`;
    return `1:${(1/ratio).toFixed(1)}`;
  }
  
  return `${ratioW}:${ratioH}`;
};

// Component to display image with aspect ratio tag
const ImageWithAspectRatio: React.FC<{
  src: string;
  isPlaced: boolean;
}> = ({ src, isPlaced }) => {
  const [aspectRatio, setAspectRatio] = useState<string | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setAspectRatio(getAspectRatioLabel(img.width, img.height));
    };
    img.src = src;
  }, [src]);

  return (
    <>
      <img src={src} alt="Asset" className="w-full h-full object-cover" />
      <div className={`absolute inset-0 transition-colors ${
        isPlaced ? 'bg-green-500/20' : 'bg-black/0 group-hover:bg-black/10'
      }`} />
      {aspectRatio && (
        <div className="absolute bottom-1 left-1 bg-slate-900/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded shadow-sm">
          {aspectRatio}
        </div>
      )}
      {isPlaced && (
        <div className="absolute top-1 right-1 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
          ✓ Placed
        </div>
      )}
    </>
  );
};

// Component to display video thumbnail
const VideoThumbnail: React.FC<{
  src: string;
  name: string;
}> = ({ src, name }) => {
  return (
    <>
      <video
        src={src}
        className="w-full h-full object-cover"
        muted
        playsInline
        preload="metadata"
        onMouseEnter={(e) => {
          const video = e.currentTarget;
          video.currentTime = 0;
          video.play().catch(() => {});
        }}
        onMouseLeave={(e) => {
          const video = e.currentTarget;
          video.pause();
          video.currentTime = 0;
        }}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      <div className="absolute top-1 left-1 bg-purple-600/90 text-white text-[10px] font-medium px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1">
        <Video className="w-3 h-3" />
        Video
      </div>
      <div className="absolute bottom-1 left-1 right-1 bg-slate-900/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded shadow-sm truncate">
        {name}
      </div>
    </>
  );
};

interface ComicSidebarProps {
  activeTab: TabView;
  setActiveTab: (tab: TabView) => void;
  userImages: string[];
  onUploadImage: (url: string) => void;
  onSelectTemplate: (template: Template) => void;
  currentTemplateId: string;
  placedImages: Record<string, any>;
  selectedPanelId?: string | null;
  onImageClick?: (src: string) => void;
}

type AssetSubTab = 'images' | 'videos';

export const ComicSidebar: React.FC<ComicSidebarProps> = ({
  activeTab,
  setActiveTab,
  userImages,
  onUploadImage,
  onSelectTemplate,
  currentTemplateId,
  placedImages,
  selectedPanelId,
  onImageClick,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetSubTab, setAssetSubTab] = useState<AssetSubTab>('images');
  const { assets, imageAssets, videoAssets, isLoading, addAsset, refreshAssets } = useAssets();
  const { getToken, isSignedIn } = useAuth();

  // Initialize API service with auth token
  useEffect(() => {
    apiService.setAuthGetter(getToken);
  }, [getToken]);

  // Refresh assets when tab becomes active
  useEffect(() => {
    if (activeTab === 'upload' && isSignedIn) {
      refreshAssets();
    }
  }, [activeTab, isSignedIn, refreshAssets]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Try to upload to backend if signed in
      if (isSignedIn) {
        try {
          const response = await apiService.uploadImage(file);
          onUploadImage(response.url);
          refreshAssets(); // Refresh to get from backend
          return;
        } catch (err) {
          console.error('Backend upload failed, using local:', err);
        }
      }
      
      // Fallback to local handling
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const url = event.target.result as string;
          onUploadImage(url);
          addAsset(url, file.name, 'upload', 'image');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      // Try backend API first (saves to user gallery)
      if (isSignedIn) {
        const response = await apiService.generateImage({
          prompt,
          style: 'comic book',
        });
        if (response.image_url) {
          onUploadImage(response.image_url);
          refreshAssets(); // Refresh to get from backend
          setPrompt('');
          return;
        }
      }
      
      // Fallback to local generation
      const assetUrl = await generateComicAsset(prompt);
      if (assetUrl) {
        onUploadImage(assetUrl);
        addAsset(assetUrl, `AI: ${prompt.slice(0, 20)}...`, 'comic', 'image');
        setPrompt('');
      } else {
        setError("Failed to generate image. Please try again.");
      }
    } catch (e) {
      setError("An error occurred during generation.");
    } finally {
      setIsGenerating(false);
    }
  };


  return (
    <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col h-full shadow-lg z-10">
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-600" />
          Comic Studio
        </h1>
      </div>

      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 transition-colors ${
            activeTab === 'templates'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Layout className="w-4 h-4" /> Layouts
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 transition-colors ${
            activeTab === 'upload'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ImageIcon className="w-4 h-4" /> Assets
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 transition-colors ${
            activeTab === 'ai'
              ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-4 h-4" /> AI Gen
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'templates' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Select Layout</h3>
            <div className="grid grid-cols-1 gap-4">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => onSelectTemplate(template)}
                  className={`relative group overflow-hidden rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                    currentTemplateId === template.id
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="bg-slate-100 p-4 aspect-[4/3] flex items-center justify-center">
                    <div className="relative w-full h-full bg-white shadow-sm border border-slate-300">
                      {template.panels.map((p, idx) => {
                        const panelRatio = getAspectRatioLabel(p.width, p.height);
                        return (
                          <div
                            key={p.id}
                            style={{
                              position: 'absolute',
                              left: `${(p.x / template.width) * 100}%`,
                              top: `${(p.y / template.height) * 100}%`,
                              width: `${(p.width / template.width) * 100}%`,
                              height: `${(p.height / template.height) * 100}%`,
                            }}
                            className="border border-slate-300 bg-slate-50 flex items-center justify-center"
                          >
                            <span className="text-[8px] text-slate-400 font-medium bg-white/80 px-1 rounded">
                              {panelRatio}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="p-3 bg-white flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-slate-700 text-sm">{template.name}</p>
                      <p className="text-xs text-slate-500">{template.panels.length} Panel{template.panels.length > 1 ? 's' : ''}</p>
                    </div>
                    {template.aspectRatio && (
                      <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-md font-medium">
                        {template.aspectRatio}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="space-y-4">
            {/* Sub-tabs for Images and Videos */}
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setAssetSubTab('images')}
                className={`flex-1 py-2 px-3 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  assetSubTab === 'images'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Images ({imageAssets.length})
              </button>
              <button
                onClick={() => setAssetSubTab('videos')}
                className={`flex-1 py-2 px-3 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  assetSubTab === 'videos'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                Videos ({videoAssets.length})
              </button>
            </div>

            {/* Refresh button */}
            <div className="flex justify-end">
              <button
                onClick={() => refreshAssets()}
                disabled={isLoading}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {/* Upload section - only show for images sub-tab */}
            {assetSubTab === 'images' && (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center hover:bg-slate-100 transition-colors">
                <label className="cursor-pointer flex flex-col items-center">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-sm font-medium text-slate-600">Upload Image</span>
                  <span className="text-xs text-slate-400 mt-1">JPG, PNG supported</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                </label>
              </div>
            )}

            {selectedPanelId && assetSubTab === 'images' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                <strong>Panel selected!</strong> Click an image below to place it.
              </div>
            )}

            {/* Images Grid */}
            {assetSubTab === 'images' && (
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Grip className="w-3 h-3" /> {selectedPanelId ? 'Click to Place' : 'Drag or Click'}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {/* Show local userImages first, then storage images */}
                  {[...userImages, ...imageAssets.map(a => a.url)].filter((v, i, arr) => arr.indexOf(v) === i).map((src, idx) => {
                    const isPlaced = Object.values(placedImages).some(
                      (panelImage: any) => panelImage?.src === src
                    );

                    return (
                      <div
                        key={idx}
                        className={`aspect-square bg-slate-100 rounded-lg overflow-hidden border-2 transition-all relative group ${
                          selectedPanelId
                            ? 'cursor-pointer hover:border-blue-500 hover:shadow-lg hover:scale-105'
                            : isPlaced
                              ? 'border-green-500 cursor-grab active:cursor-grabbing opacity-75'
                              : 'border-slate-200 cursor-grab active:cursor-grabbing hover:shadow-md'
                        } ${selectedPanelId && !isPlaced ? 'border-blue-300 ring-2 ring-blue-100' : ''}`}
                        draggable={!selectedPanelId}
                        onClick={() => {
                          if (selectedPanelId && onImageClick) {
                            onImageClick(src);
                          }
                        }}
                        onDragStart={(e) => {
                          if (selectedPanelId) {
                            e.preventDefault();
                            return;
                          }
                          console.log('[DragStart] Starting drag with src:', src);
                          e.dataTransfer.setData('image-src', src);
                          e.dataTransfer.effectAllowed = 'copy';
                          console.log('[DragStart] Data set successfully');
                        }}
                      >
                        <ImageWithAspectRatio src={src} isPlaced={isPlaced} />
                      </div>
                    );
                  })}
                  {userImages.length === 0 && imageAssets.length === 0 && (
                    <div className="col-span-2 py-8 text-center text-slate-400 text-sm italic">
                      {isLoading ? 'Loading images...' : 'No images yet. Upload or generate some!'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Videos Grid */}
            {assetSubTab === 'videos' && (
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Video className="w-3 h-3" /> Your Generated Videos
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {videoAssets.map((asset, idx) => (
                    <a
                      key={idx}
                      href={asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-video bg-slate-100 rounded-lg overflow-hidden border-2 border-slate-200 transition-all relative group hover:border-purple-400 hover:shadow-md"
                    >
                      <VideoThumbnail src={asset.url} name={asset.name} />
                    </a>
                  ))}
                  {videoAssets.length === 0 && (
                    <div className="col-span-2 py-8 text-center text-slate-400 text-sm italic">
                      {isLoading ? 'Loading videos...' : 'No videos yet. Generate some from your comics!'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
              <label className="block text-sm font-medium text-purple-900 mb-2">
                Describe your panel
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A superhero cat flying over a futuristic city..."
                className="w-full h-24 p-3 rounded-lg border border-purple-200 text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent resize-none bg-white"
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="mt-3 w-full bg-purple-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Generate Asset
                  </>
                )}
              </button>
              {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
            </div>

            <div className="text-xs text-slate-500 leading-relaxed px-1">
              <p className="mb-2"><strong>Tip:</strong> Be specific about style and content. Generated images will be added to your Assets tab.</p>
              <p>Example: <em>&quot;Close up of a surprised detective, noir style, black and white&quot;</em></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
