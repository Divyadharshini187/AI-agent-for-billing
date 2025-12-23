import React from 'react';

interface VisualizerProps {
  isActive: boolean;
  isTalking: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, isTalking }) => {
  return (
    <div className="flex items-center justify-center space-x-2 h-16">
      {isActive ? (
        <>
          <div className={`w-3 bg-orange-500 rounded-full transition-all duration-300 ${isTalking ? 'h-12 animate-bounce' : 'h-4 animate-pulse'}`} style={{ animationDelay: '0ms' }}></div>
          <div className={`w-3 bg-orange-500 rounded-full transition-all duration-300 ${isTalking ? 'h-16 animate-bounce' : 'h-6 animate-pulse'}`} style={{ animationDelay: '100ms' }}></div>
          <div className={`w-3 bg-orange-500 rounded-full transition-all duration-300 ${isTalking ? 'h-10 animate-bounce' : 'h-3 animate-pulse'}`} style={{ animationDelay: '200ms' }}></div>
          <div className={`w-3 bg-orange-500 rounded-full transition-all duration-300 ${isTalking ? 'h-14 animate-bounce' : 'h-5 animate-pulse'}`} style={{ animationDelay: '300ms' }}></div>
          <div className={`w-3 bg-orange-500 rounded-full transition-all duration-300 ${isTalking ? 'h-8 animate-bounce' : 'h-4 animate-pulse'}`} style={{ animationDelay: '400ms' }}></div>
        </>
      ) : (
        <div className="text-gray-400 text-sm font-medium">Ready to take your order...</div>
      )}
    </div>
  );
};

export default Visualizer;
