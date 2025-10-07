"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { ShoppingCart, User, Package, Calendar, CreditCard, AlertCircle, Grid3x3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCard, Card, CardBody } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';

interface SaleWithDetails {
  id: number;
  quantity: number;
  unit_price: number;
  total_amount: number;
  created_at: string;
  is_paid: boolean;
  products: { name: string } | null;
  users: { username: string } | null;
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
  users: { username: string } | null;
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
  worker?: string;
};

export default function SalesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [sales, setSales] = useState<SaleWithDetails[]>([]);
  const [rentals, setRentals] = useState<RentalIncome[]>([]);
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sales' | 'rentals' | 'combined'>('all');

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
    loadData(parsedUser.tenant_id, 'all');
  }, [router]);

  const loadData = async (tenantId: number, filterType: string) => {
    // Cargar ventas
    let salesQuery = supabase
      .from('sales')
      .select('*, products(name), users(username), clients(name), rentals(id, tables(name))')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    // Cargar alquileres finalizados
    let rentalsQuery = supabase
      .from('rentals')
      .select('*, clients(name), tables(name), users(username)')
      .eq('tenant_id', tenantId)
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

    const [{ data: salesData }, { data: rentalsData }] = await Promise.all([
      salesQuery,
      rentalsQuery
    ]);

    if (salesData) setSales(salesData as SaleWithDetails[]);
    if (rentalsData) setRentals(rentalsData as RentalIncome[]);
  };

  const handleFilterChange = (newFilter: 'all' | 'today' | 'week') => {
    setFilter(newFilter);
    if (user) loadData(user.tenant_id, newFilter);
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  // Combinar ventas y alquileres en una lista unificada
  const allIncomes: IncomeItem[] = [
    ...sales.map(sale => ({
      id: `sale-${sale.id}`,
      type: 'sale' as const,
      amount: Number(sale.total_amount),
      date: sale.created_at,
      is_paid: sale.is_paid,
      client_name: sale.clients?.name || 'Sin cliente',
      table_name: sale.rentals?.tables?.name || '-',
      product_name: sale.products?.name || 'N/A',
      quantity: sale.quantity,
      worker: sale.users?.username || 'N/A'
    })),
    ...rentals.map(rental => ({
      id: `rental-${rental.id}`,
      type: 'rental' as const,
      amount: Number(rental.total_amount || 0), // Ya viene sin consumo desde la DB
      date: rental.end_time,
      is_paid: rental.is_paid,
      client_name: rental.clients?.name || 'Sin cliente',
      table_name: rental.tables?.name || 'N/A',
      worker: rental.users?.username || 'N/A'
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filtrar por tipo
  const filteredIncomes = typeFilter === 'all' 
    ? allIncomes 
    : typeFilter === 'combined'
    ? (() => {
        // Obtener IDs de rentas que tienen consumo
        const rentalsWithConsumptionIds = rentals
          .filter(rental => sales.some(sale => sale.rentals?.id === rental.id))
          .map(rental => rental.id);
        
        return allIncomes.filter(item => {
          // Mostrar solo rentas que tienen consumo
          if (item.type === 'rental') {
            const rentalId = parseInt(item.id.split('-')[1]);
            return rentalsWithConsumptionIds.includes(rentalId);
          }
          // Mostrar solo ventas asociadas a esas rentas
          if (item.type === 'sale') {
            const saleId = parseInt(item.id.split('-')[1]);
            const sale = sales.find(s => s.id === saleId);
            return sale?.rentals?.id && rentalsWithConsumptionIds.includes(sale.rentals.id);
          }
          return false;
        });
      })()
    : allIncomes.filter(item => item.type === (typeFilter === 'sales' ? 'sale' : 'rental'));

  const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
  
  // Calcular total de rentas (ya viene sin consumo desde la DB)
  const totalRentals = rentals.reduce((sum, rental) => {
    return sum + Number(rental.total_amount || 0);
  }, 0);
  
  const totalIncome = totalSales + totalRentals;

  // Identificar rentas con consumo
  const rentalsWithConsumption = rentals.filter(rental => {
    // Verificar si hay ventas asociadas a esta renta
    const hasSales = sales.some(sale => sale.rentals?.id === rental.id);
    return hasSales;
  });

  // Crear items combinados (renta + sus consumos)
  const combinedIncomes = rentalsWithConsumption.map(rental => {
    const rentalSales = sales.filter(sale => sale.rentals?.id === rental.id);
    const consumptionTotal = rentalSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    return {
      rental,
      sales: rentalSales,
      rentalAmount: Number(rental.total_amount || 0),
      consumptionAmount: consumptionTotal,
      totalAmount: Number(rental.total_amount || 0) + consumptionTotal
    };
  });

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        <Sidebar role={user.role as 'admin' | 'worker' | 'super_admin'} username={user.username} />

        <div className="flex-1 overflow-auto">
          {/* Header */}
          <div className="bg-white border-b border-gray-200">
            <div className="px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
              <div className="flex items-center gap-3 sm:gap-4 mb-2">
                <SidebarTrigger className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors" />
                <div className="p-3 bg-gray-100 rounded-xl">
                  <ShoppingCart size={28} className="text-gray-700 sm:w-8 sm:h-8" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Ingresos</h1>
                  <p className="text-sm sm:text-base text-gray-600 mt-1 hidden sm:block">Historial de Ventas y Alquileres de Mesas</p>
                  <p className="text-xs text-gray-500 mt-1 sm:hidden">Ventas y alquileres</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 lg:p-8 xl:p-12 bg-gray-50 w-full max-w-[1800px] mx-auto">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <StatCard title="Total Ingresos" value={`S/ ${totalIncome.toFixed(2)}`} accent="slate" icon={<ShoppingCart size={40} />} />
              <StatCard title="Ventas Productos" value={`S/ ${totalSales.toFixed(2)}`} accent="slate" icon={<Package size={40} />} />
              <StatCard title="Alquiler Mesas" value={`S/ ${totalRentals.toFixed(2)}`} accent="slate" icon={<Grid3x3 size={40} />} />
              <StatCard title="Transacciones" value={allIncomes.length} accent="slate" icon={<Calendar size={40} />} />
            </div>

            {/* Filters */}
            <div className="mb-4 sm:mb-6 bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Filtros</h3>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={filter === 'all' ? 'default' : 'ghost'}
                    onClick={() => handleFilterChange('all')}
                    size="sm"
                    className="text-xs sm:text-sm"
                  >
                    Todas
                  </Button>
                  <Button
                    variant={filter === 'today' ? 'default' : 'ghost'}
                    onClick={() => handleFilterChange('today')}
                    size="sm"
                    className="text-xs sm:text-sm"
                  >
                    Hoy
                  </Button>
                  <Button
                    variant={filter === 'week' ? 'default' : 'ghost'}
                    onClick={() => handleFilterChange('week')}
                    size="sm"
                    className="text-xs sm:text-sm"
                  >
                    Última Semana
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={typeFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setTypeFilter('all')}
                    size="sm"
                    className="text-xs sm:text-sm"
                  >
                    Todos
                  </Button>
                  <Button
                    variant={typeFilter === 'sales' ? 'default' : 'outline'}
                    onClick={() => setTypeFilter('sales')}
                    size="sm"
                    className="text-xs sm:text-sm"
                  >
                    <Package size={14} className="mr-1 sm:mr-2" />
                    Ventas
                  </Button>
                  <Button
                    variant={typeFilter === 'rentals' ? 'default' : 'outline'}
                    onClick={() => setTypeFilter('rentals')}
                    size="sm"
                    className="text-xs sm:text-sm"
                  >
                    <Grid3x3 size={14} className="mr-1 sm:mr-2" />
                    Alquileres
                  </Button>
                  <Button
                    variant={typeFilter === 'combined' ? 'default' : 'outline'}
                    onClick={() => setTypeFilter('combined')}
                    size="sm"
                    className="text-xs sm:text-sm"
                  >
                    <Grid3x3 size={14} className="mr-1" />
                    <Package size={14} className="mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Rentas + Consumos</span>
                    <span className="sm:hidden">Combinado</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Sección de Ingresos Combinados (Rentas + Consumos) */}
            {combinedIncomes.length > 0 && (typeFilter === 'all' || typeFilter === 'combined') && (
              <Card className="mb-6">
                <CardBody>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Grid3x3 size={24} className="text-blue-600" />
                    Rentas con Consumo ({combinedIncomes.length})
                  </h2>
                  <div className="space-y-4">
                    {combinedIncomes.map((item, idx) => (
                      <div key={`combined-${idx}`} className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-green-50">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-bold text-lg flex items-center gap-2">
                              <Grid3x3 size={20} className="text-blue-600" />
                              {item.rental.tables?.name || 'Mesa'}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Cliente: {item.rental.clients?.name || 'Sin cliente'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(item.rental.end_time).toLocaleDateString('es-PE')} - {new Date(item.rental.end_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600">
                              S/ {item.totalAmount.toFixed(2)}
                            </div>
                            <Badge variant={item.rental.is_paid ? 'success' : 'danger'} size="sm">
                              {item.rental.is_paid ? 'Pagado' : 'Pendiente'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <div className="bg-white rounded p-3 border-l-4 border-blue-500">
                            <div className="text-xs text-muted-foreground mb-1">Alquiler de Mesa</div>
                            <div className="text-lg font-bold text-blue-600">S/ {item.rentalAmount.toFixed(2)}</div>
                          </div>
                          <div className="bg-white rounded p-3 border-l-4 border-green-500">
                            <div className="text-xs text-muted-foreground mb-1">Consumo ({item.sales.length} productos)</div>
                            <div className="text-lg font-bold text-green-600">S/ {item.consumptionAmount.toFixed(2)}</div>
                          </div>
                        </div>

                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm font-semibold text-blue-600 hover:text-blue-800">
                            Ver detalle de consumo
                          </summary>
                          <div className="mt-2 space-y-1">
                            {item.sales.map((sale) => (
                              <div key={sale.id} className="flex justify-between text-sm bg-white p-2 rounded">
                                <span className="flex items-center gap-2">
                                  <Package size={14} className="text-muted-foreground" />
                                  {sale.products?.name || 'N/A'} x{sale.quantity}
                                </span>
                                <span className="font-semibold">S/ {Number(sale.total_amount).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Income Table - Desktop */}
            <Card className="hidden md:block">
              <CardBody className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Mesa</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredIncomes.map((income) => (
                        <TableRow key={income.id}>
                          <TableCell>
                            <Badge variant={income.type === 'sale' ? 'default' : 'info'}>
                              {income.type === 'sale' ? (
                                <><Package size={14} className="mr-1" /> Venta</>
                              ) : (
                                <><Grid3x3 size={14} className="mr-1" /> Alquiler</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium text-gray-900">
                              {income.type === 'sale' ? income.product_name : `Alquiler de ${income.table_name}`}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <User size={20} className="text-gray-400 mr-3" />
                              <div className="text-sm text-gray-900">
                                {income.client_name}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-gray-900">
                              {income.table_name}
                            </div>
                          </TableCell>
                          <TableCell>{income.worker}</TableCell>
                          <TableCell className="font-semibold">{income.quantity || '-'}</TableCell>
                          <TableCell className="font-bold text-gray-900">S/ {income.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={income.is_paid ? 'success' : 'danger'}>
                              {income.is_paid ? (
                                <><CreditCard size={14} className="mr-1" /> Pagado</>
                              ) : (
                                <><AlertCircle size={14} className="mr-1" /> Fiado</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm text-gray-500">
                              <Calendar size={16} className="mr-2" />
                              {new Date(income.date).toLocaleDateString('es-PE')}
                              <span className="ml-2 text-xs">
                                {new Date(income.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {filteredIncomes.length === 0 && (
                  <div className="text-center py-12">
                    <ShoppingCart size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay Ingresos</h3>
                    <p className="text-gray-600">No se han registrado ingresos en este período</p>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Income Cards - Mobile */}
            <div className="md:hidden space-y-3">
              {filteredIncomes.length === 0 ? (
                <Card>
                  <CardBody>
                    <div className="text-center py-8">
                      <ShoppingCart size={40} className="mx-auto text-gray-400 mb-3" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay Ingresos</h3>
                      <p className="text-gray-600 text-sm">No se han registrado ingresos en este período</p>
                    </div>
                  </CardBody>
                </Card>
              ) : (
                filteredIncomes.map((income) => (
                  <Card key={income.id} className="bg-white border border-gray-200">
                    <CardBody className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <Badge variant={income.type === 'sale' ? 'default' : 'info'}>
                          {income.type === 'sale' ? (
                            <><Package size={12} className="mr-1" /> Venta</>
                          ) : (
                            <><Grid3x3 size={12} className="mr-1" /> Alquiler</>
                          )}
                        </Badge>
                        <Badge variant={income.is_paid ? 'success' : 'danger'}>
                          {income.is_paid ? (
                            <><CreditCard size={12} className="mr-1" /> Pagado</>
                          ) : (
                            <><AlertCircle size={12} className="mr-1" /> Fiado</>
                          )}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {income.type === 'sale' ? income.product_name : `Alquiler de ${income.table_name}`}
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          <div>
                            <p className="font-medium">Cliente:</p>
                            <p className="truncate">{income.client_name}</p>
                          </div>
                          <div>
                            <p className="font-medium">Mesa:</p>
                            <p className="truncate">{income.table_name}</p>
                          </div>
                          <div>
                            <p className="font-medium">Vendedor:</p>
                            <p className="truncate">{income.worker}</p>
                          </div>
                          <div>
                            <p className="font-medium">Cantidad:</p>
                            <p>{income.quantity || '-'}</p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                          <div className="text-xs text-gray-500 flex items-center">
                            <Calendar size={12} className="mr-1" />
                            {new Date(income.date).toLocaleDateString('es-PE')} {new Date(income.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            S/ {income.amount.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
