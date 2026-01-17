'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  Loader2, 
  Video, 
  Sparkles, 
  RefreshCw, 
  Save, 
  Check,
  Trash2,
  Plus,
  Play,
  Film,
  Layers,
  ChevronUp,
  ChevronDown,
  Pencil,
  FolderPlus
} from 'lucide-react';
import { ComicStrip, MultiStripVideoProgress } from '@/types';
import { saveVideoToStorage } from '@/services/videoService';
import { useProjects } from '@/context/ProjectsContext';
import { apiService } from '@/services/apiService';

interface MultiStripVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  strips: ComicStrip[];
  onAddCurrentStrip: () => void;
  onRemoveStrip: (stripId: string) => void;
  onReorderStrips: (strips: ComicStrip[]) => void;
  onUpdateStrip: (stripId: string, updates: Partial<ComicStrip>) => void;
  onGenerateVideo: () => void;
  isGenerating: boolean;
  progress?: MultiStripVideoProgress;
  stripVideos: { stripId: string; name: string; videoUrl: string }[];
  combinedVideoUrl?: string;
  error?: string;
  userId?: string;
  hasCurrentStripImages: boolean;
}

export function MultiStripVideoModal({
  isOpen,
  onClose,
  strips,
  onAddCurrentStrip,
  onRemoveStrip,
  onReorderStrips,
  onUpdateStrip,
  onGenerateVideo,
  isGenerating,
  progress,
  stripVideos,
  combinedVideoUrl,
  error,
  userId,
  hasCurrentStripImages,
}: MultiStripVideoModalProps) {
  const { projects, refreshProjects } = useProjects();
  const [activeTab, setActiveTab] = useState<'strips' | 'preview'>('strips');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  
  // Save to project state
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [isSavingToProject, setIsSavingToProject] = useState(false);
  const [saveToProjectSuccess, setSaveToProjectSuccess] = useState<string | null>(null);
  const [saveToProjectError, setSaveToProjectError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [editingStripId, setEditingStripId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editContext, setEditContext] = useState('');

  // Switch to preview tab when videos are ready
  useEffect(() => {
    if (combinedVideoUrl || stripVideos.length > 0) {
      setActiveTab('preview');
    }
  }, [combinedVideoUrl, stripVideos]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Refresh projects when modal opens
  useEffect(() => {
    if (isOpen) {
      refreshProjects();
      setSaveToProjectSuccess(null);
      setSaveToProjectError(null);
    }
  }, [isOpen, refreshProjects]);

  if (!isOpen) return null;

  const startEditing = (strip: ComicStrip) => {
    setEditingStripId(strip.id);
    setEditName(strip.name);
    setEditContext(strip.context || '');
  };

  const saveEditing = () => {
    if (editingStripId) {
      onUpdateStrip(editingStripId, { 
        name: editName.trim() || `Strip ${strips.findIndex(s => s.id === editingStripId) + 1}`,
        context: editContext.trim() || undefined 
      });
      setEditingStripId(null);
    }
  };

  const cancelEditing = () => {
    setEditingStripId(null);
    setEditName('');
    setEditContext('');
  };

  const moveStrip = (index: number, direction: 'up' | 'down') => {
    const newStrips = [...strips];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= strips.length) return;
    
    [newStrips[index], newStrips[newIndex]] = [newStrips[newIndex], newStrips[index]];
    onReorderStrips(newStrips);
  };

  const handleDownload = async (videoUrl: string, filename?: string) => {
    setIsDownloading(true);
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `comic-video-${Date.now()}.mp4`;
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

  const handleSave = async (videoUrl: string) => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await saveVideoToStorage(videoUrl, userId);
      setSaveSuccess(true);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save video');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToProject = async (videoUrl: string, projectId: string, projectName: string) => {
    if (!videoUrl || !userId) return;

    setIsSavingToProject(true);
    setSaveToProjectError(null);
    setSaveToProjectSuccess(null);
    setShowProjectDropdown(false);

    try {
      await apiService.addVideoToProject(projectId, userId, {
        video_url: videoUrl,
        name: `Multi-Strip Video - ${new Date().toLocaleDateString()}`,
      });
      setSaveToProjectSuccess(projectName);
    } catch (err) {
      console.error('Save to project failed:', err);
      setSaveToProjectError(err instanceof Error ? err.message : 'Failed to save to project');
    } finally {
      setIsSavingToProject(false);
    }
  };

  const progressPercentage = progress 
    ? Math.round((progress.currentStrip / progress.totalStrips) * 100)
    : 0;

  const currentVideoUrl = combinedVideoUrl || stripVideos[selectedVideoIndex]?.videoUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={!isGenerating ? onClose : undefined}
      />
      
      {/* Modal */}
      <div className="relative bg-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full mx-4 overflow-hidden border border-slate-700 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg">
              <Film className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Multi-Strip Video</h2>
              <p className="text-xs text-slate-400">Combine multiple comic strips into one video</p>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('strips')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'strips' 
                  ? 'bg-slate-700 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4 inline mr-1.5" />
              Strips ({strips.length})
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              disabled={!combinedVideoUrl && stripVideos.length === 0}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                activeTab === 'preview' 
                  ? 'bg-slate-700 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Play className="w-4 h-4 inline mr-1.5" />
              Preview
            </button>
          </div>

          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Strips Tab */}
          {activeTab === 'strips' && (
            <div className="p-6 h-full overflow-auto">
              {/* Add Current Strip Button */}
              <div className="mb-6">
                <button
                  onClick={onAddCurrentStrip}
                  disabled={!hasCurrentStripImages || isGenerating}
                  className="w-full py-3 px-4 border-2 border-dashed border-slate-600 hover:border-purple-500 rounded-xl text-slate-400 hover:text-purple-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-5 h-5" />
                  Add Current Comic Strip to Sequence
                </button>
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Save your current comic strip, then create a new one and add it to build your video sequence.
                </p>
              </div>

              {/* Strip List */}
              {strips.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <Layers className="w-8 h-8 text-slate-600" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No Strips Added Yet</h3>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Create comic strips and add them to this sequence. Each strip will become a scene in your final video.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {strips.map((strip, index) => (
                    <div
                      key={strip.id}
                      className={`bg-slate-800 rounded-xl p-4 ${editingStripId === strip.id ? 'ring-2 ring-purple-500' : ''}`}
                    >
                      {editingStripId === strip.id ? (
                        /* Editing Mode */
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-20 h-14 bg-slate-700 rounded-lg overflow-hidden shrink-0">
                              {strip.thumbnail && (
                                <img 
                                  src={strip.thumbnail} 
                                  alt={strip.name}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs text-slate-400 mb-1">Strip Name</label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="Strip name..."
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Animation Context (optional)</label>
                            <textarea
                              value={editContext}
                              onChange={(e) => setEditContext(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none h-20"
                              placeholder="Describe the mood, characters, or specific animations for this strip..."
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={cancelEditing}
                              className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={saveEditing}
                              className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Display Mode */
                        <div className="flex items-center gap-4 group">
                          {/* Reorder Controls */}
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => moveStrip(index, 'up')}
                              disabled={index === 0 || isGenerating}
                              className="p-1 text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => moveStrip(index, 'down')}
                              disabled={index === strips.length - 1 || isGenerating}
                              className="p-1 text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Thumbnail */}
                          <div className="w-24 h-16 bg-slate-700 rounded-lg overflow-hidden shrink-0">
                            {strip.thumbnail ? (
                              <img 
                                src={strip.thumbnail} 
                                alt={strip.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Video className="w-6 h-6 text-slate-500" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-purple-400">#{index + 1}</span>
                              <h4 className="font-medium text-white truncate">{strip.name}</h4>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              {strip.template.name} • {Object.keys(strip.images).length} panels
                            </p>
                            {strip.context && (
                              <p className="text-xs text-slate-500 mt-1 truncate" title={strip.context}>
                                🎬 {strip.context}
                              </p>
                            )}
                          </div>

                          {/* Video Status */}
                          {stripVideos.find(v => v.stripId === strip.id) && (
                            <div className="px-2 py-1 bg-green-500/20 rounded-md">
                              <Check className="w-4 h-4 text-green-400" />
                            </div>
                          )}

                          {/* Edit Button */}
                          <button
                            onClick={() => startEditing(strip)}
                            disabled={isGenerating}
                            className="p-2 text-slate-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                            title="Edit strip"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {/* Remove Button */}
                          <button
                            onClick={() => onRemoveStrip(strip.id)}
                            disabled={isGenerating}
                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                            title="Remove strip"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Generate Button */}
              {strips.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <button
                    onClick={onGenerateVideo}
                    disabled={isGenerating || strips.length === 0 || editingStripId !== null}
                    className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-purple-800 disabled:to-pink-800 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating... ({progress?.currentStrip || 0}/{progress?.totalStrips || strips.length})
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Generate {strips.length > 1 ? `${strips.length} Strip Video` : 'Video'}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <div className="p-6 h-full overflow-auto">
              {isGenerating && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="relative">
                    <div className="w-24 h-24 border-4 border-purple-500/30 rounded-full animate-pulse" />
                    <div 
                      className="absolute inset-0 w-24 h-24 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"
                    />
                    <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-white">
                    {progress?.stage === 'combining' ? 'Combining videos...' : `Generating Strip ${progress?.currentStrip || 1}...`}
                  </h3>
                  <p className="mt-2 text-slate-400 text-center max-w-md">
                    {progress?.stripName && `Currently processing: ${progress.stripName}`}
                  </p>
                  <div className="mt-6 w-full max-w-xs">
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                    <p className="mt-2 text-sm text-slate-400 text-center">
                      {progressPercentage}% complete
                    </p>
                  </div>
                </div>
              )}

              {error && !isGenerating && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                    <X className="w-8 h-8 text-red-400" />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-white">Generation Failed</h3>
                  <p className="mt-2 text-slate-400 text-center max-w-md">{error}</p>
                  <button
                    onClick={onGenerateVideo}
                    className="mt-6 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </button>
                </div>
              )}

              {currentVideoUrl && !isGenerating && !error && (
                <div className="space-y-4">
                  {/* Video Selector for Multiple Videos */}
                  {!combinedVideoUrl && stripVideos.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {stripVideos.map((video, index) => (
                        <button
                          key={video.stripId}
                          onClick={() => setSelectedVideoIndex(index)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                            selectedVideoIndex === index
                              ? 'bg-purple-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {video.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Video Player */}
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                      key={currentVideoUrl}
                      src={currentVideoUrl}
                      controls
                      autoPlay
                      loop
                      className="w-full h-full object-contain"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>

                  {/* Video Info */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                      {combinedVideoUrl 
                        ? `Combined Video (${stripVideos.length} strips)` 
                        : stripVideos[selectedVideoIndex]?.name}
                    </span>
                    {stripVideos.length > 1 && !combinedVideoUrl && (
                      <span className="text-slate-500">
                        Note: Videos could not be combined. Download individually.
                      </span>
                    )}
                  </div>

                  {saveError && (
                    <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                      {saveError}
                    </div>
                  )}

                  {saveToProjectError && (
                    <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                      {saveToProjectError}
                    </div>
                  )}

                  {saveToProjectSuccess && (
                    <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Saved to project "{saveToProjectSuccess}"
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3">
                    {/* Download Current Video */}
                    <button
                      onClick={() => handleDownload(currentVideoUrl, `comic-video-${combinedVideoUrl ? 'combined' : stripVideos[selectedVideoIndex]?.name}-${Date.now()}.mp4`)}
                      disabled={isDownloading}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Download {combinedVideoUrl ? 'Combined' : 'Current'}
                    </button>

                    {/* Download All (if multiple) */}
                    {stripVideos.length > 1 && !combinedVideoUrl && (
                      <button
                        onClick={async () => {
                          for (const video of stripVideos) {
                            await handleDownload(video.videoUrl, `comic-video-${video.name}-${Date.now()}.mp4`);
                          }
                        }}
                        disabled={isDownloading}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download All ({stripVideos.length})
                      </button>
                    )}

                    {/* Save to Project Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                      <button
                        onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                        disabled={isSavingToProject || !userId}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                      >
                        {isSavingToProject ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FolderPlus className="w-4 h-4" />
                        )}
                        Save to Project
                        <ChevronDown className={`w-4 h-4 transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showProjectDropdown && (
                        <div className="absolute left-0 bottom-full mb-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 overflow-hidden">
                          <div className="p-2 border-b border-slate-700">
                            <p className="text-xs text-slate-400 font-medium">Select a project</p>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {projects.length === 0 ? (
                              <div className="p-4 text-center text-slate-400 text-sm">
                                No projects yet. Create one in the Projects page.
                              </div>
                            ) : (
                              projects.map((project) => (
                                <button
                                  key={project.id}
                                  onClick={() => handleSaveToProject(currentVideoUrl, project.id, project.name)}
                                  className="w-full px-4 py-2 text-left text-white hover:bg-slate-700 transition-colors flex items-center gap-2"
                                >
                                  <FolderPlus className="w-4 h-4 text-indigo-400" />
                                  <span className="truncate">{project.name}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Save to Cloud */}
                    <button
                      onClick={() => handleSave(currentVideoUrl)}
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
                      {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save to Cloud'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress Bar (shown during generation) */}
        {isGenerating && (
          <div className="h-1 bg-slate-800">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
