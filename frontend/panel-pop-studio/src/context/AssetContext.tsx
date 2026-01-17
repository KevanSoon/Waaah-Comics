'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Asset } from '@/types';
import { apiService } from '@/services/apiService';

interface AssetContextType {
  assets: Asset[];
  isLoading: boolean;
  addAsset: (url: string, name: string, source: Asset['source']) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  clearAssets: () => void;
  refreshAssets: () => Promise<void>;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

export function AssetProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Set up API service with auth token getter
  useEffect(() => {
    if (isLoaded) {
      apiService.setAuthGetter(getToken);
    }
  }, [isLoaded, getToken]);

  // Fetch user assets when signed in
  const refreshAssets = useCallback(async () => {
    if (!isSignedIn) {
      setAssets([]);
      return;
    }

    setIsLoading(true);
    try {
      const images = await apiService.getUserImages();
      const mappedAssets: Asset[] = images.map((img) => ({
        id: img.id,
        url: img.image_url,
        name: img.prompt || `Image ${img.id.slice(0, 8)}`,
        createdAt: new Date(img.created_at),
        source: (img.source_type === 'sketch' ? 'gesture' : 
                 img.source_type === 'comic' ? 'comic' : 'upload') as Asset['source'],
      }));
      setAssets(mappedAssets);
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn]);

  // Load assets when auth state changes
  useEffect(() => {
    if (isLoaded) {
      refreshAssets();
    }
  }, [isLoaded, isSignedIn, refreshAssets]);

  const addAsset = useCallback(async (url: string, name: string, source: Asset['source']) => {
    // For local/temporary assets (not uploaded to backend)
    const newAsset: Asset = {
      id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url,
      name,
      createdAt: new Date(),
      source,
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

  return (
    <AssetContext.Provider value={{ assets, isLoading, addAsset, removeAsset, clearAssets, refreshAssets }}>
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
