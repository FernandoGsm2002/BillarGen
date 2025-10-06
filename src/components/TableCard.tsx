import React from 'react';
import Image from 'next/image';

interface TableCardProps {
  name: string;
  hourlyRate?: number;
  status: 'available' | 'occupied';
  onPrimary?: () => void; // start/edit
  onSecondary?: () => void; // delete/end
  primaryLabel?: string;
  secondaryLabel?: string;
  disabledSecondary?: boolean;
  primaryDisabled?: boolean;
  salesInfo?: {
    todayTotal?: number;
    todayProducts?: number;
  };
}

export default function TableCard({
  name,
  hourlyRate,
  status,
  onPrimary,
  onSecondary,
  primaryLabel = 'Acción',
  secondaryLabel = 'Secundaria',
  disabledSecondary,
  primaryDisabled,
  salesInfo,
}: TableCardProps) {
  const isAvailable = status === 'available';
  return (
    <div className={`bg-white rounded-xl border-2 transition-all hover:shadow-lg ${
      isAvailable ? 'border-gray-200 hover:border-gray-300' : 'border-gray-300 bg-gray-50'
    }`}>
      <div className="p-4">
        {/* Header con imagen y estado */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <Image
                src="/icons/mesa.ico"
                alt="Mesa"
                width={24}
                height={24}
                className="object-contain"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{name}</h3>
              {typeof hourlyRate === 'number' && (
                <p className="text-sm text-gray-600 font-medium">S/ {hourlyRate.toFixed(2)} / hora</p>
              )}
            </div>
          </div>
          
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isAvailable
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {isAvailable ? 'Disponible' : 'Ocupada'}
          </div>
        </div>

        {/* Información de ventas */}
        {salesInfo && (salesInfo.todayTotal || salesInfo.todayProducts) && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Ventas de Hoy</h4>
            <div className="flex justify-between text-sm">
              {salesInfo.todayTotal !== undefined && (
                <div>
                  <p className="text-gray-600">Total</p>
                  <p className="font-bold text-gray-900">S/ {salesInfo.todayTotal.toFixed(2)}</p>
                </div>
              )}
              {salesInfo.todayProducts !== undefined && (
                <div>
                  <p className="text-gray-600">Productos</p>
                  <p className="font-bold text-gray-900">{salesInfo.todayProducts}</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Botones de acción */}
        <div className="flex gap-2">
          <button
            onClick={onPrimary}
            disabled={primaryDisabled}
            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              primaryDisabled
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-800 text-white hover:bg-gray-900'
            }`}
          >
            {primaryLabel}
          </button>
          {secondaryLabel && (
            <button
              onClick={onSecondary}
              disabled={disabledSecondary}
              className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                disabledSecondary
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
