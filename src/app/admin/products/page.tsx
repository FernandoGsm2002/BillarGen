"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Product } from '@/types/database.types';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import ProductCard from '@/components/ProductCard';
import { StatCard, Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Plus, Trash2, Edit, Package as PackageIcon, DollarSign, TrendingDown, Search, X } from 'lucide-react';
import Image from 'next/image';

const AVAILABLE_IMAGES = [
  { value: '/pngs/pilsen.png', label: 'Pilsen' },
  { value: '/pngs/corona.png', label: 'Corona' },
  { value: '/pngs/heineken.png', label: 'Heineken' },
  { value: '/pngs/cristal.png', label: 'Cristal' },
  { value: '/pngs/lacapilla.png', label: 'La Capilla' },
  { value: '/pngs/cigarro.png', label: 'Cigarro' },
  { value: '/pngs/halls.png', label: 'Halls' },
  { value: '/pngs/trident.png', label: 'Trident' },
  { value: '/pngs/ron.png', label: 'Ron' },
  { value: '/pngs/solysombra.png', label: 'Sol y Sombra' },
  { value: '/pngs/pickeo.png', label: 'Pickeo' },
  { value: '/pngs/pisco.png', label: 'Pisco' },
  { value: '/pngs/vino.png', label: 'Vino' },
];

export default function ProductsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    price: '', 
    stock: '0',
    image_url: '/pngs/pilsen.png'
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'admin') {
      router.push('/login');
      return;
    }

    setUser(parsedUser);
    loadProducts(parsedUser.tenant_id);
  }, [router]);

  const loadProducts = async (tenantId: number) => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (data) {
      setProducts(data);
      setFilteredProducts(data);
    }
  };

  // Debounce para búsqueda (espera 1 segundo después de que el usuario deja de escribir)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim() === '') {
        setFilteredProducts(products);
      } else {
        const filtered = products.filter(product =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredProducts(filtered);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchTerm, products]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingProduct) {
        await supabase
          .from('products')
          .update({
            name: formData.name,
            price: parseFloat(formData.price),
            stock: parseInt(formData.stock),
            image_url: formData.image_url
          })
          .eq('id', editingProduct.id);
      } else {
        await supabase
          .from('products')
          .insert([{
            name: formData.name,
            price: parseFloat(formData.price),
            stock: parseInt(formData.stock),
            image_url: formData.image_url,
            tenant_id: user.tenant_id,
            is_active: true
          }]);
      }

      setFormData({ name: '', price: '', stock: '0', image_url: '/pngs/pilsen.png' });
      setEditingProduct(null);
      setShowModal(false);
      loadProducts(user.tenant_id);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar producto');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock.toString(),
      image_url: product.image_url || '/pngs/cerveza.png'
    });
    setShowModal(true);
  };

  const handleDelete = async (productId: number) => {
    if (!confirm('¿Eliminar este producto?')) return;

    await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (user) loadProducts(user.tenant_id);
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
  const lowStockCount = products.filter(p => p.stock < 10).length;

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        <Sidebar role={user.role as 'admin' | 'worker' | 'super_admin'} username={user.username} />
      
      <div className="flex-1 overflow-auto">
        <div className="bg-card border-b">
          <div className="px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6 flex items-center gap-4">
            <div className="p-4 bg-muted rounded-xl">
              <PackageIcon size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Productos</h1>
              <p className="text-base text-muted-foreground mt-1">Gestiona tu inventario</p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 lg:p-8">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <StatCard
              title="Total Productos"
              value={products.length}
              accent="slate"
              icon={<PackageIcon size={40} />}
            />
            <StatCard
              title="Valor Inventario"
              value={`S/ ${totalValue.toFixed(2)}`}
              accent="emerald"
              icon={<DollarSign size={40} />}
            />
            <StatCard
              title="Stock Bajo"
              value={lowStockCount}
              accent="amber"
              icon={<TrendingDown size={40} />}
            />
          </div>

          {/* Buscador */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                placeholder="Buscar productos..."
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-3">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                onClick={() => setViewMode('grid')}
              >
                Vista Cuadrícula
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                onClick={() => setViewMode('table')}
              >
                Vista Tabla
              </Button>
            </div>

            <Button
              variant="default"
              size="lg"
              onClick={() => {
                setEditingProduct(null);
                setFormData({ name: '', price: '', stock: '0', image_url: '/pngs/pilsen.png' });
                setShowModal(true);
              }}
            >
              <Plus size={20} className="mr-2" /> Agregar Producto
            </Button>
          </div>

          {/* Products Grid */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredProducts.map((product) => (
                <div key={product.id} className="relative group">
                  <ProductCard
                    name={product.name}
                    price={product.price}
                    stock={product.stock}
                    image_url={product.image_url}
                    onClick={() => handleEdit(product)}
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      handleDelete(product.id);
                    }}
                    className="absolute top-2 left-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            /* Products Table */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                          {product.image_url ? (
                            <Image
                              src={product.image_url}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <PackageIcon size={24} className="text-gray-400" />
                            </div>
                          )}
                        </div>
                        <span className="font-bold">{product.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-lg font-bold text-indigo-600">
                        S/ {product.price.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${
                        product.stock === 0 ? 'text-red-600' :
                        product.stock < 10 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {product.stock}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-gray-900">
                        S/ {(product.price * product.stock).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        product.stock === 0 
                          ? 'bg-red-100 text-red-900' 
                          : product.stock < 10 
                          ? 'bg-orange-100 text-orange-900' 
                          : 'bg-green-100 text-green-900'
                      }`}>
                        {product.stock === 0 ? 'Agotado' : product.stock < 10 ? 'Poco Stock' : 'Disponible'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleEdit(product)}
                        >
                          <Edit size={16} className="mr-2" /> Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 size={16} className="mr-2" /> Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {filteredProducts.length === 0 && (
            <Card>
              <CardBody>
                <div className="text-center py-12">
                  <PackageIcon size={64} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">No hay productos</h3>
                  <p className="text-gray-700 mb-6 font-medium">Comienza agregando tu primer producto</p>
                  <Button
                    variant="default"
                    size="lg"
                    onClick={() => setShowModal(true)}
                  >
                    <Plus size={24} className="mr-2" /> Agregar Primer Producto
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Producto' : 'Agregar Producto'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Nombre del Producto</label>
          <Input
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ej: Cerveza Pilsen"
            required
          />

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Precio</label>
              <Input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, price: e.target.value })}
                placeholder="10.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Stock</label>
              <Input
                type="number"
                value={formData.stock}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, stock: e.target.value })}
                placeholder="50"
                required
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-bold text-gray-800 mb-2">
              Imagen del Producto
            </label>
            <div className="grid grid-cols-3 gap-3 max-h-96 overflow-y-auto p-2">
              {AVAILABLE_IMAGES.map((img) => (
                <button
                  key={img.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, image_url: img.value })}
                  className={`
                    relative aspect-square rounded-lg overflow-hidden border-4 transition-all bg-white p-2
                    ${formData.image_url === img.value 
                      ? 'border-indigo-600 scale-105 shadow-lg' 
                      : 'border-gray-200 hover:border-indigo-300'
                    }
                  `}
                >
                  <div className="relative w-full h-full">
                    <Image
                      src={img.value}
                      alt={img.label}
                      fill
                      className="object-contain"
                      sizes="150px"
                    />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-white/90 text-gray-900 text-xs py-1 text-center font-bold border-t border-gray-200">
                    {img.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowModal(false);
                setEditingProduct(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit">
              {editingProduct ? 'Actualizar' : 'Crear'} Producto
            </Button>
          </DialogFooter>
        </form>
        </DialogContent>
      </Dialog>
      </div>
    </SidebarProvider>
  );
}
