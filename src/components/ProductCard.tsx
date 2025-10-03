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
        group relative overflow-hidden rounded-2xl shadow-lg transition-all duration-300
        ${isOutOfStock 
          ? 'bg-gray-100 cursor-not-allowed opacity-50' 
          : 'bg-white hover:shadow-2xl hover:scale-105 cursor-pointer'
        }
        border-2 ${isOutOfStock ? 'border-gray-300' : 'border-transparent hover:border-indigo-500'}
      `}
    >
      {/* Imagen */}
      <div className="relative h-48 bg-white overflow-hidden flex items-center justify-center p-4">
        {image_url ? (
          <div className="relative w-full h-full">
            <Image
              src={image_url}
              alt={name}
              fill
              className="object-contain group-hover:scale-110 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <Package size={64} className="text-gray-300" />
          </div>
        )}
        
        {/* Badge de Stock */}
        <div className="absolute top-2 right-2">
          {isOutOfStock ? (
            <span className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full shadow-lg">
              AGOTADO
            </span>
          ) : isLowStock ? (
            <span className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
              ¡POCO STOCK!
            </span>
          ) : (
            <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow-lg">
              DISPONIBLE
            </span>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4">
        <h3 className="font-bold text-gray-900 text-lg mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">
          {name}
        </h3>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-indigo-600">
              S/ {price.toFixed(2)}
            </p>
            <p className={`text-sm font-semibold mt-1 ${
              isOutOfStock ? 'text-red-600' :
              isLowStock ? 'text-orange-600' : 'text-green-600'
            }`}>
              Stock: {stock}
            </p>
          </div>
          
          {!isOutOfStock && (
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center group-hover:bg-indigo-700 transition-colors shadow-lg">
              <span className="text-white text-2xl font-bold">+</span>
            </div>
          )}
        </div>
      </div>

      {/* Efecto de hover */}
      {!isOutOfStock && (
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}
    </button>
  );
}
