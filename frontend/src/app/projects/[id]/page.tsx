'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Trash2, RefreshCw, Image, LayoutGrid, Edit2, Check, X, Video, Play } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/shared/ProtectedRoute';
import { useAuth } from '@clerk/nextjs';
import { apiService, Project, ProjectPanel, ProjectVideo } from '@/services/apiService';

type TabType = 'panels' | 'videos';

export default function ProjectDetailPage() {
  return (
    <ProtectedRoute>
      <ProjectDetailContent />
    </ProtectedRoute>
  );
}

function ProjectDetailContent() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { userId, getToken } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('panels');
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  // Initialize API service with auth token
  useEffect(() => {
    apiService.setAuthGetter(getToken);
  }, [getToken]);

  const loadProject = useCallback(async () => {
    if (!userId || !projectId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiService.getProject(projectId, userId);
      setProject(data);
      setEditName(data.name);
      setEditDescription(data.description || '');
    } catch (err) {
      console.error('Failed to load project:', err);
      setProject(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId, projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleSaveEdit = async () => {
    if (!userId || !project || !editName.trim()) return;

    setIsSaving(true);
    try {
      const updated = await apiService.updateProject(project.id, userId, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      setProject(updated);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update project:', err);
      alert('Failed to update project. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePanel = async (panelId: string) => {
    if (!userId || !project) return;
    if (!window.confirm('Are you sure you want to delete this panel?')) {
      return;
    }

    try {
      await apiService.deletePanelFromProject(project.id, panelId, userId);
      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          panels: prev.panels.filter(p => p.id !== panelId),
        };
      });
    } catch (err) {
      console.error('Failed to delete panel:', err);
      alert('Failed to delete panel. Please try again.');
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!userId || !project) return;
    if (!window.confirm('Are you sure you want to delete this video?')) {
      return;
    }

    try {
      await apiService.deleteVideoFromProject(project.id, videoId, userId);
      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          videos: prev.videos.filter(v => v.id !== videoId),
        };
      });
      if (playingVideoId === videoId) {
        setPlayingVideoId(null);
      }
    } catch (err) {
      console.error('Failed to delete video:', err);
      alert('Failed to delete video. Please try again.');
    }
  };

  const handleDeleteProject = async () => {
    if (!userId || !project) return;
    if (!window.confirm('Are you sure you want to delete this entire project? This action cannot be undone.')) {
      return;
    }

    try {
      await apiService.deleteProject(project.id, userId);
      router.push('/projects');
    } catch (err) {
      console.error('Failed to delete project:', err);
      alert('Failed to delete project. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="h-full bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-full bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <LayoutGrid className="w-10 h-10 text-gray-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-300 mb-2">Project not found</h2>
          <p className="text-gray-500 mb-6">
            This project may have been deleted or you don&apos;t have access to it.
          </p>
          <Link
            href="/projects"
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors mx-auto w-fit"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/projects"
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>

              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-3 py-1 bg-gray-800 border border-gray-600 rounded-lg text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editName.trim()}
                    className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(project.name);
                      setEditDescription(project.description || '');
                    }}
                    className="p-2 text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">{project.name}</h1>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadProject}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleDeleteProject}
                className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Project
              </button>
            </div>
          </div>

          {project.description && !isEditing && (
            <p className="text-gray-400 mt-2 ml-14">{project.description}</p>
          )}

          {isEditing && (
            <div className="mt-2 ml-14">
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a description..."
                rows={2}
                className="w-full max-w-md px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
          )}

          <div className="flex items-center gap-4 mt-2 ml-14 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              <span>{project.panels.length} panels</span>
            </div>
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              <span>{project.videos?.length || 0} videos</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 ml-14">
            <button
              onClick={() => setActiveTab('panels')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'panels'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Image className="w-4 h-4" />
              Panels
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'videos'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Video className="w-4 h-4" />
              Videos
            </button>
          </div>
        </div>
      </div>

      {/* Content based on active tab */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {activeTab === 'panels' ? (
          /* Panels Tab */
          project.panels.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <Image className="w-10 h-10 text-gray-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-300 mb-2">No panels yet</h2>
              <p className="text-gray-500 mb-6">
                Go to Comic Studio and upload panels to this project.
              </p>
              <Link
                href="/comic"
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors mx-auto w-fit"
              >
                <LayoutGrid className="w-5 h-5" />
                Open Comic Studio
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {project.panels
                .sort((a, b) => a.panel_order - b.panel_order)
                .map((panel, index) => (
                  <div
                    key={panel.id}
                    className="group relative bg-gray-800 rounded-xl overflow-hidden border border-gray-700"
                  >
                    {/* Panel number indicator */}
                    <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full text-sm font-medium text-white">
                      Panel {index + 1}
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDeletePanel(panel.id)}
                      className="absolute top-4 right-4 z-10 p-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete panel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Panel image */}
                    <img
                      src={panel.image_url}
                      alt={`Panel ${index + 1}`}
                      className="w-full h-auto"
                    />
                  </div>
                ))}
            </div>
          )
        ) : (
          /* Videos Tab */
          (!project.videos || project.videos.length === 0) ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <Video className="w-10 h-10 text-gray-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-300 mb-2">No videos yet</h2>
              <p className="text-gray-500 mb-6">
                Generate animations in Comic Studio and save them to this project.
              </p>
              <Link
                href="/comic"
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors mx-auto w-fit"
              >
                <LayoutGrid className="w-5 h-5" />
                Open Comic Studio
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {project.videos
                .sort((a, b) => a.video_order - b.video_order)
                .map((video, index) => (
                  <div
                    key={video.id}
                    className="group relative bg-gray-800 rounded-xl overflow-hidden border border-gray-700"
                  >
                    {/* Video number/name indicator */}
                    <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full text-sm font-medium text-white">
                      {video.name || `Video ${index + 1}`}
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteVideo(video.id)}
                      className="absolute top-4 right-4 z-10 p-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete video"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Video player */}
                    <div className="relative">
                      <video
                        src={video.video_url}
                        controls
                        loop
                        className="w-full h-auto"
                        poster=""
                      />
                    </div>
                  </div>
                ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
