"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { StatCard, Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DateFilters } from '@/components/DateFilters';
import { Input } from '@/components/ui/input';
import { Users, AlertTriangle, DollarSign, Eye, Package, Calendar, Search } from 'lucide-react';

interface ClientWithDebt {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  total_debt: number;
  total_purchases: number;
  unpaid_sales: number;
}

export default function WorkerClientsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [clients, setClients] = useState<ClientWithDebt[]>([]);
  const [filter, setFilter] = useState<'all' | 'with_debt'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Removido: variables no usadas en worker clients
  const [selectedClient, setSelectedClient] = useState<ClientWithDebt | null>(null);
  const [clientSales, setClientSales] = useState<any[]>([]);
  const [clientRentals, setClientRentals] = useState<Array<{ id: number; total_amount: number; is_paid: boolean; end_time: string; tables?: { name: string } }>>([]);
  const [dateFilter, setDateFilter] = useState('all');
  const [filteredSales, setFilteredSales] = useState<any[]>([]);
  const [filteredRentals, setFilteredRentals] = useState<any[]>([]);

  // Filtrar ventas y alquileres por fecha
  const handleDateFilterChange = useCallback((filter: string, startDate: Date, endDate: Date) => {
    setDateFilter(filter);
    
    if (filter === 'all') {
      setFilteredSales(clientSales);
      setFilteredRentals(clientRentals);
    } else {
      const salesFiltered = clientSales.filter(sale => {
        const saleDate = new Date(sale.created_at);
        return saleDate >= startDate && saleDate <= endDate;
      });
      
      const rentalsFiltered = clientRentals.filter(rental => {
        const rentalDate = new Date(rental.end_time);
        return rentalDate >= startDate && rentalDate <= endDate;
      });
      
      setFilteredSales(salesFiltered);
      setFilteredRentals(rentalsFiltered);
    }
  }, [clientSales, clientRentals]);

  // Actualizar filtros cuando cambien los datos
  useEffect(() => {
    if (dateFilter === 'all') {
      setFilteredSales(clientSales);
      setFilteredRentals(clientRentals);
    } else {
      // Re-aplicar filtro actual
      handleDateFilterChange(dateFilter, new Date(), new Date());
    }
  }, [clientSales, clientRentals, dateFilter, handleDateFilterChange]);

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
    loadClients(parsedUser.tenant_id);
  }, [router]);

  // Debounce del buscador
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim().toLowerCase()), 600);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const loadClients = async (tenantId: number) => {
    const { data: clientsData } = await supabase
      .from('clients')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (!clientsData) return;

    const clientsWithDebt = await Promise.all(
      clientsData.map(async (client) => {
        const { data: unpaidSales } = await supabase
          .from('sales')
          .select('total_amount')
          .eq('client_id', client.id)
          .eq('is_paid', false);

        const { data: allSales } = await supabase
          .from('sales')
          .select('total_amount')
          .eq('client_id', client.id);

        const total_debt = unpaidSales?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;
        const total_purchases = allSales?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;

        return {
          ...client,
          total_debt,
          total_purchases,
          unpaid_sales: unpaidSales?.length || 0
        } as ClientWithDebt;
      })
    );

    setClients(clientsWithDebt);
  };

  // Removido: handleCreateClient no usado en worker (solo ver clientes)

  const handleViewDetails = async (client: ClientWithDebt) => {
    setSelectedClient(client);
    
    // Cargar ventas del cliente
    const { data: salesData } = await supabase
      .from('sales')
      .select('*, products(name), rentals(id, tables(name))')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false });
    
    // Cargar rentas del cliente
    const { data: rentalsData } = await supabase
      .from('rentals')
      .select('*, tables(name)')
      .eq('client_id', client.id)
      .not('end_time', 'is', null)
      .order('end_time', { ascending: false });
    
    setClientSales(salesData || []);
    setClientRentals(rentalsData || []);
  };

  const handleMarkAsPaid = async (saleId: number) => {
    if (!confirm('¿Marcar esta venta como pagada?')) return;
    
    await supabase
      .from('sales')
      .update({ is_paid: true })
      .eq('id', saleId);
    
    if (selectedClient) {
      handleViewDetails(selectedClient);
      if (user) loadClients(user.tenant_id);
    }
  };

  const handleMarkRentalAsPaid = async (rentalId: number) => {
    if (!confirm('¿Marcar esta renta como pagada?')) return;
    
    await supabase
      .from('rentals')
      .update({ is_paid: true })
      .eq('id', rentalId);
    
    await supabase
      .from('sales')
      .update({ is_paid: true })
      .eq('rental_id', rentalId);
    
    if (selectedClient) {
      handleViewDetails(selectedClient);
      if (user) loadClients(user.tenant_id);
    }
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  const baseClients = filter === 'with_debt' 
    ? clients.filter(c => c.total_debt > 0)
    : clients;
  const filteredClients = debouncedSearch
    ? baseClients.filter(c =>
        c.name.toLowerCase().includes(debouncedSearch) ||
        (c.phone ? c.phone.toLowerCase().includes(debouncedSearch) : false)
      )
    : baseClients;

  const totalDebt = clients.reduce((sum, c) => sum + c.total_debt, 0);
  const clientsWithDebt = clients.filter(c => c.total_debt > 0).length;

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        <Sidebar role={user.role as 'admin' | 'worker' | 'super_admin'} username={user.username} />

        <div className="flex-1 overflow-auto">
          {/* Header */}
          <div className="bg-card border-b">
            <div className="px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <SidebarTrigger className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors" />
                <div className="p-3 sm:p-4 bg-gray-100 rounded-xl">
                  <Users size={28} className="text-gray-700 sm:w-8 sm:h-8" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Clientes</h1>
                  <p className="text-sm text-gray-600 mt-0.5 font-medium hidden sm:block">Consulta y crea clientes</p>
                  <p className="text-xs text-gray-500 mt-0.5 sm:hidden">Gestión de clientes</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 lg:p-8 xl:p-12 w-full max-w-[1800px] mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <StatCard title="Total Clientes" value={clients.length} accent="slate" icon={<Users size={40} />} />
              <StatCard title="Con Deudas" value={clientsWithDebt} accent="amber" icon={<AlertTriangle size={40} />} />
              <StatCard title="Deuda Total" value={`S/ ${totalDebt.toFixed(2)}`} accent="red" icon={<DollarSign size={40} />} />
            </div>

            {/* Filtros y Buscador */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
              {/* Filtros por tipo */}
              <div className="flex gap-3">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilter('all')}
                  size="sm"
                >
                  Todos los Clientes
                </Button>
                <Button
                  variant={filter === 'with_debt' ? 'default' : 'outline'}
                  onClick={() => setFilter('with_debt')}
                  size="sm"
                >
                  Solo con Deudas
                </Button>
              </div>

              {/* Buscador */}
              <div className="relative max-w-md w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre o teléfono..."
                  className="pl-10 pr-10"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <Card>
              <CardBody className="p-0">
                {filteredClients.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                    {filteredClients.map((client) => (
                      <div key={client.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                        {/* Header del cliente */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                              <Users size={24} className="text-indigo-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-bold text-gray-900 truncate">{client.name}</h3>
                              <p className="text-sm text-gray-500 truncate">
                                {client.phone || 'Sin teléfono'}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 ml-2 text-right">
                            <div className="text-lg font-bold text-red-600">S/ {client.total_debt.toFixed(2)}</div>
                            <div className="text-xs text-gray-500">Deuda</div>
                          </div>
                        </div>

                        {/* Información financiera */}
                        <div className="space-y-3 mb-4">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <span className="text-xs text-gray-600 font-medium">Total Compras</span>
                                <p className="font-bold text-gray-900">S/ {client.total_purchases.toFixed(2)}</p>
                              </div>
                              <div>
                                <span className="text-xs text-gray-600 font-medium">Ventas Pendientes</span>
                                <p className="font-bold text-amber-600">{client.unpaid_sales}</p>
                              </div>
                            </div>
                            {client.unpaid_sales > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <p className="text-xs text-amber-600 font-medium">
                                  {client.unpaid_sales} venta{client.unpaid_sales !== 1 ? 's' : ''} sin pagar
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Estado del cliente */}
                          <div className="flex items-center justify-center">
                            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                              client.total_debt > 0 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {client.total_debt > 0 ? '⚠️ Cliente con Deuda' : '✅ Cliente al Día'}
                            </div>
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="space-y-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleViewDetails(client)} 
                            className="w-full"
                          >
                            <Eye size={16} className="mr-2" /> Ver Historial Completo
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Users size={64} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">No hay clientes registrados</h3>
                    <p className="text-gray-600 mb-6">
                      Los clientes aparecerán aquí cuando realicen sus primeras compras o se registren en el sistema
                    </p>
                    <div className="text-sm text-gray-500">
                      💡 Los clientes se crean automáticamente al hacer ventas fiadas
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal Detalles Cliente */}
      <Dialog open={selectedClient !== null} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-2xl">
              Historial - {selectedClient?.name}
            </DialogTitle>
          </DialogHeader>
          
          {/* Filtros de Fecha */}
          <div className="border-b pb-4">
            <DateFilters
              selectedFilter={dateFilter}
              onFilterChange={handleDateFilterChange}
              className="justify-start"
            />
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground font-semibold">Total Compras</p>
                <p className="text-2xl font-bold">S/ {selectedClient?.total_purchases.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-700 font-semibold">Deuda</p>
                <p className="text-2xl font-bold text-red-600">S/ {selectedClient?.total_debt.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-700 font-semibold">Sin Pagar</p>
                <p className="text-2xl font-bold text-amber-600">{selectedClient?.unpaid_sales}</p>
              </div>
            </div>

            {/* Tabla de Rentas */}
            {filteredRentals.length > 0 && (
              <div className="border rounded-lg overflow-hidden mb-4">
                <div className="bg-blue-50 px-4 py-2 border-b">
                  <h3 className="font-bold text-blue-900">Alquileres de Mesas</h3>
                </div>
                
                {/* Vista móvil - Cards */}
                <div className="md:hidden divide-y">
                  {filteredRentals.map((rental) => (
                    <div key={rental.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{rental.tables?.name || 'N/A'}</p>
                          <p className="text-sm text-gray-500">{new Date(rental.end_time).toLocaleDateString('es-PE')}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${rental.is_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {rental.is_paid ? 'Pagado' : 'Pendiente'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-green-600">S/ {Number(rental.total_amount).toFixed(2)}</p>
                        {!rental.is_paid && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkRentalAsPaid(rental.id)}>
                            Marcar Pagado
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Vista desktop - Tabla */}
                <div className="hidden md:block">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Mesa</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Estado</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredRentals.map((rental) => (
                        <tr key={rental.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{rental.tables?.name || 'N/A'}</td>
                          <td className="px-4 py-3 font-bold text-green-600">S/ {Number(rental.total_amount).toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${rental.is_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {rental.is_paid ? 'Pagado' : 'Pendiente'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {new Date(rental.end_time).toLocaleDateString('es-PE')}
                          </td>
                          <td className="px-4 py-3">
                            {!rental.is_paid && (
                              <Button size="sm" variant="outline" onClick={() => handleMarkRentalAsPaid(rental.id)}>
                                Marcar Pagado
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tabla de Ventas */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-green-50 px-4 py-2 border-b">
                <h3 className="font-bold text-green-900">Productos Vendidos</h3>
              </div>
              
              {filteredSales.length > 0 ? (
                <>
                  {/* Vista móvil - Cards */}
                  <div className="md:hidden divide-y">
                    {filteredSales.map((sale) => (
                      <div key={sale.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Package size={16} className="text-muted-foreground" />
                            <div>
                              <p className="font-medium text-gray-900">{sale.products?.name || 'N/A'}</p>
                              <p className="text-sm text-gray-500">{sale.rentals?.tables?.name || 'Sin mesa'}</p>
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${sale.is_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {sale.is_paid ? 'Pagado' : 'Fiado'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Cantidad:</span>
                            <p className="font-semibold">{sale.quantity}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Total:</span>
                            <p className="font-bold text-green-600">S/ {Number(sale.total_amount).toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Fecha:</span>
                            <p className="text-xs">{new Date(sale.created_at).toLocaleDateString('es-PE')}</p>
                          </div>
                        </div>
                        
                        {!sale.is_paid && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkAsPaid(sale.id)} className="w-full">
                            Marcar Pagado
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Vista desktop - Tabla */}
                  <div className="hidden md:block">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Producto</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Mesa</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Cant.</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Total</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Estado</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Fecha</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredSales.map((sale) => (
                          <tr key={sale.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Package size={16} className="text-muted-foreground" />
                                <span className="font-medium text-sm">{sale.products?.name || 'N/A'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">{sale.rentals?.tables?.name || '-'}</td>
                            <td className="px-4 py-3 font-semibold">{sale.quantity}</td>
                            <td className="px-4 py-3 font-bold text-green-600">S/ {Number(sale.total_amount).toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${sale.is_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {sale.is_paid ? 'Pagado' : 'Fiado'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar size={14} />
                                {new Date(sale.created_at).toLocaleDateString('es-PE')}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {!sale.is_paid && (
                                <Button size="sm" variant="outline" onClick={() => handleMarkAsPaid(sale.id)}>
                                  Marcar Pagado
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package size={40} className="mx-auto mb-2 opacity-30" />
                  <p>No hay ventas registradas</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
