import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Filter, ChevronDown, X } from 'lucide-react';

interface FilterOption {
  key: string;
  label: string;
  type: 'select' | 'multiselect' | 'range';
  options?: Array<{ label: string; value: string }>;
}

interface FilterDropdownProps {
  filters: FilterOption[];
  onFilterChange: (filters: Record<string, any>) => void;
  className?: string;
}

export function FilterDropdown({ filters, onFilterChange, className = '' }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...activeFilters, [key]: value };
    setActiveFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilter = (key: string) => {
    const newFilters = { ...activeFilters };
    delete newFilters[key];
    setActiveFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearAllFilters = () => {
    setActiveFilters({});
    onFilterChange({});
  };

  const activeFilterCount = Object.keys(activeFilters).filter(key => {
    const value = activeFilters[key];
    return value !== '' && value !== null && value !== undefined && 
           (!Array.isArray(value) || value.length > 0);
  }).length;

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <Filter className="h-4 w-4" />
        Filters
        {activeFilterCount > 0 && (
          <span className="bg-black text-white text-xs px-2 py-1 rounded-full">
            {activeFilterCount}
          </span>
        )}
        <ChevronDown className="h-4 w-4" />
      </Button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <Card className="absolute top-full mt-2 w-80 z-20 p-4 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Filters</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-xs"
              >
                Clear All
              </Button>
            </div>

            <div className="space-y-4">
              {filters.map((filter) => (
                <div key={filter.key} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">{filter.label}</label>
                    {activeFilters[filter.key] && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => clearFilter(filter.key)}
                        className="text-xs p-1"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {filter.type === 'select' && (
                    <select
                      value={activeFilters[filter.key] || ''}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      className="w-full p-2 border rounded text-sm"
                    >
                      <option value="">All</option>
                      {filter.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {filter.type === 'multiselect' && (
                    <div className="space-y-1">
                      {filter.options?.map((option) => (
                        <label key={option.value} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={Array.isArray(activeFilters[filter.key]) && 
                                   activeFilters[filter.key].includes(option.value)}
                            onChange={(e) => {
                              const currentValues = Array.isArray(activeFilters[filter.key]) 
                                ? activeFilters[filter.key] 
                                : [];
                              if (e.target.checked) {
                                handleFilterChange(filter.key, [...currentValues, option.value]);
                              } else {
                                handleFilterChange(filter.key, currentValues.filter((v: string) => v !== option.value));
                              }
                            }}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {filter.type === 'range' && (
                    <div className="space-y-2">
                      <input
                        type="range"
                        min={filter.options?.[0]?.value || 0}
                        max={filter.options?.[1]?.value || 100}
                        value={activeFilters[filter.key] || 0}
                        onChange={(e) => handleFilterChange(filter.key, Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="text-xs text-gray-500 text-center">
                        {activeFilters[filter.key] || 0}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Apply Filters
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
