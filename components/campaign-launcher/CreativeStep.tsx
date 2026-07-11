"use client";

import { useState } from "react";
import { useCampaignLauncher } from "@/hooks/useCampaignLauncher";

interface CreativePerformance {
  ctr: string;
  roas: string;
}

interface Creative {
  id: string;
  name: string;
  type: 'image' | 'video' | 'carousel';
  thumbnail: string;
  selected: boolean;
  performance?: CreativePerformance;
}

export function CreativeStep() {
  const { data, update } = useCampaignLauncher();
  const [activeTab, setActiveTab] = useState<'library' | 'upload'>('library');
  
  // Mock data - replace with API call in production
  const [creatives, setCreatives] = useState<Creative[]>([
    { 
      id: '1', 
      name: 'Summer Sale - 20% Off', 
      type: 'image',
      thumbnail: 'https://via.placeholder.com/300x200?text=Summer+Sale',
      selected: false,
      performance: { ctr: '4.2%', roas: '3.2x' }
    },
    { 
      id: '2', 
      name: 'Product Demo Video', 
      type: 'video',
      thumbnail: 'https://via.placeholder.com/300x200?text=Product+Demo',
      selected: false,
      performance: { ctr: '5.8%', roas: '4.1x' }
    },
    { 
      id: '3', 
      name: 'Customer Testimonials', 
      type: 'carousel',
      thumbnail: 'https://via.placeholder.com/300x200?text=Testimonials',
      selected: false,
      performance: { ctr: '3.9%', roas: '2.8x' }
    },
    { 
      id: '4', 
      name: 'New Arrivals', 
      type: 'image',
      thumbnail: 'https://via.placeholder.com/300x200?text=New+Arrivals',
      selected: false,
      performance: { ctr: '3.5%', roas: '2.9x' }
    },
  ]);

  const toggleCreative = (id: string) => {
    const updated = creatives.map(creative => 
      creative.id === id 
        ? { ...creative, selected: !creative.selected } 
        : creative
    );
    setCreatives(updated);
    update({ 
      creatives: updated.filter(c => c.selected).map(c => c.id) 
    });
  };

  const selectedCount = creatives.filter(c => c.selected).length;

  // Helper function for conditional class names
  const cn = (...classes: (string | undefined)[]) => {
    return classes.filter(Boolean).join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b">
        <nav className="flex -mb-px space-x-8">
          <button
            onClick={() => setActiveTab('library')}
            className={cn(
              "py-4 px-1 border-b-2 font-medium text-sm",
              activeTab === 'library'
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            Select from Library
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={cn(
              "py-4 px-1 border-b-2 font-medium text-sm",
              activeTab === 'upload'
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            Upload New
          </button>
        </nav>
      </div>

      {activeTab === 'library' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creatives.map((creative) => (
              <div 
                key={creative.id}
                className={cn(
                  "border rounded-lg overflow-hidden cursor-pointer transition-all",
                  creative.selected ? "ring-2 ring-blue-500" : "hover:shadow-md"
                )}
                onClick={() => toggleCreative(creative.id)}
              >
                <div className="relative aspect-video bg-gray-100">
                  <img 
                    src={creative.thumbnail} 
                    alt={creative.name}
                    className="w-full h-full object-cover"
                  />
                  {creative.selected && (
                    <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-2">
                    {creative.type.toUpperCase()}
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm">{creative.name}</h3>
                  {creative.performance && (
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>CTR: {creative.performance.ctr}</span>
                      <span>ROAS: {creative.performance.roas}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-sm text-gray-500">
            {selectedCount === 0 ? (
              <p>Select at least one creative to continue</p>
            ) : (
              <p>{selectedCount} creative{selectedCount > 1 ? 's' : ''} selected</p>
            )}
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-12 text-center">
          <div className="max-w-md mx-auto">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div className="mt-4 flex text-sm text-gray-600">
              <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                <span>Upload files</span>
                <input type="file" className="sr-only" multiple />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              PNG, JPG, GIF, MP4 up to 100MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
