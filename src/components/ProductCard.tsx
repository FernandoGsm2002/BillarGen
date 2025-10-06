import React from 'react';
import Image from 'next/image';
import { Package } from 'lucide-react';

interface ProductCardProps {
  name: string;
  price: number;
  stock: number;
  image_url?: string | null;
  onClick?: () => void;
  disabled?: boolean;
}

export default function ProductCard({ 
  name, 
  price, 
  stock, 
  image_url, 
  onClick, 
  disabled = false 
}: ProductCardProps) {
  const isLowStock = stock < 10;
  const isOutOfStock = stock === 0;

  return (
    <button
      onClick={onClick}
      disabled={disabled || isOutOfStock}
      className={`
        group relative overflow-hidden rounded-xl border transition-all duration-200
        ${isOutOfStock 
          ? 'bg-gray-50 cursor-not-allowed opacity-60 border-gray-200' 
          : 'bg-white hover:shadow-lg cursor-pointer border-gray-200 hover:border-gray-300'
        }
      `}
    >
      {/* Imagen */}
      <div className="relative h-44 bg-gray-50 overflow-hidden flex items-center justify-center p-3">
        {image_url ? (
          <div className="relative w-full h-full">
            <Image
              src={image_url}
              alt={name}
              fill
              className="object-contain transition-transform duration-200"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <Package size={48} className="text-gray-400" />
          </div>
        )}
        
        {/* Badge de Stock */}
        <div className="absolute top-2 right-2">
          {isOutOfStock ? (
            <span className="px-2 py-1 bg-gray-600 text-white text-xs font-medium rounded-md">
              AGOTADO
            </span>
          ) : isLowStock ? (
            <span className="px-2 py-1 bg-orange-600 text-white text-xs font-medium rounded-md">
              BAJO STOCK
            </span>
          ) : (
            <span className="px-2 py-1 bg-gray-800 text-white text-xs font-medium rounded-md">
              {stock} UND
            </span>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm mb-3 line-clamp-2 leading-tight">
          {name}
        </h3>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-bold text-gray-900">
              S/ {price.toFixed(2)}
            </p>
            <p className={`text-xs font-medium mt-1 ${
              isOutOfStock ? 'text-gray-500' :
              isLowStock ? 'text-orange-600' : 'text-gray-600'
            }`}>
              Stock: {stock}
            </p>
          </div>
          
          {!isOutOfStock && (
            <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center group-hover:bg-gray-900 transition-colors">
              <span className="text-white text-lg font-semibold">+</span>
            </div>
          )}
        </div>
      </div>

      {/* Efecto sutil de hover */}
      {!isOutOfStock && (
        <div className="absolute inset-0 bg-gray-900/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}
    </button>
  );
}
