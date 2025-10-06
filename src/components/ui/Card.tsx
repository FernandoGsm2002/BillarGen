import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'bordered' | 'stat';
}

export function Card({ children, className = '', variant = 'default' }: CardProps) {
  const baseClasses = 'rounded-xl transition-all duration-200';
  
  const variantClasses = {
    default: 'bg-white shadow-sm border border-slate-200',
    bordered: 'bg-white border-2 border-slate-200 hover:border-slate-300',
    stat: 'bg-white shadow-sm border border-slate-200 hover:shadow-md'
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
  accent?: 'slate' | 'emerald' | 'red' | 'amber' | 'blue';
}

export function CardHeader({ children, className = '', accent = 'slate' }: CardHeaderProps) {
  const accentClasses = {
    slate: 'border-l-4 border-slate-800',
    emerald: 'border-l-4 border-emerald-700',
    red: 'border-l-4 border-red-700',
    amber: 'border-l-4 border-amber-600',
    blue: 'border-l-4 border-blue-700'
  };

  return (
    <div className={`p-6 ${accentClasses[accent]} ${className}`}>
      {children}
    </div>
  );
}

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl ${className}`}>
      {children}
    </div>
  );
}

// Stat Card Component for KPIs
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: 'slate' | 'emerald' | 'red' | 'amber' | 'blue';
  className?: string;
}

export function StatCard({ title, value, subtitle, icon, accent = 'slate', className = '' }: StatCardProps) {
  const accentClasses = {
    slate: {
      border: 'border-gray-200',
      text: 'text-gray-900',
      bg: 'bg-gradient-to-br from-gray-50 to-white',
      iconBg: 'bg-gray-100',
      iconText: 'text-gray-600',
      hover: 'hover:border-gray-300 hover:shadow-md'
    },
    emerald: {
      border: 'border-gray-200',
      text: 'text-gray-900',
      bg: 'bg-gradient-to-br from-gray-50 to-white',
      iconBg: 'bg-gray-100',
      iconText: 'text-gray-600',
      hover: 'hover:border-gray-300 hover:shadow-md'
    },
    red: {
      border: 'border-gray-200',
      text: 'text-gray-900',
      bg: 'bg-gradient-to-br from-gray-50 to-white',
      iconBg: 'bg-gray-100',
      iconText: 'text-gray-600',
      hover: 'hover:border-gray-300 hover:shadow-md'
    },
    amber: {
      border: 'border-orange-200',
      text: 'text-orange-800',
      bg: 'bg-gradient-to-br from-orange-50 to-white',
      iconBg: 'bg-orange-100',
      iconText: 'text-orange-600',
      hover: 'hover:border-orange-300 hover:shadow-md'
    },
    blue: {
      border: 'border-gray-200',
      text: 'text-gray-900',
      bg: 'bg-gradient-to-br from-gray-50 to-white',
      iconBg: 'bg-gray-100',
      iconText: 'text-gray-600',
      hover: 'hover:border-gray-300 hover:shadow-md'
    }
  };

  const colors = accentClasses[accent];

  return (
    <div className={`group bg-white rounded-xl border ${colors.border} ${colors.hover} transition-all duration-200 ${className}`}>
      <div className="p-4 sm:p-5 lg:p-6">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-xs sm:text-sm font-medium text-gray-600 uppercase tracking-wide mb-2 sm:mb-3">{title}</h3>
            <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${colors.text} truncate leading-none`}>{value}</p>
            {subtitle && (
              <p className="text-xs sm:text-sm text-gray-500 mt-2 sm:mt-3 font-medium">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div className={`${colors.iconBg} ${colors.iconText} p-3 sm:p-4 rounded-lg shrink-0`}>
              <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center">
                {icon}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
