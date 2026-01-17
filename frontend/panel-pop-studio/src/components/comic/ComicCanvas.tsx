'use client';

import React, { forwardRef } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import { ComicPanel } from './ComicPanel';
import { Template, ComicState } from '@/types';

interface ComicCanvasProps {
  template: Template;
  images: ComicState;
  selectedPanelId?: string | null;
  onPanelClick?: (panelId: string) => void;
}

export const ComicCanvas = forwardRef<any, ComicCanvasProps>(
  ({ template, images, selectedPanelId, onPanelClick }, ref) => {
    return (
      <Stage
        width={template.width}
        height={template.height}
        ref={ref}
      >
        <Layer>
          <Rect width={template.width} height={template.height} fill="#ffffff" />

          {template.panels.map((panel) => (
            <ComicPanel
              key={panel.id}
              config={panel}
              imageData={images[panel.id]}
              isSelected={selectedPanelId === panel.id}
              onPanelClick={onPanelClick}
            />
          ))}
        </Layer>
      </Stage>
    );
  }
);

ComicCanvas.displayName = 'ComicCanvas';
