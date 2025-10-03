"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Product } from '@/types/database.types';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import ProductCard from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { ShoppingCart, Plus, Minus, Trash2, Check } from 'lucide-react';

interface CartItem {
  product: Product;
  quantity: number;
}

interface RentalOption {
  id: number;
  client_id: number | null;
  client_name: string;
  table_name: string;
}

interface ClientOption {
  id: number;
  name: string;
  phone: string | null;
}

export default function POSPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [rentals, setRentals] = useState<RentalOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedRental, setSelectedRental] = useState<number | null>(null);
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [isPaid, setIsPaid] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'worker') {
      router.push('/login');
      return;
    }

    setUser(parsedUser);
    loadData(parsedUser.tenant_id);
  }, [router]);

  const loadData = async (tenantId: number) => {
    // Cargar productos
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    // Cargar rentas activas
    const { data: rentalsData } = await supabase
      .from('rentals')
      .select('id, client_id, table_id, clients(name), tables(name)')
      .eq('tenant_id', tenantId)
      .is('end_time', null);

    // Cargar clientes
    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, name, phone')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (productsData) setProducts(productsData);
    if (clientsData) setClients(clientsData);
    
    if (rentalsData) {
      const formattedRentals = rentalsData.map((r: any) => ({
        id: r.id,
        client_id: r.client_id,
        client_name: r.clients?.[0]?.name || r.clients?.name || 'Sin nombre',
        table_name: r.tables?.[0]?.name || r.tables?.name || 'Mesa'
      }));
      setRentals(formattedRentals);
    }
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity < product.stock) {
        setCart(cart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      } else {
        alert('Stock insuficiente');
      }
    } else {
      if (product.stock > 0) {
        setCart([...cart, { product, quantity: 1 }]);
      } else {
        alert('Producto sin stock');
      }
    }
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity <= 0) return item;
        if (newQuantity > item.product.stock) {
          alert('Stock insuficiente');
          return item;
        }
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  };

  const handleCheckout = async () => {
    if (!user) return;
    if (cart.length === 0) {
      alert('El carrito está vacío');
      return;
    }

    // Validar que si es fiado, debe tener cliente
    if (!isPaid && !selectedClient && !selectedRental) {
      alert('Para venta fiada debe seleccionar un cliente o mesa');
      return;
    }

    try {
      // Determinar client_id
      let clientId = selectedClient;
      if (selectedRental && !clientId) {
        const rental = rentals.find(r => r.id === selectedRental);
        clientId = rental?.client_id || null;
      }

      // Crear ventas
      for (const item of cart) {
        await supabase
          .from('sales')
          .insert([{
            tenant_id: user.tenant_id,
            client_id: clientId,
            product_id: item.product.id,
            rental_id: selectedRental,
            worker_id: user.id,
            quantity: item.quantity,
            unit_price: item.product.price,
            total_amount: item.product.price * item.quantity,
            is_paid: isPaid
          }]);

        // Actualizar stock
        await supabase
          .from('products')
          .update({ stock: item.product.stock - item.quantity })
          .eq('id', item.product.id);
      }

      const message = isPaid 
        ? 'Venta registrada y pagada exitosamente' 
        : 'Venta registrada como FIADA';
      alert(message);
      
      setCart([]);
      setSelectedRental(null);
      setSelectedClient(null);
      setIsPaid(true);
      loadData(user.tenant_id);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al procesar la venta');
    }
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        <Sidebar role={user.role as 'admin' | 'worker' | 'super_admin'} username={user.username} />
      
      <div className="flex-1 overflow-auto">
        <div className="bg-card border-b">
          <div className="px-8 py-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-muted rounded-xl">
                <ShoppingCart size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Punto de Venta</h1>
                <p className="text-base text-muted-foreground mt-1">Registra ventas de productos</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Productos */}
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold mb-6">📦 Productos Disponibles</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    name={product.name}
                    price={product.price}
                    stock={product.stock}
                    image_url={product.image_url}
                    onClick={() => addToCart(product)}
                    disabled={product.stock === 0}
                  />
                ))}
              </div>
            </div>

            {/* Carrito */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShoppingCart size={20} />
                    <h2 className="text-lg font-semibold">Carrito</h2>
                  </div>
                </CardHeader>
                <CardBody>

                {/* Selector de Renta */}
                {rentals.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-800 mb-2">
                      🎱 Cargar a Mesa
                    </label>
                    <select
                      value={selectedRental || ''}
                      onChange={(e) => {
                        setSelectedRental(e.target.value ? Number(e.target.value) : null);
                        setSelectedClient(null); // Limpiar cliente si selecciona mesa
                      }}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium"
                    >
                      <option value="">Sin mesa</option>
                      {rentals.map((rental) => (
                        <option key={rental.id} value={rental.id}>
                          {rental.table_name} - {rental.client_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Selector de Cliente */}
                {!selectedRental && clients.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-800 mb-2">
                      👤 Cliente
                    </label>
                    <select
                      value={selectedClient || ''}
                      onChange={(e) => setSelectedClient(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium"
                    >
                      <option value="">Sin cliente</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name} {client.phone ? `- ${client.phone}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Método de Pago */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border-2 border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPaid}
                      onChange={(e) => setIsPaid(e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="font-bold text-gray-900">
                      {isPaid ? '💰 Pago Inmediato' : '📝 Venta Fiada'}
                    </span>
                  </label>
                  {!isPaid && (
                    <p className="text-xs text-orange-600 mt-1 font-semibold">
                      ⚠️ Se registrará como deuda del cliente
                    </p>
                  )}
                </div>

                {/* Items del Carrito */}
                <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                  {cart.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <ShoppingCart size={48} className="mx-auto mb-2 opacity-30" />
                      <p className="font-medium">Carrito vacío</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.product.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-bold text-gray-900">{item.product.name}</p>
                            <p className="text-sm text-gray-600">S/ {item.product.price.toFixed(2)} c/u</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeFromCart(item.product.id)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => updateQuantity(item.product.id, -1)}
                              className="h-8 w-8"
                            >
                              <Minus size={14} />
                            </Button>
                            <span className="w-12 text-center font-bold">{item.quantity}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => updateQuantity(item.product.id, 1)}
                              className="h-8 w-8"
                            >
                              <Plus size={14} />
                            </Button>
                          </div>
                          <p className="font-bold text-lg text-gray-900">
                            S/ {(item.product.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Total */}
                {cart.length > 0 && (
                  <>
                    <div className="border-t-2 border-gray-300 pt-4 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xl font-bold text-gray-900">TOTAL:</span>
                        <span className="text-3xl font-bold text-green-600">
                          S/ {calculateTotal().toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={handleCheckout}
                      size="lg"
                      className="w-full gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <Check size={20} />
                      Procesar Venta
                    </Button>
                  </>
                )}
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      </div>
      </div>
    </SidebarProvider>
  );
}
