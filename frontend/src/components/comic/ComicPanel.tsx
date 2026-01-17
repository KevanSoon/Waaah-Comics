'use client';

import React from 'react';
import { Group, Rect, Image as KonvaImage, Text } from 'react-konva';
import useImage from 'use-image';
import { PanelConfig, PanelImageState } from '@/types';

interface ComicPanelProps {
  config: PanelConfig;
  imageData?: PanelImageState;
  isSelected?: boolean;
  onPanelClick?: (panelId: string) => void;
}

const ImageInPanel = ({
  src,
  x,
  y,
  scale,
  panelWidth,
  panelHeight,
}: {
  src: string,
  x: number,
  y: number,
  scale: number,
  panelWidth: number,
  panelHeight: number,
}) => {
  // Use 'anonymous' crossOrigin for external URLs, undefined for data URLs
  const crossOrigin = src.startsWith('data:') ? undefined : 'anonymous';
  const [image] = useImage(src, crossOrigin);

  // Calculate cover-fit dimensions when image loads (fills panel, may crop)
  const fitDimensions = React.useMemo(() => {
    if (!image) return { x: 0, y: 0, scale: 1 };
    
    const imageWidth = image.width;
    const imageHeight = image.height;
    
    // Calculate scale to cover panel completely (cover behavior - may crop)
    const scaleX = panelWidth / imageWidth;
    const scaleY = panelHeight / imageHeight;
    const fitScale = Math.max(scaleX, scaleY);
    
    // Center the image in the panel
    const fittedWidth = imageWidth * fitScale;
    const fittedHeight = imageHeight * fitScale;
    const centerX = (panelWidth - fittedWidth) / 2;
    const centerY = (panelHeight - fittedHeight) / 2;
    
    return { x: centerX, y: centerY, scale: fitScale };
  }, [image, panelWidth, panelHeight]);

  return (
    <KonvaImage
      image={image}
      x={fitDimensions.x}
      y={fitDimensions.y}
      scaleX={fitDimensions.scale}
      scaleY={fitDimensions.scale}
      draggable={false}
      listening={false}
    />
  );
};

export const ComicPanel: React.FC<ComicPanelProps> = ({ config, imageData, isSelected, onPanelClick }) => {
  const { x, y, width, height, id } = config;

  const handleClick = () => {
    console.log('[Panel] Clicked panel:', id);
    if (onPanelClick) {
      onPanelClick(id);
    }
  };

  return (
    <Group
      x={x}
      y={y}
      clipX={0}
      clipY={0}
      clipWidth={width}
      clipHeight={height}
      onClick={handleClick}
      onTap={handleClick}
    >
      <Rect 
        width={width} 
        height={height} 
        fill={isSelected ? "#e0f2fe" : "#ffffff"} 
        listening={true}
      />

      {!imageData && (
        <Text
          text={isSelected ? "Click an image" : "Click to select"}
          width={width}
          height={height}
          align="center"
          verticalAlign="middle"
          fill={isSelected ? "#0284c7" : "#cbd5e1"}
          fontSize={18}
          fontFamily="Arial"
          fontStyle="bold"
        />
      )}

      {imageData && (
        <ImageInPanel
          src={imageData.src}
          x={imageData.x}
          y={imageData.y}
          scale={imageData.scale}
          panelWidth={width}
          panelHeight={height}
        />
      )}

      <Rect
        width={width}
        height={height}
        stroke={isSelected ? "#0284c7" : "#1e293b"}
        strokeWidth={isSelected ? 4 : 3}
        listening={false}
        shadowColor={isSelected ? "#0284c7" : "black"}
        shadowBlur={isSelected ? 15 : 0}
        shadowOpacity={isSelected ? 0.5 : 0.3}
      />
    </Group>
  );
};
