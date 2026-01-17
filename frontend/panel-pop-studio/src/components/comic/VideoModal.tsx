'use client';

import React, { useState } from 'react';
import { X, Download, Loader2, Video, Sparkles, RefreshCw, Save, Check } from 'lucide-react';
import { saveVideoToStorage } from '@/services/videoService';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl?: string;
  isGenerating: boolean;
  progress?: number;
  error?: string;
  onRetry?: () => void;
  userId?: string;
  comicId?: string;
  panelId?: string;
}

export function VideoModal({
  isOpen,
  onClose,
  videoUrl,
  isGenerating,
  progress = 0,
  error,
  onRetry,
  userId,
  comicId,
  panelId,
}: VideoModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (!videoUrl) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `comic-video-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSave = async () => {
    if (!videoUrl) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await saveVideoToStorage(videoUrl, userId, comicId, panelId);
      setSaveSuccess(true);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save video');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full mx-4 overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Video className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Comic Animation</h2>
              <p className="text-xs text-slate-400">Powered by Google Veo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-purple-500/30 rounded-full animate-pulse" />
                <div 
                  className="absolute inset-0 w-24 h-24 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"
                />
                <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-purple-400" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-white">Bringing your comic to life...</h3>
              <p className="mt-2 text-slate-400 text-center max-w-md">
                Google Veo is analyzing your panels and creating a cinematic animation. This may take a few minutes.
              </p>
              {progress > 0 && (
                <div className="mt-6 w-full max-w-xs">
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-400 text-center">{progress}% complete</p>
                </div>
              )}
            </div>
          )}
          
          {error && !isGenerating && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                <X className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">Generation Failed</h3>
              <p className="mt-2 text-slate-400 text-center max-w-md">{error}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="mt-6 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              )}
            </div>
          )}
          
          {videoUrl && !isGenerating && !error && (
            <div className="space-y-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full object-contain"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              
              {saveError && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {saveError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download Video
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || saveSuccess}
                  className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                    saveSuccess
                      ? 'bg-green-600 text-white'
                      : 'bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white'
                  }`}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saveSuccess ? 'Saved!' : 'Save Video'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
