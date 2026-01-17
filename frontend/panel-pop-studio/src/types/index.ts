// Gesture Canvas Types
export type Point = {
  x: number;
  y: number;
};

export enum GestureType {
  NONE = 'NONE',
  PINCH = 'PINCH',
  OPEN_PALM = 'OPEN_PALM',
  CLOSED_FIST = 'CLOSED_FIST',
}

export type HandTrackerState = {
  cursor: Point;
  gesture: GestureType;
  isPinching: boolean;
  isLoading: boolean;
  cameraError: string | null;
};

export enum ToolType {
  BRUSH = 'BRUSH',
  ERASER = 'ERASER',
  AI_MAGIC = 'AI_MAGIC',
  SCREENSHOT = 'SCREENSHOT',
  CLEAR = 'CLEAR',
}

export interface DrawingConfig {
  color: string;
  brushSize: number;
  tool: ToolType;
}

export interface GeneratedImage {
  url: string;
  prompt: string;
}

// Comic Studio Types
export interface PanelConfig {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Template {
  id: string;
  name: string;
  panels: PanelConfig[];
  width: number;
  height: number;
  thumbnail?: string;
  aspectRatio?: string;
}

export interface PanelImageState {
  src: string;
  x: number;
  y: number;
  scale: number;
}

export interface ComicState {
  [panelId: string]: PanelImageState;
}

export type TabView = 'upload' | 'ai' | 'templates';

// Shared Types
export interface Asset {
  id: string;
  url: string;
  name: string;
  createdAt: Date;
  source: 'gesture' | 'comic' | 'upload' | 'storage';
  type: 'image' | 'video';
}

// Storage asset from Supabase bucket
export interface StorageAsset {
  path: string;
  name: string;
  url: string;
  size?: number;
  lastModified?: string;
  type: 'image' | 'video';
}
