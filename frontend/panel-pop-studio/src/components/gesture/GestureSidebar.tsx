'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Palette,
  Eraser,
  Sparkles,
  Trash2,
  GripVertical,
  Move,
  Maximize,
  Minimize,
  Save,
  Download,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ToolType, Point, DrawingConfig } from '@/types';

interface GestureSidebarProps {
  cursor: Point;
  currentConfig: DrawingConfig;
  isPinching: boolean;
  onToolSelect: (tool: ToolType) => void;
  onColorSelect: (color: string) => void;
  onGenerate: () => void;
  onScreenshot: () => void;
  onClear: () => void;
  onDragStateChange?: (isDragging: boolean) => void;
  isGenerating: boolean;
  onToggleCamera?: () => void;
  isCameraEnabled?: boolean;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  onSaveDrawing?: () => void;
}

const DWELL_TIME_MS = 1500;
const CLEAR_CONFIRM_TIME_MS = 5000; // 5 seconds for clear confirmation

export const GestureSidebar: React.FC<GestureSidebarProps> = ({
  cursor,
  currentConfig,
  isPinching,
  onToolSelect,
  onColorSelect,
  onGenerate,
  onScreenshot,
  onClear,
  onDragStateChange,
  isGenerating,
  onToggleCamera,
  isCameraEnabled = true,
  onToggleFullscreen,
  isFullscreen = false,
  onSaveDrawing,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  // Cooldown to prevent immediate re-trigger after action
  const cooldownIdRef = useRef<string | null>(null);
  const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear confirmation state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearProgress, setClearProgress] = useState(0);
  const clearStartTimeRef = useRef<number>(0);
  const clearAnimationRef = useRef<number>(0);
  const clearConfirmRef = useRef<HTMLDivElement>(null);

  // Draggable state
  const [position, setPosition] = useState({ x: -1, y: -1 }); // -1 means use default
  const [isDragging, setIsDragging] = useState(false);
  const [isGestureDragging, setIsGestureDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const sidebarRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // Track if cursor is over the panel
  const [isCursorOverPanel, setIsCursorOverPanel] = useState(false);

  // Check if cursor is over the sidebar panel
  useEffect(() => {
    if (!sidebarRef.current) return;
    const rect = sidebarRef.current.getBoundingClientRect();
    const isOver =
      cursor.x >= rect.left - 10 &&
      cursor.x <= rect.right + 10 &&
      cursor.y >= rect.top - 10 &&
      cursor.y <= rect.bottom + 10;
    setIsCursorOverPanel(isOver);
  }, [cursor.x, cursor.y]);

  // Notify parent when drag state changes OR cursor is over panel
  useEffect(() => {
    if (onDragStateChange) {
      onDragStateChange(isDragging || isGestureDragging || isCursorOverPanel);
    }
  }, [isDragging, isGestureDragging, isCursorOverPanel, onDragStateChange]);

  // Initialize default position on mount
  useEffect(() => {
    if (position.x === -1) {
      setPosition({
        x: window.innerWidth - 180,
        y: 80 // Position below navbar with some padding
      });
    }
  }, [position.x]);

  const buttons = [
    { id: 'color-black', type: 'color', value: '#000000', icon: null, color: 'bg-black' },
    { id: 'color-red', type: 'color', value: '#EF4444', icon: null, color: 'bg-red-500' },
    { id: 'color-blue', type: 'color', value: '#3B82F6', icon: null, color: 'bg-blue-500' },
    { id: 'color-green', type: 'color', value: '#22C55E', icon: null, color: 'bg-green-500' },
    { id: 'color-yellow', type: 'color', value: '#EAB308', icon: null, color: 'bg-yellow-500' },
    { id: 'tool-eraser', type: 'tool', value: ToolType.ERASER, icon: <Eraser size={24} />, label: 'Eraser' },
    { id: 'tool-brush', type: 'tool', value: ToolType.BRUSH, icon: <Palette size={24} />, label: 'Brush' },
    { id: 'action-save', type: 'action', value: 'save', icon: <Save size={24} />, label: 'Save to Cloud' },
    { id: 'action-clear', type: 'action', value: 'clear', icon: <Trash2 size={24} />, label: 'Clear Canvas' },
    { id: 'action-screenshot', type: 'action', value: 'screenshot', icon: <Download size={24} />, label: 'Download PNG' },
    { id: 'action-camera', type: 'action', value: 'camera', icon: isCameraEnabled ? <Eye size={24} /> : <EyeOff size={24} />, label: isCameraEnabled ? 'Hide Preview' : 'Show Preview' },
    { id: 'action-fullscreen', type: 'action', value: 'fullscreen', icon: isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />, label: isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' },
    { id: 'action-ai', type: 'action', value: 'ai', icon: <Sparkles size={24} />, label: 'AI Magic', special: true },
  ];

  const triggerAction = useCallback((id: string) => {
    const btn = buttons.find(b => b.id === id);
    if (!btn) return;

    if (btn.type === 'color') {
      onColorSelect(btn.value as string);
      onToolSelect(ToolType.BRUSH);
    } else if (btn.type === 'tool') {
      onToolSelect(btn.value as ToolType);
    } else if (btn.type === 'action') {
      if (btn.value === 'ai') onGenerate();
      if (btn.value === 'screenshot') onScreenshot();
      if (btn.value === 'save') onSaveDrawing?.();
      if (btn.value === 'camera') onToggleCamera?.();
      if (btn.value === 'fullscreen') onToggleFullscreen?.();
      if (btn.value === 'clear') {
        // Show confirmation popup instead of clearing directly
        setShowClearConfirm(true);
        setClearProgress(0);
      }
    }
  }, [onColorSelect, onGenerate, onScreenshot, onToolSelect, onSaveDrawing, onToggleCamera, onToggleFullscreen]);

  // Execute the actual clear
  const executeClean = useCallback(() => {
    onClear();
    setShowClearConfirm(false);
    setClearProgress(0);
  }, [onClear]);

  // Handle clear confirmation hover detection (for gesture)
  useEffect(() => {
    if (!showClearConfirm) return;

    const checkConfirmHover = () => {
      const element = document.elementFromPoint(cursor.x, cursor.y);
      const confirmBtn = element?.closest('[data-confirm-clear]');

      if (confirmBtn) {
        if (clearStartTimeRef.current === 0) {
          clearStartTimeRef.current = performance.now();
        }
        const elapsed = performance.now() - clearStartTimeRef.current;
        const newProgress = Math.min((elapsed / CLEAR_CONFIRM_TIME_MS) * 100, 100);
        setClearProgress(newProgress);

        if (newProgress >= 100) {
          executeClean();
          clearStartTimeRef.current = 0;
        } else {
          clearAnimationRef.current = requestAnimationFrame(checkConfirmHover);
        }
      } else {
        clearStartTimeRef.current = 0;
        setClearProgress(0);
        clearAnimationRef.current = requestAnimationFrame(checkConfirmHover);
      }
    };

    clearAnimationRef.current = requestAnimationFrame(checkConfirmHover);

    return () => {
      if (clearAnimationRef.current) cancelAnimationFrame(clearAnimationRef.current);
      clearStartTimeRef.current = 0;
    };
  }, [showClearConfirm, cursor.x, cursor.y, executeClean]);

  // Handle dragging with mouse
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const rect = sidebarRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragOffsetRef.current.x,
        y: e.clientY - dragOffsetRef.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Gesture-based dragging (pinch on drag handle)
  useEffect(() => {
    if (!dragHandleRef.current) return;

    const handleRect = dragHandleRef.current.getBoundingClientRect();
    const isOverDragHandle =
      cursor.x >= handleRect.left &&
      cursor.x <= handleRect.right &&
      cursor.y >= handleRect.top &&
      cursor.y <= handleRect.bottom;

    if (isPinching && isOverDragHandle) {
      if (!isGestureDragging) {
        // Start gesture dragging
        setIsGestureDragging(true);
        dragOffsetRef.current = {
          x: cursor.x - position.x,
          y: cursor.y - position.y
        };
      }
    } else if (!isPinching && isGestureDragging) {
      // Stop gesture dragging
      setIsGestureDragging(false);
    }

    // Update position while gesture dragging
    if (isGestureDragging && isPinching) {
      setPosition({
        x: cursor.x - dragOffsetRef.current.x,
        y: cursor.y - dragOffsetRef.current.y
      });
    }
  }, [cursor.x, cursor.y, isPinching, isGestureDragging, position.x, position.y]);

  // Gesture-based dwell detection
  useEffect(() => {
    if (isDragging) return;

    const element = document.elementFromPoint(cursor.x, cursor.y);
    const button = element?.closest('[data-dwell-target]');

    if (button) {
      const id = button.getAttribute('data-id');
      // Skip if this button is in cooldown (was just triggered)
      if (id === cooldownIdRef.current) {
        return;
      }
      if (id !== hoveredId) {
        setHoveredId(id);
        startTimeRef.current = performance.now();
        setProgress(0);
      }
    } else {
      setHoveredId(null);
      setProgress(0);
      // Clear cooldown when cursor leaves all buttons
      if (cooldownIdRef.current) {
        cooldownIdRef.current = null;
        if (cooldownTimeoutRef.current) {
          clearTimeout(cooldownTimeoutRef.current);
          cooldownTimeoutRef.current = null;
        }
      }
    }
  }, [cursor.x, cursor.y, hoveredId, isDragging]);

  useEffect(() => {
    if (!hoveredId || isDragging) {
      setProgress(0);
      return;
    }

    const updateProgress = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const newProgress = Math.min((elapsed / DWELL_TIME_MS) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        // Set cooldown for this button to prevent immediate re-trigger
        cooldownIdRef.current = hoveredId;
        // Clear cooldown after 500ms as a safety fallback
        if (cooldownTimeoutRef.current) {
          clearTimeout(cooldownTimeoutRef.current);
        }
        cooldownTimeoutRef.current = setTimeout(() => {
          cooldownIdRef.current = null;
          cooldownTimeoutRef.current = null;
        }, 500);

        triggerAction(hoveredId);
        setHoveredId(null);
        setProgress(0);
      } else {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [hoveredId, isDragging, triggerAction]);

  // Handle click for mouse users
  const handleButtonClick = useCallback((btn: typeof buttons[0]) => {
    if (btn.type === 'color') {
      onColorSelect(btn.value as string);
      onToolSelect(ToolType.BRUSH);
    } else if (btn.type === 'tool') {
      onToolSelect(btn.value as ToolType);
    } else if (btn.type === 'action') {
      if (btn.value === 'ai') onGenerate();
      if (btn.value === 'screenshot') onScreenshot();
      if (btn.value === 'save') onSaveDrawing?.();
      if (btn.value === 'camera') onToggleCamera?.();
      if (btn.value === 'fullscreen') onToggleFullscreen?.();
      if (btn.value === 'clear') {
        // Show confirmation popup instead of clearing directly
        setShowClearConfirm(true);
        setClearProgress(0);
      }
    }
  }, [onColorSelect, onGenerate, onScreenshot, onToolSelect, onSaveDrawing, onToggleCamera, onToggleFullscreen]);

  if (position.x === -1) return null;

  return (
    <div
      ref={sidebarRef}
      style={{
        left: position.x,
        top: position.y,
        cursor: (isDragging || isGestureDragging) ? 'grabbing' : 'default'
      }}
      className="fixed flex flex-row gap-1 bg-white/95 backdrop-blur-sm p-2 rounded-2xl shadow-xl z-40 border-2 border-gray-300"
    >
      {/* Drag handle - positioned on the left */}
      <div
        ref={dragHandleRef}
        onMouseDown={handleDragStart}
        className={`flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-lg cursor-grab active:cursor-grabbing transition-colors ${isGestureDragging ? 'bg-blue-200' : 'bg-gray-100 hover:bg-gray-200'
          }`}
      >
        <GripVertical size={16} className="text-gray-500" />
        <Move size={12} className="text-gray-400" />
        <GripVertical size={16} className="text-gray-500" />
      </div>

      {/* Buttons container - 2 columns */}
      <div className="grid grid-cols-2 gap-1.5">
        {buttons.map((btn) => {
          const isHovered = hoveredId === btn.id;
          const isActive =
            (btn.type === 'tool' && currentConfig.tool === btn.value) ||
            (btn.type === 'color' && currentConfig.color === btn.value && currentConfig.tool === ToolType.BRUSH);

          return (
            <button
            key={btn.id}
            data-dwell-target="true"
            data-id={btn.id}
              onClick={() => handleButtonClick(btn)}
              title={btn.label || btn.value?.toString()}
            className={`
              relative flex items-center justify-center w-14 h-14 rounded-full transition-all duration-200
              ${isActive ? 'ring-3 ring-offset-1 ring-indigo-400 scale-110' : 'hover:scale-105'}
              ${btn.special ? 'bg-gradient-to-tr from-purple-600 to-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
            `}
          >
            {isHovered && (
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke={btn.special ? '#FCD34D' : '#3B82F6'}
                  strokeWidth="8"
                  strokeDasharray="289.02"
                  strokeDashoffset={289.02 - (289.02 * progress) / 100}
                  className="transition-all duration-75 ease-linear"
                />
              </svg>
            )}

            {btn.icon ? (
              btn.icon
            ) : (
                  <div className={`w-7 h-7 rounded-full ${btn.color} border-2 border-white shadow-sm`} />
            )}

              {/* Tooltip */}
              <span className="absolute left-full ml-3 bg-black/90 text-white text-sm px-3 py-1.5 rounded-lg opacity-0 hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                {btn.label || btn.value?.toString()}
            </span>
            </button>
        );
      })}
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]"
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            ref={clearConfirmRef}
            className="bg-white rounded-2xl p-8 shadow-2xl max-w-md mx-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-20 h-20 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 size={40} className="text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Clear Canvas?</h2>
            <p className="text-gray-600 mb-6">This will erase all your work. This action cannot be undone.</p>

            <div className="flex flex-col gap-3">
              {/* Confirm button - SIMPLE DIRECT CLICK */}
              <button
                data-confirm-clear="true"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Clear button clicked, calling onClear');
                  onClear();
                  setShowClearConfirm(false);
                  setClearProgress(0);
                }}
                className="relative px-6 py-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors overflow-hidden"
              >
                {/* Progress bar for hover confirmation */}
                {clearProgress > 0 && (
                  <div
                    className="absolute inset-0 bg-red-800 transition-all duration-100"
                    style={{ width: `${clearProgress}%` }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <Trash2 size={20} />
                  {clearProgress > 0
                    ? `Hold... ${Math.ceil((CLEAR_CONFIRM_TIME_MS - (clearProgress * CLEAR_CONFIRM_TIME_MS / 100)) / 1000)}s`
                    : 'Click to Clear'
                  }
                </span>
              </button>

              {/* Cancel button */}
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>

            <p className="text-sm text-gray-400 mt-4">
              Gesture: Hover over red button for 5 seconds
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
