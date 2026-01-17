// Gesture Canvas Types
export type Point = {
  x: number;
  y: number;
};

// Gesture box defines the active region in normalized camera coordinates (0-1)
// Hand position within this box maps to the full canvas
export interface GestureBox {
  x: number;      // Left edge (0-1, where 0 is left of camera view)
  y: number;      // Top edge (0-1, where 0 is top of camera view)
  width: number;  // Width (0-1)
  height: number; // Height (0-1)
}

export enum GestureType {
  NONE = 'NONE',
  POINTER = 'POINTER',       // Index extended only - for drawing
  PINCH = 'PINCH',           // Thumb + Index close - for selection
  OPEN_PALM = 'OPEN_PALM',   // All 5 fingers extended - for navigation/panning
  VICTORY = 'VICTORY',       // Index + Middle extended - for tool swap
  CLOSED_FIST = 'CLOSED_FIST', // All fingers folded - for eraser/undo
}

export type HandTrackerState = {
  cursor: Point;           // Mapped cursor position on screen
  rawHandPosition: Point;  // Raw normalized hand position (0-1) for gesture box visualization
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
  source: 'gesture' | 'comic' | 'upload';
}
