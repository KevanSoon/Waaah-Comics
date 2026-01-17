'use client';

import React from 'react';
import { X, Download, ImagePlus } from 'lucide-react';
import { GeneratedImage } from '@/types';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
  generatedImage: GeneratedImage | null;
  isLoading: boolean;
  prompt: string;
  onSaveToAssets?: (url: string) => void;
  onApplyToCanvas?: (url: string) => void;
}

export const AIModal: React.FC<AIModalProps> = ({
  isOpen,
  onClose,
  generatedImage,
  isLoading,
  prompt,
  onSaveToAssets,
  onApplyToCanvas
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-2xl">✨</span> AI Generation
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-lg text-gray-600 font-medium animate-pulse">
                Dreaming up your masterpiece...
              </p>
              <p className="text-sm text-gray-400 mt-2">&quot;{prompt}&quot;</p>
            </div>
          ) : generatedImage ? (
            <div className="w-full">
              <div className="relative group rounded-lg overflow-hidden border border-gray-200">
                <img src={generatedImage.url} alt="AI Generated" className="w-full h-auto max-h-[60vh] object-contain bg-gray-50" />
              </div>
                <div className="mt-4 flex flex-wrap gap-3 justify-end">
                  {onApplyToCanvas && (
                    <button
                      onClick={() => onApplyToCanvas(generatedImage.url)}
                      className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-base"
                    >
                      <ImagePlus size={20} /> Apply to Canvas
                    </button>
                  )}
                {onSaveToAssets && (
                  <button
                    onClick={() => onSaveToAssets(generatedImage.url)}
                      className="flex items-center gap-2 px-5 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-base"
                  >
                    Save to Assets
                  </button>
                )}
                <a
                  href={generatedImage.url}
                  download={`ai-art-${Date.now()}.png`}
                    className="flex items-center gap-2 px-5 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-base"
                >
                    <Download size={20} /> Save Image
                </a>
              </div>
            </div>
          ) : (
                <div className="text-red-500 py-8 text-lg">Failed to generate image. Please try again.</div>
          )}
        </div>
      </div>
    </div>
  );
};
