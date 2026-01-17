'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Mic, MicOff, Keyboard, Video, VideoOff, Maximize, Minimize, Save } from 'lucide-react';
import { ToolType, DrawingConfig, GestureType } from '@/types';
import { generateConceptFromSketch } from '@/services/geminiService';
import { useAssets } from '@/context/AssetContext';
import { useAuth } from '@clerk/nextjs';
import { apiService } from '@/services/apiService';
import ProtectedRoute from '@/components/shared/ProtectedRoute';

const CanvasBoard = dynamic(
  () => import('@/components/gesture/CanvasBoard').then(mod => ({ default: mod.CanvasBoard })),
  { ssr: false }
);

const GestureSidebar = dynamic(
  () => import('@/components/gesture/GestureSidebar').then(mod => ({ default: mod.GestureSidebar })),
  { ssr: false }
);

const Cursor = dynamic(
  () => import('@/components/gesture/Cursor').then(mod => ({ default: mod.Cursor })),
  { ssr: false }
);

const AIModal = dynamic(
  () => import('@/components/gesture/AIModal').then(mod => ({ default: mod.AIModal })),
  { ssr: false }
);

// Dynamically import the hook to avoid SSR issues with MediaPipe
const useHandTrackingModule = () => {
  const [hook, setHook] = useState<any>(null);

  useEffect(() => {
    import('@/hooks/useHandTracking').then(mod => {
      setHook(() => mod.useHandTracking);
    });
  }, []);

  return hook;
};

interface CanvasApi {
  clear: () => void;
  getCanvasImage: () => string;
  setImage: (imageUrl: string) => void;
}

export default function GestureCanvasPage() {
  const useHandTracking = useHandTrackingModule();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || !useHandTracking) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading Gesture Canvas...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <GestureCanvasContent useHandTracking={useHandTracking} />
    </ProtectedRoute>
  );
}

function GestureCanvasContent({ useHandTracking }: { useHandTracking: any }) {
  const { videoRef, cursor, isPinching, gesture, isLoading, cameraError, rawHandPosition, gestureBox } = useHandTracking();
  const { addAsset, refreshAssets } = useAssets();
  const { getToken, userId, isSignedIn } = useAuth();

  // Initialize API service with auth token
  useEffect(() => {
    apiService.setAuthGetter(getToken);
  }, [getToken]);

  const [drawingConfig, setDrawingConfig] = useState<DrawingConfig>({
    color: '#000000',
    brushSize: 4,
    tool: ToolType.BRUSH,
  });

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<{ url: string, prompt: string } | null>(null);
  const [voicePrompt, setVoicePrompt] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Use state to store the canvas API instead of ref (works with dynamic imports)
  const [canvasApi, setCanvasApi] = useState<CanvasApi | null>(null);

  // Track sidebar drag state to disable drawing while dragging
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);

  // Camera toggle state
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resizable camera preview state
  const [cameraSize, setCameraSize] = useState({ width: 192, height: 144 }); // 4:3 aspect ratio, default w-48 = 192px
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const dataURLToFile = (dataUrl: string, filename: string): File => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/i)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  };

  // Callback when canvas is ready
  const handleCanvasReady = useCallback((api: CanvasApi) => {
    console.log('Canvas API ready:', api);
    setCanvasApi(api);
  }, []);

  const handleToolSelect = useCallback((tool: ToolType) => {
    if (tool === ToolType.CLEAR) {
      if (canvasApi) {
        canvasApi.clear();
        notify("Canvas Cleared");
      }
    } else {
      setDrawingConfig(prev => ({ ...prev, tool }));
      if (tool === ToolType.ERASER) notify("Eraser Mode");
      if (tool === ToolType.BRUSH) notify("Brush Mode");
    }
  }, [canvasApi]);

  const handleColorSelect = useCallback((color: string) => {
    setDrawingConfig(prev => ({ ...prev, color }));
  }, []);

  const handleScreenshot = useCallback(() => {
    const dataUrl = canvasApi?.getCanvasImage();
    if (dataUrl) {
      // Download the image
      const link = document.createElement('a');
      link.download = `canvas-snap-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      // Also save to assets
      addAsset(dataUrl, `Canvas Snap ${new Date().toLocaleTimeString()}`, 'gesture', 'image');
      notify("Screenshot saved & added to Assets!");
    }
  }, [canvasApi, addAsset]);

  // Save drawing to assets without downloading
  const handleSaveDrawing = useCallback(async () => {
    const dataUrl = canvasApi?.getCanvasImage();
    if (!dataUrl) return;

    // Save locally to assets for immediate feedback
    addAsset(dataUrl, `Drawing ${new Date().toLocaleTimeString()}`, 'gesture', 'image');

    // Upload to backend storage if signed in
    if (!isSignedIn || !userId) {
      notify("Saved locally. Sign in to sync to cloud.");
      return;
    }

    setIsUploading(true);
    try {
      const filename = `gesture-${Date.now()}.png`;
      const file = dataURLToFile(dataUrl, filename);

      const form = new FormData();
      form.append('file', file);
      form.append('user_id', userId);

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${baseUrl}/comics/upload-panel`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Upload failed');
      }
      const json = await res.json();
      const url = json?.public_url || null;

      if (url) {
        notify("Drawing uploaded to Cloud!");
      } else {
        notify("Uploaded. Configure bucket policy for public URLs.");
      }
    } catch (err) {
      console.error('[Gesture Upload] Error:', err);
      notify("Cloud upload failed");
    } finally {
      setIsUploading(false);
    }
  }, [canvasApi, addAsset, isSignedIn, userId]);

  // Toggle camera on/off
  const handleToggleCamera = useCallback(() => {
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) {
        const tracks = stream.getVideoTracks();
        tracks.forEach(track => {
          track.enabled = !isCameraEnabled;
        });
      }
      setIsCameraEnabled(!isCameraEnabled);
      notify(isCameraEnabled ? "Camera disabled" : "Camera enabled");
    }
  }, [isCameraEnabled, videoRef]);

  // Toggle fullscreen
  const handleToggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      try {
        if (!containerRef.current) {
          notify("Fullscreen unavailable");
          return;
        }
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        // Fullscreen requires trusted user gesture - gesture dwell may not qualify
        // Silently fail for programmatic triggers, only notify if it seems like a real failure
        console.log("Fullscreen request denied - may require direct click");
      }
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Camera resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: cameraSize.width,
      height: cameraSize.height
    };
  }, [cameraSize]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartRef.current.x;
      const deltaY = e.clientY - resizeStartRef.current.y;
      // Use the larger delta to maintain aspect ratio
      const delta = Math.max(deltaX, deltaY);
      const newWidth = Math.max(120, Math.min(400, resizeStartRef.current.width + delta));
      const newHeight = newWidth * 0.75; // 4:3 aspect ratio
      setCameraSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 'b':
          handleToolSelect(ToolType.BRUSH);
          break;
        case 'e':
          handleToolSelect(ToolType.ERASER);
          break;
        case 'c':
        case 'delete':
          handleToolSelect(ToolType.CLEAR);
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleScreenshot();
          }
          break;
        case '1':
          handleColorSelect('#000000');
          break;
        case '2':
          handleColorSelect('#EF4444');
          break;
        case '3':
          handleColorSelect('#3B82F6');
          break;
        case '4':
          handleColorSelect('#22C55E');
          break;
        case '5':
          handleColorSelect('#EAB308');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleColorSelect, handleScreenshot, handleToolSelect]);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition not supported in this browser. Please type your prompt or use Chrome.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    setIsListening(true);
    notify("Listening... Speak your prompt!");

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setVoicePrompt(transcript);
      notify(`Heard: "${transcript}"`);
      setIsListening(false);

      handleGenerate(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error(event.error);
      setIsListening(false);
      notify("Voice error. Try again.");
    };

    recognition.start();
  };

  const handleGenerate = async (promptOverride?: string) => {
    const promptToUse = promptOverride || voicePrompt;
    if (!promptToUse) {
      startListening();
      return;
    }

    const imageBase64 = canvasApi?.getCanvasImage();
    if (!imageBase64) return;

    setIsAIModalOpen(true);
    setIsGenerating(true);
    setGeneratedResult(null);

    try {
      // Try backend API first (authenticated, saves to user's gallery)
      const response = await apiService.generateImage({
        prompt: promptToUse,
        sketch_base64: imageBase64,
        style: 'comic book',
      });
      
      if (response.image_url) {
        setGeneratedResult({ url: response.image_url, prompt: promptToUse });
        // Refresh assets to show the new image
        refreshAssets();
      }
    } catch (e) {
      console.error('Backend generation failed, trying local:', e);
      // Fallback to local Gemini service
      try {
        const url = await generateConceptFromSketch(imageBase64, promptToUse);
        if (url) {
          setGeneratedResult({ url, prompt: promptToUse });
        }
      } catch (localError) {
        console.error('Local generation also failed:', localError);
        notify("AI Generation Failed");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToAssets = async (url: string) => {
    // Always add locally for immediate feedback
    addAsset(url, `Gesture Art: ${voicePrompt.slice(0, 20)}...`, 'gesture', 'image');
    notify("Saved locally to Assets. Uploading to Cloud...");

    // Upload to backend storage if signed in
    if (!isSignedIn || !userId) {
      notify("Saved locally. Sign in to sync to cloud.");
      return;
    }

    setIsUploading(true);
    try {
      const filename = `gesture-ai-${Date.now()}.png`;
      let file: File | null = null;

      if (url.startsWith('data:image')) {
        file = dataURLToFile(url, filename);
      } else {
        // Fetch remote image and re-upload as user's asset copy
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch generated image');
        const blob = await res.blob();
        const mime = blob.type || 'image/png';
        file = new File([blob], filename, { type: mime });
      }

      if (!file) throw new Error('No image file to upload');

      const form = new FormData();
      form.append('file', file);
      form.append('user_id', userId);

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${baseUrl}/comics/upload-panel`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Upload failed');
      }
      const json = await res.json();
      const publicUrl = json?.public_url || null;

      if (publicUrl) {
        // Add uploaded asset (public URL) and refresh list
        addAsset(publicUrl, `Gesture Art (Cloud): ${voicePrompt.slice(0, 20)}...`, 'gesture', 'image');
        notify("Uploaded to Cloud and added to Assets!");
        refreshAssets();
      } else {
        notify("Uploaded. Configure bucket policy for public URLs.");
      }
    } catch (err) {
      console.error('[Gesture SaveToAssets Upload] Error:', err);
      notify("Cloud upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyToCanvas = (url: string) => {
    if (canvasApi) {
      canvasApi.setImage(url);
      setIsAIModalOpen(false);
      notify("Image applied to canvas!");
    }
  };

  const handleClear = useCallback(() => {
    console.log('handleClear called, canvasApi:', canvasApi);
    if (canvasApi) {
      console.log('Calling canvas.clear()');
      canvasApi.clear();
      notify("Canvas Cleared!");
    } else {
      console.error('canvasApi is null');
    }
  }, [canvasApi]);

  if (cameraError) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 text-center p-4">
        <div className="max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Camera Error</h2>
          <p className="text-gray-600">{cameraError}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-white selection:bg-none">
      {/* Camera feed with gesture box overlay - positioned below navbar, resizable */}
      <div 
        className={`absolute top-2 left-4 z-10 transition-opacity ${isCameraEnabled ? 'opacity-90' : 'opacity-0'}`}
        style={{ width: cameraSize.width }}
      >
        <div className="relative rounded-lg overflow-hidden border-2 border-gray-300 bg-black">
          <video
            ref={videoRef}
            className="w-full pointer-events-none -scale-x-100"
            style={{ height: cameraSize.height }}
            autoPlay
            muted
            playsInline
          />
          {/* Gesture Box Overlay - shows the active tracking region */}
          {gestureBox && (
            <div 
              className="absolute border-2 border-green-500 bg-green-500/10 rounded pointer-events-none"
              style={{
                // gestureBox uses cursor-normalized coords (inverted X for natural interaction)
                // But video is mirrored, so we need to show the box in mirrored space
                // The box x/width are in "cursor space" (0=left screen, 1=right screen)
                // In mirrored video: left side of video = right side of physical space
                left: `${gestureBox.x * 100}%`,
                top: `${gestureBox.y * 100}%`,
                width: `${gestureBox.width * 100}%`,
                height: `${gestureBox.height * 100}%`,
              }}
            >
              <span className="absolute -top-5 left-0 text-xs text-green-600 font-medium bg-white/80 px-1 rounded">
                Draw Zone
              </span>
            </div>
          )}
          {/* Hand position indicator inside camera view */}
          {rawHandPosition && (
            <div 
              className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
              style={{
                // rawHandPosition.x is raw MediaPipe coords (0=left of sensor, 1=right)
                // Video element uses -scale-x-100 which mirrors it visually
                // We need to invert X to match the mirrored video display
                left: `${(1 - rawHandPosition.x) * 100}%`,
                top: `${rawHandPosition.y * 100}%`,
              }}
            />
          )}
          {/* Resize handle - bottom right corner */}
          <div
            onMouseDown={handleResizeStart}
            className={`absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-400/60 hover:bg-gray-500/80 transition-colors ${isResizing ? 'bg-blue-500/80' : ''}`}
            style={{
              clipPath: 'polygon(100% 0%, 100% 100%, 0% 100%)',
            }}
            title="Drag to resize"
          />
        </div>
        <p className="text-xs text-gray-500 text-center mt-1">Keep hand in green zone</p>
      </div>

      <CanvasBoard
        cursor={cursor}
        gesture={gesture}
        config={drawingConfig}
        useMouseInput={true}
        disableGestureDrawing={isSidebarDragging}
        onReady={handleCanvasReady}
      />

      <GestureSidebar
        cursor={cursor}
        currentConfig={drawingConfig}
        isPinching={isPinching}
        gesture={gesture}
        onToolSelect={handleToolSelect}
        onColorSelect={handleColorSelect}
        onGenerate={() => handleGenerate(voicePrompt)}
        onScreenshot={handleScreenshot}
        onClear={handleClear}
        onDragStateChange={setIsSidebarDragging}
        isGenerating={isGenerating}
        onToggleCamera={handleToggleCamera}
        isCameraEnabled={isCameraEnabled}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
      />

      <Cursor position={cursor} isPinching={isPinching} gesture={gesture} />

      {notification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full text-lg font-medium animate-bounce z-50">
          {notification}
        </div>
      )}

      {/* Controls Panel - Bottom Right (moved from left to avoid sidebar) */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-30">
        {/* Instructions */}
        <div className="bg-white/90 backdrop-blur p-4 rounded-xl border-2 border-gray-300 shadow-lg text-sm text-gray-700 max-w-xs">
          <p className="font-bold text-base mb-2">✋ Gesture Controls:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><span className="text-green-600 font-medium">☝️ Point</span> - Draw with brush</li>
            <li><span className="text-blue-600 font-medium">🤏 Pinch</span> - Draw with brush</li>
            <li><span className="text-red-600 font-medium">✊ Fist</span> - Erase</li>
            <li><span className="text-yellow-600 font-medium">🖐️ Palm</span> - Stop drawing</li>
            <li><span className="text-purple-600 font-medium">✌️ Peace</span> - Drag toolbar</li>
          </ul>
          <p className="text-xs text-gray-500 mt-2 italic">
            💡 Keep hand in the green "Draw Zone" shown in camera preview
          </p>
        </div>

        {/* Voice Prompt Button */}
        <button
          onClick={startListening}
          className={`flex items-center gap-2 px-5 py-4 rounded-xl shadow-lg font-medium transition-all text-base ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-gray-800 border-2 border-gray-300 hover:bg-gray-50'}`}
        >
          {isListening ? <MicOff size={22} /> : <Mic size={22} />}
          {isListening ? "Listening..." : (voicePrompt ? `Prompt: "${voicePrompt}"` : "Set Voice Prompt")}
        </button>
      </div>

      {/* Keyboard shortcuts indicator - Below navbar on right */}
      <div className="absolute top-2 right-4 z-30">
        <div className="bg-white/80 backdrop-blur px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Keyboard size={16} />
            <span>Press keys for shortcuts</span>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-white flex flex-col items-center justify-center z-[100]">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <h1 className="text-xl font-bold text-gray-800">Starting Vision Engine...</h1>
          <p className="text-gray-500 mt-2">Please allow camera access.</p>
        </div>
      )}

      <AIModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        generatedImage={generatedResult ? { url: generatedResult.url, prompt: generatedResult.prompt } : null}
        isLoading={isGenerating}
        prompt={voicePrompt}
        onSaveToAssets={handleSaveToAssets}
        onApplyToCanvas={handleApplyToCanvas}
      />
    </div>
  );
}
