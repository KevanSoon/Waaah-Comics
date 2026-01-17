'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Point, DrawingConfig, ToolType } from '@/types';

interface CanvasBoardProps {
  cursor: Point;
  isPinching: boolean;
  config: DrawingConfig;
  useMouseInput?: boolean;
  disableDrawing?: boolean;
  onReady?: (api: CanvasApi) => void;
}

export interface CanvasApi {
  clear: () => void;
  getCanvasImage: () => string;
  setImage: (imageUrl: string) => void;
}

// Keep the old interface for backward compatibility
export interface CanvasRef extends CanvasApi { }

export const CanvasBoard: React.FC<CanvasBoardProps> = ({ cursor, isPinching, config, useMouseInput = true, disableDrawing = false, onReady }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastPosRef = useRef<Point | null>(null);
  const [isMouseDrawing, setIsMouseDrawing] = useState(false);
  const mouseLastPosRef = useRef<Point | null>(null);
  const apiRef = useRef<CanvasApi | null>(null);

  // Create the API object once canvas is ready
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use parent container size to account for navigation bar offset
    const parent = canvas.parentElement;
    canvas.width = parent?.clientWidth || window.innerWidth;
    canvas.height = parent?.clientHeight || window.innerHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      contextRef.current = ctx;

      // Create the API and notify parent
      const api: CanvasApi = {
        clear: () => {
          console.log('CanvasBoard.clear() called');
          const canvas = canvasRef.current;
          const ctx = contextRef.current;
          if (canvas && ctx) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            console.log('Canvas cleared successfully');
          }
        },
        getCanvasImage: () => {
          return canvasRef.current ? canvasRef.current.toDataURL('image/png') : '';
        },
        setImage: (imageUrl: string) => {
          const canvas = canvasRef.current;
          const ctx = contextRef.current;
          if (!canvas || !ctx) return;

          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.9;
            const newWidth = img.width * scale;
            const newHeight = img.height * scale;
            const x = (canvas.width - newWidth) / 2;
            const y = (canvas.height - newHeight) / 2;
            ctx.drawImage(img, x, y, newWidth, newHeight);
          };
          img.src = imageUrl;
        }
      };

      apiRef.current = api;
      if (onReady) {
        onReady(api);
      }
    }

    const handleResize = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      tempCanvas.getContext('2d')?.drawImage(canvas, 0, 0);

      // Use parent container size to account for navigation bar offset
      const parent = canvas.parentElement;
      canvas.width = parent?.clientWidth || window.innerWidth;
      canvas.height = parent?.clientHeight || window.innerHeight;

      const newCtx = canvas.getContext('2d');
      if (newCtx) {
        newCtx.lineCap = 'round';
        newCtx.lineJoin = 'round';
        newCtx.fillStyle = 'white';
        newCtx.fillRect(0, 0, canvas.width, canvas.height);
        newCtx.drawImage(tempCanvas, 0, 0);
        contextRef.current = newCtx;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse drawing handlers
  // Get canvas-relative coordinates from mouse event
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: e.clientX, y: e.clientY };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!useMouseInput || disableDrawing) return;
    setIsMouseDrawing(true);
    mouseLastPosRef.current = getCanvasCoords(e);
  }, [useMouseInput, disableDrawing, getCanvasCoords]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!useMouseInput || !isMouseDrawing || disableDrawing) return;
    const ctx = contextRef.current;
    if (!ctx) return;

    const currentPos = getCanvasCoords(e);

    if (mouseLastPosRef.current) {
      ctx.beginPath();
      ctx.moveTo(mouseLastPosRef.current.x, mouseLastPosRef.current.y);
      ctx.lineTo(currentPos.x, currentPos.y);

      if (config.tool === ToolType.ERASER) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 30;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = config.color;
        ctx.lineWidth = config.brushSize;
      }

      ctx.stroke();
    }

    mouseLastPosRef.current = currentPos;
  }, [useMouseInput, isMouseDrawing, config, disableDrawing, getCanvasCoords]);

  const handleMouseUp = useCallback(() => {
    setIsMouseDrawing(false);
    mouseLastPosRef.current = null;
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsMouseDrawing(false);
    mouseLastPosRef.current = null;
  }, []);

  // Gesture-based drawing (when pinching)
  useEffect(() => {
    // Skip drawing if disabled (e.g., when dragging the sidebar)
    if (disableDrawing) {
      lastPosRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!ctx || !canvas) return;

    // Convert window-based cursor to canvas-relative coordinates
    // (hand tracking returns window coordinates, but canvas may be offset by navigation bar)
    const rect = canvas.getBoundingClientRect();
    const canvasCursor = {
      x: cursor.x - rect.left,
      y: cursor.y - rect.top
    };

    if (isPinching) {
      if (!lastPosRef.current) {
        ctx.beginPath();
        ctx.moveTo(canvasCursor.x, canvasCursor.y);
      } else {
        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(canvasCursor.x, canvasCursor.y);

        if (config.tool === ToolType.ERASER) {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 30;
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = config.color;
          ctx.lineWidth = config.brushSize;
        }

        ctx.stroke();
      }
      lastPosRef.current = canvasCursor;
    } else {
      lastPosRef.current = null;
    }
  }, [cursor.x, cursor.y, isPinching, config, disableDrawing]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 touch-none cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  );
};

CanvasBoard.displayName = 'CanvasBoard';
