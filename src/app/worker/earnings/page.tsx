"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { TrendingUp, ShoppingCart, Clock, Calendar, Package, CreditCard, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCard, Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface SaleWithDetails {
  id: number;
  quantity: number;
  unit_price: number;
  total_amount: number;
  created_at: string;
  is_paid: boolean;
  products: { name: string } | null;
  clients: { name: string } | null;
  rentals: { id: number; tables: { name: string } | null } | null;
}

interface RentalIncome {
  id: number;
  total_amount: number;
  created_at: string;
  end_time: string;
  is_paid: boolean;
  clients: { name: string } | null;
  tables: { name: string } | null;
}

type IncomeItem = {
  id: string;
  type: 'sale' | 'rental';
  amount: number;
  date: string;
  is_paid: boolean;
  client_name: string;
  table_name: string;
  product_name?: string;
  quantity?: number;
};

export default function WorkerEarningsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [sales, setSales] = useState<SaleWithDetails[]>([]);
  const [rentals, setRentals] = useState<RentalIncome[]>([]);
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sales' | 'rentals'>('all');

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
    loadData(parsedUser.tenant_id, parsedUser.id, 'all');
  }, [router]);

  const loadData = async (tenantId: number, userId: number, filterType: string) => {
    // Cargar ventas del trabajador
    let salesQuery = supabase
      .from('sales')
      .select('*, products(name), clients(name), rentals(id, tables(name))')
      .eq('tenant_id', tenantId)
      .eq('worker_id', userId)
      .order('created_at', { ascending: false });

    // Cargar alquileres finalizados del trabajador
    let rentalsQuery = supabase
      .from('rentals')
      .select('*, clients(name), tables(name)')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .not('end_time', 'is', null)
      .order('end_time', { ascending: false });

    if (filterType === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      salesQuery = salesQuery.gte('created_at', today.toISOString());
      rentalsQuery = rentalsQuery.gte('end_time', today.toISOString());
    } else if (filterType === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      salesQuery = salesQuery.gte('created_at', weekAgo.toISOString());
      rentalsQuery = rentalsQuery.gte('end_time', weekAgo.toISOString());
    }

    const { data: salesData } = await salesQuery;
    const { data: rentalsData } = await rentalsQuery;

    if (salesData) setSales(salesData as SaleWithDetails[]);
    if (rentalsData) setRentals(rentalsData as RentalIncome[]);
  };

  const handleFilterChange = (newFilter: 'all' | 'today' | 'week') => {
    setFilter(newFilter);
    if (user) {
      loadData(user.tenant_id, user.id, newFilter);
    }
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  // Combinar y filtrar datos
  const combinedData: IncomeItem[] = [];

  if (typeFilter === 'all' || typeFilter === 'sales') {
    sales.forEach(sale => {
      combinedData.push({
        id: `sale-${sale.id}`,
        type: 'sale',
        amount: sale.total_amount,
        date: sale.created_at,
        is_paid: sale.is_paid,
        client_name: sale.clients?.name || 'Cliente Anónimo',
        table_name: sale.rentals?.tables?.name || '-',
        product_name: sale.products?.name || 'Producto N/A',
        quantity: sale.quantity
      });
    });
  }

  if (typeFilter === 'all' || typeFilter === 'rentals') {
    rentals.forEach(rental => {
      combinedData.push({
        id: `rental-${rental.id}`,
        type: 'rental',
        amount: rental.total_amount,
        date: rental.end_time,
        is_paid: rental.is_paid,
        client_name: rental.clients?.name || 'Cliente Anónimo',
        table_name: rental.tables?.name || 'Mesa N/A'
      });
    });
  }

  // Ordenar por fecha
  combinedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calcular estadísticas
  const totalSalesAmount = sales.reduce((sum, s) => sum + s.total_amount, 0);
  const totalRentalsAmount = rentals.reduce((sum, r) => sum + r.total_amount, 0);
  const totalAmount = totalSalesAmount + totalRentalsAmount;
  const paidAmount = combinedData.filter(item => item.is_paid).reduce((sum, item) => sum + item.amount, 0);
  const pendingAmount = totalAmount - paidAmount;

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        <Sidebar role={user.role as 'admin' | 'worker' | 'super_admin'} username={user.username} />
      
        <div className="flex-1 overflow-auto">
          <div className="bg-card border-b">
            <div className="px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <SidebarTrigger className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors" />
                <div className="p-3 sm:p-4 bg-gray-100 rounded-xl">
                  <TrendingUp size={28} className="text-gray-700 sm:w-8 sm:h-8" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Mis Ingresos</h1>
                  <p className="text-sm sm:text-base text-gray-600 mt-1 hidden sm:block">Historial de ventas y rentas</p>
                  <p className="text-xs text-gray-500 mt-1 sm:hidden">Historial</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 lg:p-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Total Ingresos"
                value={`S/ ${totalAmount.toFixed(2)}`}
                accent="emerald"
                icon={<DollarSign size={40} />}
              />
              <StatCard
                title="Por Ventas"
                value={`S/ ${totalSalesAmount.toFixed(2)}`}
                accent="blue"
                icon={<ShoppingCart size={40} />}
              />
              <StatCard
                title="Por Rentas"
                value={`S/ ${totalRentalsAmount.toFixed(2)}`}
                accent="slate"
                icon={<Clock size={40} />}
              />
              <StatCard
                title="Pendiente Cobro"
                value={`S/ ${pendingAmount.toFixed(2)}`}
                accent="amber"
                icon={<CreditCard size={40} />}
              />
            </div>

            {/* Filtros */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
              <div className="flex gap-3">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  onClick={() => handleFilterChange('all')}
                >
                  Todos
                </Button>
                <Button
                  variant={filter === 'today' ? 'default' : 'outline'}
                  onClick={() => handleFilterChange('today')}
                >
                  Hoy
                </Button>
                <Button
                  variant={filter === 'week' ? 'default' : 'outline'}
                  onClick={() => handleFilterChange('week')}
                >
                  Última Semana
                </Button>
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant={typeFilter === 'all' ? 'secondary' : 'outline'}
                  onClick={() => setTypeFilter('all')}
                >
                  Todos
                </Button>
                <Button
                  variant={typeFilter === 'sales' ? 'secondary' : 'outline'}
                  onClick={() => setTypeFilter('sales')}
                >
                  Ventas
                </Button>
                <Button
                  variant={typeFilter === 'rentals' ? 'secondary' : 'outline'}
                  onClick={() => setTypeFilter('rentals')}
                >
                  Rentas
                </Button>
              </div>
            </div>

            {/* Lista de Ingresos */}
            <Card>
              <CardHeader accent="slate">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Package size={24} />
                  Historial de Ingresos ({combinedData.length})
                </h2>
              </CardHeader>
              <CardBody className="p-0">
                {combinedData.length > 0 ? (
                  <>
                    {/* Vista móvil - Cards */}
                    <div className="md:hidden divide-y divide-gray-200">
                      {combinedData.map((item) => (
                        <div key={item.id} className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                item.type === 'sale' ? 'bg-blue-100' : 'bg-purple-100'
                              }`}>
                                {item.type === 'sale' ? (
                                  <ShoppingCart size={20} className={item.type === 'sale' ? 'text-blue-600' : 'text-purple-600'} />
                                ) : (
                                  <Clock size={20} className="text-purple-600" />
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-gray-900">
                                  {item.type === 'sale' ? item.product_name : `Mesa ${item.table_name}`}
                                </div>
                                <div className="text-xs text-gray-500">{item.client_name}</div>
                              </div>
                            </div>
                            <Badge variant={item.is_paid ? 'success' : 'danger'}>
                              {item.is_paid ? 'Pagado' : 'Pendiente'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-600">Monto:</span>
                              <p className="font-bold text-green-600">S/ {item.amount.toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Fecha:</span>
                              <p className="text-xs">{new Date(item.date).toLocaleDateString('es-PE')}</p>
                            </div>
                            {item.type === 'sale' && (
                              <>
                                <div>
                                  <span className="text-gray-600">Cantidad:</span>
                                  <p className="font-semibold">{item.quantity}</p>
                                </div>
                                <div>
                                  <span className="text-gray-600">Mesa:</span>
                                  <p className="text-sm">{item.table_name}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Vista desktop - Tabla */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Tipo</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Detalle</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Cliente</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Mesa</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Monto</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Estado</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Fecha</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {combinedData.map((item) => (
                            <tr key={item.id} className="hover:bg-muted/30">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {item.type === 'sale' ? (
                                    <ShoppingCart size={16} className="text-blue-600" />
                                  ) : (
                                    <Clock size={16} className="text-purple-600" />
                                  )}
                                  <span className="font-medium capitalize">
                                    {item.type === 'sale' ? 'Venta' : 'Renta'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">
                                  {item.type === 'sale' ? item.product_name : `Mesa ${item.table_name}`}
                                </div>
                                {item.type === 'sale' && (
                                  <div className="text-sm text-gray-500">Cantidad: {item.quantity}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{item.client_name}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{item.table_name}</td>
                              <td className="px-4 py-3 font-bold text-green-600">S/ {item.amount.toFixed(2)}</td>
                              <td className="px-4 py-3">
                                <Badge variant={item.is_paid ? 'success' : 'danger'} className="text-xs">
                                  {item.is_paid ? 'Pagado' : 'Pendiente'}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar size={14} />
                                  {new Date(item.date).toLocaleDateString('es-PE')}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <TrendingUp size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay ingresos</h3>
                    <p className="text-gray-600">
                      Los ingresos aparecerán cuando realices ventas o finalices rentas
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
