import React from 'react';

interface LoadingOverlayProps {
  message: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-lg">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-400 mb-4"></div>
      <p className="text-white font-medium text-lg animate-pulse">{message}</p>
    </div>
  );
};
