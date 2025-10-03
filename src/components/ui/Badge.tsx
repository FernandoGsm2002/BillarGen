import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'default';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'md', className = '' }: BadgeProps) {
  const baseClasses = 'inline-flex items-center justify-center font-bold rounded-full border-2';
  
  const variantClasses = {
    success: 'bg-green-100 text-green-900 border-green-300',
    danger: 'bg-red-100 text-red-900 border-red-300',
    warning: 'bg-orange-100 text-orange-900 border-orange-300',
    info: 'bg-blue-100 text-blue-900 border-blue-300',
    default: 'bg-gray-100 text-gray-900 border-gray-300'
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}>
      {children}
    </span>
  );
}
