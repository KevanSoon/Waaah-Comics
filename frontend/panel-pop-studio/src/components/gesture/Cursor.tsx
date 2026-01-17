'use client';

import React from 'react';
import { Point, GestureType } from '@/types';

interface CursorProps {
  position: Point;
  isPinching: boolean;
  gesture: GestureType;
}

export const Cursor: React.FC<CursorProps> = ({ position, isPinching, gesture }) => {
  return (
    <div
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
      className="fixed top-0 left-0 w-6 h-6 pointer-events-none z-50 flex items-center justify-center -ml-3 -mt-3"
    >
      <div
        className={`w-full h-full rounded-full border-2 transition-all duration-200 ${
          isPinching
            ? 'bg-blue-500 border-blue-600 scale-75'
            : 'bg-transparent border-red-500'
        } ${gesture === GestureType.CLOSED_FIST ? 'bg-red-500 scale-125' : ''}`}
      />
      {!isPinching && (
        <>
          <div className="absolute w-10 h-0.5 bg-red-500/30"></div>
          <div className="absolute w-0.5 h-10 bg-red-500/30"></div>
        </>
      )}
    </div>
  );
};
