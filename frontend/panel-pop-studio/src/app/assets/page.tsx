 'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, Download, Hand, LayoutGrid, Upload, RefreshCw, Image, Video, Play } from 'lucide-react';
import { useAssets } from '@/context/AssetContext';
import Link from 'next/link';
import ProtectedRoute from '@/components/shared/ProtectedRoute';
import { useAuth } from '@clerk/nextjs';
import { apiService, StorageAssetItem } from '@/services/apiService';

type GalleryTab = 'images' | 'videos';

export default function AssetsPage() {
  return (
    <ProtectedRoute>
      <GalleryContent />
    </ProtectedRoute>
  );
}

function GalleryContent() {
  const { assets, removeAsset, clearAssets, isLoading, refreshAssets } = useAssets();
  const { userId } = useAuth();
  const [activeTab, setActiveTab] = useState<GalleryTab>('images');
  const [cloudItems, setCloudItems] = useState<StorageAssetItem[]>([]);
  const [videoItems, setVideoItems] = useState<StorageAssetItem[]>([]);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [isVideosLoading, setIsVideosLoading] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  const refreshCloud = useCallback(async () => {
    if (!userId) {
      setCloudItems([]);
      return;
    }
    setIsCloudLoading(true);
    try {
      const res = await apiService.listUserStorageImages(userId, false);
      setCloudItems(res.items || []);
    } catch (err) {
      console.error('Failed to load cloud assets:', err);
      setCloudItems([]);
    } finally {
      setIsCloudLoading(false);
    }
  }, [userId]);

  const refreshVideos = useCallback(async () => {
    if (!userId) {
      setVideoItems([]);
      return;
    }
    setIsVideosLoading(true);
    try {
      const res = await apiService.listUserStorageVideos(userId, false);
      setVideoItems(res.items || []);
    } catch (err) {
      console.error('Failed to load videos:', err);
      setVideoItems([]);
    } finally {
      setIsVideosLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refreshCloud();
    refreshVideos();
  }, [refreshCloud, refreshVideos]);

  const combinedImages = useMemo(() => {
    return cloudItems.map((it) => ({
      id: it.path,
      url: it.url,
      name: it.name,
      createdAt: it.last_modified ? new Date(it.last_modified) : new Date(),
      source: 'upload' as const,
    }));
  }, [cloudItems]);

  const combinedVideos = useMemo(() => {
    return videoItems.map((it) => ({
      id: it.path,
      url: it.url,
      name: it.name,
      createdAt: it.last_modified ? new Date(it.last_modified) : new Date(),
    }));
  }, [videoItems]);

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'gesture':
        return <Hand className="w-3 h-3" />;
      case 'comic':
        return <LayoutGrid className="w-3 h-3" />;
      default:
        return <Upload className="w-3 h-3" />;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'gesture':
        return 'Gesture Canvas';
      case 'comic':
        return 'Comic Studio';
      default:
        return 'Uploaded';
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'images') {
      refreshCloud();
    } else {
      refreshVideos();
    }
  };

  const isCurrentLoading = activeTab === 'images' ? isCloudLoading : isVideosLoading;
  const currentItems = activeTab === 'images' ? combinedImages : combinedVideos;

  return (
    <div className="h-full bg-gray-900 p-8 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Gallery</h1>
            <p className="text-gray-400">
              Your images and generated comic videos in one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isCurrentLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isCurrentLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('images')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'images'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <Image className="w-5 h-5" />
            Images
            {combinedImages.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'images' ? 'bg-purple-500' : 'bg-gray-700'
              }`}>
                {combinedImages.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'videos'
                ? 'bg-pink-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <Video className="w-5 h-5" />
            Comic Videos
            {combinedVideos.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'videos' ? 'bg-pink-500' : 'bg-gray-700'
              }`}>
                {combinedVideos.length}
              </span>
            )}
          </button>
        </div>

        {isCurrentLoading ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Loading your {activeTab}...</p>
          </div>
        ) : currentItems.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
              {activeTab === 'images' ? (
                <Image className="w-10 h-10 text-gray-600" />
              ) : (
                <Video className="w-10 h-10 text-gray-600" />
              )}
            </div>
            <h2 className="text-xl font-semibold text-gray-300 mb-2">
              No {activeTab} yet
            </h2>
            <p className="text-gray-500 mb-6">
              {activeTab === 'images' 
                ? 'Create artwork in Gesture Canvas or upload images in Comic Studio'
                : 'Generate animated videos from your comics in Comic Studio'}
            </p>
            <div className="flex gap-4 justify-center">
              {activeTab === 'images' ? (
                <>
                  <Link
                    href="/gesture"
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  >
                    <Hand className="w-5 h-5" />
                    Open Gesture Canvas
                  </Link>
                  <Link
                    href="/comic"
                    className="flex items-center gap-2 px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors"
                  >
                    <LayoutGrid className="w-5 h-5" />
                    Open Comic Studio
                  </Link>
                </>
              ) : (
                <Link
                  href="/comic"
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-colors"
                >
                  <Video className="w-5 h-5" />
                  Create Animated Comic
                </Link>
              )}
            </div>
          </div>
        ) : activeTab === 'images' ? (
          /* Images Grid */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {combinedImages.map((asset) => (
              <div
                key={asset.id}
                className="group relative bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-gray-600 transition-all"
              >
                <div className="aspect-square">
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-white text-sm font-medium truncate mb-1">
                      {asset.name}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                      {getSourceIcon(asset.source)}
                      <span>{getSourceLabel(asset.source)}</span>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={asset.url}
                        download={`asset-${asset.id.toString().replace(/\W+/g, '-')}.png`}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-white/20 hover:bg-white/30 text-white text-xs rounded-lg transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </a>
                      {(!asset.id.toString().includes('/')) && (
                        <button
                          onClick={() => removeAsset(asset.id)}
                          className="px-3 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="absolute top-2 right-2">
                  <div className="px-2 py-1 rounded-full text-xs font-medium bg-gray-500/80 text-white">
                    {getSourceIcon(asset.source)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Videos Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {combinedVideos.map((video) => (
              <div
                key={video.id}
                className="group relative bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-purple-500/50 transition-all"
              >
                <div className="aspect-video relative">
                  {playingVideoId === video.id ? (
                    <video
                      src={video.url}
                      className="w-full h-full object-cover"
                      controls
                      autoPlay
                      onEnded={() => setPlayingVideoId(null)}
                    />
                  ) : (
                    <>
                      <video
                        src={video.url}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                      />
                      <div 
                        className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer hover:bg-black/30 transition-colors"
                        onClick={() => setPlayingVideoId(video.id)}
                      >
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                          <Play className="w-8 h-8 text-white ml-1" />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="p-4">
                  <p className="text-white text-sm font-medium truncate mb-1">
                    {video.name}
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    {video.createdAt.toLocaleDateString()}
                  </p>
                  <div className="flex gap-2">
                    <a
                      href={video.url}
                      download={`comic-video-${video.id.toString().replace(/\W+/g, '-')}.mp4`}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}