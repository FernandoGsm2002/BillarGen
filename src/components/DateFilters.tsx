"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

interface DateFiltersProps {
  selectedFilter: string;
  onFilterChange: (filter: string, startDate: Date, endDate: Date) => void;
  className?: string;
}

export function DateFilters({ selectedFilter, onFilterChange, className = "" }: DateFiltersProps) {
  const filterOptions = [
    { label: 'Hoy', value: 'today' },
    { label: 'Ayer', value: 'yesterday' },
    { label: 'Últimos 7 días', value: 'week' },
    { label: 'Últimos 30 días', value: 'month' },
    { label: 'Todo', value: 'all' }
  ];

  const getDateRange = (filter: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today':
        return {
          startDate: today,
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          startDate: yesterday,
          endDate: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return {
          startDate: weekAgo,
          endDate: now
        };
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        return {
          startDate: monthAgo,
          endDate: now
        };
      case 'all':
      default:
        return {
          startDate: new Date('2020-01-01'),
          endDate: now
        };
    }
  };

  const handleFilterClick = (filter: string) => {
    const { startDate, endDate } = getDateRange(filter);
    onFilterChange(filter, startDate, endDate);
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <div className="flex items-center gap-2 text-sm text-gray-600 mr-3">
        <Calendar size={16} />
        <span className="font-medium">Período:</span>
      </div>
      
      {filterOptions.map((option) => (
        <Button
          key={option.value}
          variant={selectedFilter === option.value ? "default" : "outline"}
          size="sm"
          onClick={() => handleFilterClick(option.value)}
          className={`text-xs ${
            selectedFilter === option.value
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
          }`}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
