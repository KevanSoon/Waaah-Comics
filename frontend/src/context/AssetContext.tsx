'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Asset } from '@/types';
import { apiService } from '@/services/apiService';

interface AssetContextType {
  assets: Asset[];
  imageAssets: Asset[];
  videoAssets: Asset[];
  isLoading: boolean;
  addAsset: (url: string, name: string, source: Asset['source'], type?: Asset['type']) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  deleteStorageAsset: (path: string) => Promise<boolean>;
  clearAssets: () => void;
  refreshAssets: () => Promise<void>;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

export function AssetProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Set up API service with auth token getter
  useEffect(() => {
    if (isLoaded) {
      apiService.setAuthGetter(getToken);
    }
  }, [isLoaded, getToken]);

  // Fetch user assets when signed in - from Supabase storage
  const refreshAssets = useCallback(async () => {
    if (!isSignedIn || !userId) {
      setAssets([]);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch both images and videos from Supabase storage in parallel
      const [imagesResponse, videosResponse] = await Promise.all([
        apiService.listUserStorageImages(userId, false, 100, 0),
        apiService.listUserStorageVideos(userId, false, 100, 0),
      ]);

      // Map storage images to Asset format
      const imageAssets: Asset[] = imagesResponse.items.map((item) => ({
        id: item.path,
        url: item.url,
        name: item.name,
        createdAt: item.last_modified ? new Date(item.last_modified) : new Date(),
        source: 'storage' as const,
        type: 'image' as const,
      }));

      // Map storage videos to Asset format
      const videoAssets: Asset[] = videosResponse.items.map((item) => ({
        id: item.path,
        url: item.url,
        name: item.name,
        createdAt: item.last_modified ? new Date(item.last_modified) : new Date(),
        source: 'storage' as const,
        type: 'video' as const,
      }));

      // Combine and sort by creation date (newest first)
      const allAssets = [...imageAssets, ...videoAssets].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      setAssets(allAssets);
    } catch (error) {
      console.error('Failed to fetch assets from storage:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, userId]);

  // Load assets when auth state changes
  useEffect(() => {
    if (isLoaded) {
      refreshAssets();
    }
  }, [isLoaded, isSignedIn, refreshAssets]);

  const addAsset = useCallback(async (url: string, name: string, source: Asset['source'], type: Asset['type'] = 'image') => {
    // For local/temporary assets (not uploaded to backend)
    const newAsset: Asset = {
      id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url,
      name,
      createdAt: new Date(),
      source,
      type,
    };
    setAssets((prev) => [newAsset, ...prev]);
  }, []);

  const removeAsset = useCallback(async (id: string) => {
    // If it's a backend asset (has UUID format), delete from backend
    if (isSignedIn && id.includes('-') && !id.startsWith('asset-')) {
      try {
        await apiService.deleteImage(id);
      } catch (error) {
        console.error('Failed to delete asset from backend:', error);
      }
    }
    setAssets((prev) => prev.filter((asset) => asset.id !== id));
  }, [isSignedIn]);

  const clearAssets = useCallback(() => {
    setAssets([]);
  }, []);

  const deleteStorageAsset = useCallback(async (path: string): Promise<boolean> => {
    if (!isSignedIn || !userId) {
      return false;
    }

    try {
      await apiService.deleteStorageAsset(path, userId);
      // Remove from local state
      setAssets((prev) => prev.filter((asset) => asset.id !== path));
      return true;
    } catch (error) {
      console.error('Failed to delete storage asset:', error);
      return false;
    }
  }, [isSignedIn, userId]);

  // Derived state for filtered assets
  const imageAssets = assets.filter((a) => a.type === 'image');
  const videoAssets = assets.filter((a) => a.type === 'video');

  return (
    <AssetContext.Provider value={{ assets, imageAssets, videoAssets, isLoading, addAsset, removeAsset, deleteStorageAsset, clearAssets, refreshAssets }}>
      {children}
    </AssetContext.Provider>
  );
}

export function useAssets() {
  const context = useContext(AssetContext);
  if (context === undefined) {
    throw new Error('useAssets must be used within an AssetProvider');
  }
  return context;
}
