'use client';

import React from 'react';
import { Point, GestureType } from '@/types';

interface CursorProps {
  position: Point;
  isPinching: boolean;
  gesture: GestureType;
}

export const Cursor: React.FC<CursorProps> = ({ position, gesture }) => {
  // Determine cursor style based on gesture
  const getCursorStyles = () => {
    switch (gesture) {
      case GestureType.POINTER:
        return 'bg-green-500/80 border-green-600 w-4 h-4'; // Drawing mode - green, small
      case GestureType.PINCH:
        return 'bg-blue-500/80 border-blue-600 w-3 h-3'; // Selection/draw - blue, smaller
      case GestureType.VICTORY:
        return 'bg-purple-500/80 border-purple-600 w-6 h-6'; // Tool swap - purple
      case GestureType.OPEN_PALM:
        return 'bg-yellow-500/50 border-yellow-600 w-12 h-12'; // Navigation - yellow, large
      case GestureType.CLOSED_FIST:
        return 'bg-red-500/60 border-red-600 w-10 h-10'; // Eraser - red, large (shows eraser area)
      default:
        return 'bg-transparent border-gray-400 w-6 h-6'; // No gesture detected
    }
  };

  const showCrosshairs = gesture === GestureType.NONE;
  const isEraser = gesture === GestureType.CLOSED_FIST;

  return (
    <div
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
      className="fixed top-0 left-0 pointer-events-none z-50 flex items-center justify-center"
      // Center the cursor on position
    >
      <div
        className={`rounded-full border-2 transition-all duration-150 ${getCursorStyles()}`}
        style={{ transform: 'translate(-50%, -50%)' }}
      />
      {showCrosshairs && (
        <>
          <div className="absolute w-10 h-0.5 bg-gray-500/30" style={{ transform: 'translateY(-50%)' }}></div>
          <div className="absolute w-0.5 h-10 bg-gray-500/30" style={{ transform: 'translateX(-50%)' }}></div>
        </>
      )}
      {isEraser && (
        <div
          className="absolute text-xs text-red-600 font-bold whitespace-nowrap"
          style={{ transform: 'translate(-50%, 20px)' }}
        >
          ERASER
        </div>
      )}
    </div>
  );
};
