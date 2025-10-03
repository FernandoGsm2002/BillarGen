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
}: TableCardProps) {
  const isAvailable = status === 'available';
  return (
    <div className={`relative rounded-2xl overflow-hidden border-4 shadow-2xl bg-card transition-all hover:shadow-3xl hover:scale-[1.02] ${
      isAvailable ? 'border-green-400' : 'border-red-400'
    }`}>
      <div className="relative w-full aspect-[4/5] min-h-[320px]">
        <Image
          src="/pngs/mesas.png"
          alt="Mesa de billar"
          fill
          priority={false}
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        {/* Info + actions overlay */}
        <div className="absolute inset-0 p-5 flex flex-col justify-end">
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-2xl md:text-3xl lg:text-4xl font-black text-white drop-shadow-2xl tracking-tight">{name}</h3>
              {typeof hourlyRate === 'number' && (
                <p className="text-lg md:text-xl lg:text-2xl font-bold text-white drop-shadow-xl">S/ {hourlyRate.toFixed(2)} / hora</p>
              )}
            </div>
            
            <div className="flex items-center">
              <span className={`inline-block px-4 py-2 rounded-xl text-sm md:text-base lg:text-lg font-black backdrop-blur-md border-3 shadow-xl ${
                isAvailable
                  ? 'bg-green-500 text-white border-green-200'
                  : 'bg-red-500 text-white border-red-200'
              }`}>
                {isAvailable ? '✓ Disponible' : '✗ Ocupada'}
              </span>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onPrimary}
                disabled={primaryDisabled}
                className={`flex-1 px-5 py-3.5 text-base md:text-lg font-black rounded-xl transition-all border-3 shadow-xl ${
                  primaryDisabled
                    ? 'bg-slate-400 text-slate-600 border-slate-400 cursor-not-allowed'
                    : 'bg-slate-900 text-white hover:bg-slate-800 border-slate-700 hover:shadow-2xl active:scale-95'
                }`}
              >
                {primaryLabel}
              </button>
              {secondaryLabel && (
                <button
                  onClick={onSecondary}
                  disabled={disabledSecondary}
                  className={`flex-1 px-5 py-3.5 text-base md:text-lg font-black rounded-xl transition-all border-3 shadow-xl ${
                    disabledSecondary
                      ? 'bg-slate-400 text-slate-600 border-slate-400 cursor-not-allowed'
                      : 'bg-white text-slate-900 hover:bg-slate-100 border-slate-400 hover:shadow-2xl active:scale-95'
                  }`}
                >
                  {secondaryLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
