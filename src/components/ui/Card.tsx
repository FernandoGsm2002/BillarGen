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
    slate: 'border-slate-800 text-slate-800 bg-slate-50',
    emerald: 'border-emerald-700 text-emerald-700 bg-emerald-50',
    red: 'border-red-700 text-red-700 bg-red-50',
    amber: 'border-amber-600 text-amber-600 bg-amber-50',
    blue: 'border-blue-700 text-blue-700 bg-blue-50'
  };

  const [borderColor, textColor, bgColor] = accentClasses[accent].split(' ');

  return (
    <Card variant="stat" className={className}>
      <div className={`p-6 border-l-4 ${borderColor}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{title}</h3>
            <p className={`text-4xl md:text-5xl font-bold ${textColor} truncate`}>{value}</p>
            {subtitle && <p className="text-sm text-muted-foreground mt-3 font-medium">{subtitle}</p>}
          </div>
          {icon && (
            <div className={`${bgColor} ${textColor} p-4 rounded-xl shrink-0`}>
              {icon}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
