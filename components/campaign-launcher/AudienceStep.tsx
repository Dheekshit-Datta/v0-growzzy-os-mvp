"use client";

import { useState } from "react";
import { useCampaignLauncher } from "@/hooks/useCampaignLauncher";

interface Audience {
  id: string;
  name: string;
  size: string;
  cpm: string;
  selected: boolean;
}

export function AudienceStep() {
  const { data, update } = useCampaignLauncher();
  
  // Mock data - replace with API call in production
  const [audiences, setAudiences] = useState<Audience[]>([
    { id: '1', name: 'Lookalike - High Value Customers', size: '1.2M', cpm: '$2.50', selected: false },
    { id: '2', name: 'Interest - Tech Enthusiasts', size: '850K', cpm: '$1.80', selected: false },
    { id: '3', name: 'Retarget - Past 30 Day Visitors', size: '45K', cpm: '$3.20', selected: false },
    { id: '4', name: 'Custom - High Intent Shoppers', size: '320K', cpm: '$2.10', selected: false },
  ]);

  const toggleAudience = (id: string) => {
    const updated = audiences.map(aud => 
      aud.id === id ? { ...aud, selected: !aud.selected } : aud
    );
    setAudiences(updated);
    update({ 
      audiences: updated.filter(a => a.selected).map(a => a.id) 
    });
  };

  // Helper function for conditional class names
  const cn = (...classes: (string | undefined)[]) => {
    return classes.filter(Boolean).join(' ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search audiences..."
          className="flex-1 border rounded-md px-3 py-2 text-sm"
        />
        <button className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md">
          Create New Audience
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {audiences.map((audience) => (
          <div
            key={audience.id}
            onClick={() => toggleAudience(audience.id)}
            className={cn(
              "border rounded-lg p-4 cursor-pointer transition-colors",
              audience.selected 
                ? "border-blue-500 bg-blue-50" 
                : "hover:border-gray-300"
            )}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{audience.name}</h3>
                <p className="text-sm text-gray-500">{audience.size} people</p>
              </div>
              <span className="text-sm text-gray-500">{audience.cpm} CPM</span>
            </div>
            {audience.selected && (
              <div className="mt-2 text-sm text-blue-600 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Selected
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-sm text-gray-500">
        {data.audiences.length === 0 ? (
          <p>Select at least one audience to continue</p>
        ) : (
          <p>{data.audiences.length} audience{data.audiences.length > 1 ? 's' : ''} selected</p>
        )}
      </div>
    </div>
  );
}
