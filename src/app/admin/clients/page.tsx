"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardBody, StatCard } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserCheck, DollarSign, AlertCircle, Search, Eye, Package, Calendar, Plus } from 'lucide-react';

interface ClientWithDebt {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  permitir_fiado: boolean;
  total_debt: number;
  total_purchases: number;
  unpaid_sales: number;
}

export default function ClientsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [clients, setClients] = useState<ClientWithDebt[]>([]);
  const [filter, setFilter] = useState<'all' | 'with_debt'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientWithDebt | null>(null);
  const [clientSales, setClientSales] = useState<Array<{ id: number; total_amount: number; is_paid: boolean; created_at: string; quantity: number; products?: { name: string }; rentals?: { id: number; tables?: { name: string } } }>>([]);
  const [clientRentals, setClientRentals] = useState<Array<{ id: number; total_amount: number; is_paid: boolean; end_time: string; tables?: { name: string } }>>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', permitir_fiado: true });

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
    loadClients(parsedUser.tenant_id);
  }, [router]);

  // Debounce del buscador
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim().toLowerCase()), 600);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const loadClients = async (tenantId: number) => {
    // Obtener todos los clientes
    const { data: clientsData } = await supabase
      .from('clients')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (!clientsData) return;

    // Para cada cliente, calcular deuda y compras
    const clientsWithDebt = await Promise.all(
      clientsData.map(async (client) => {
        // Ventas no pagadas
        const { data: unpaidSales } = await supabase
          .from('sales')
          .select('total_amount')
          .eq('client_id', client.id)
          .eq('is_paid', false);

        // Total de compras
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
        };
      })
    );

    setClients(clientsWithDebt);
  };

  const handlePayDebt = async (clientId: number) => {
    if (!confirm('¿Marcar todas las deudas de este cliente como pagadas?')) return;

    await supabase
      .from('sales')
      .update({ is_paid: true })
      .eq('client_id', clientId)
      .eq('is_paid', false);

    if (user) loadClients(user.tenant_id);
  };

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
    
    // Recargar datos del cliente
    if (selectedClient) {
      handleViewDetails(selectedClient);
      if (user) loadClients(user.tenant_id);
    }
  };

  const handleMarkRentalAsPaid = async (rentalId: number) => {
    if (!confirm('¿Marcar esta renta como pagada?')) return;
    
    // Marcar la renta como pagada
    await supabase
      .from('rentals')
      .update({ is_paid: true })
      .eq('id', rentalId);
    
    // También marcar las ventas asociadas como pagadas
    await supabase
      .from('sales')
      .update({ is_paid: true })
      .eq('rental_id', rentalId);
    
    // Recargar datos del cliente
    if (selectedClient) {
      handleViewDetails(selectedClient);
      if (user) loadClients(user.tenant_id);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setCreating(true);
    try {
      await supabase.from('clients').insert([{
        tenant_id: user.tenant_id,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        permitir_fiado: form.permitir_fiado
      }]);
      setForm({ name: '', phone: '', email: '', permitir_fiado: true });
      setShowCreateModal(false);
      loadClients(user.tenant_id);
    } catch (err) {
      console.error(err);
      alert('Error al crear cliente');
    } finally {
      setCreating(false);
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
        <div className="bg-card border-b">
          <div className="px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="md:hidden" />
              <div className="p-4 bg-muted rounded-xl">
                <UserCheck size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Clientes</h1>
                <p className="text-base text-muted-foreground mt-1">Gestión de deudas y consumos</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 lg:p-8">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <StatCard
              title="Total Clientes"
              value={clients.length}
              accent="slate"
              icon={<UserCheck size={40} />}
            />
            <StatCard
              title="Con Deudas"
              value={clientsWithDebt}
              accent="amber"
              icon={<AlertCircle size={40} />}
            />
            <StatCard
              title="Deuda Total"
              value={`S/ ${totalDebt.toFixed(2)}`}
              accent="red"
              icon={<DollarSign size={40} />}
            />
          </div>

          {/* Buscador */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar clientes por nombre o teléfono..."
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Filtros y Acciones */}
          <div className="mb-6 flex justify-between items-center">
            <div className="flex gap-3">
              <Button
                variant={filter === 'all' ? 'default' : 'ghost'}
                onClick={() => setFilter('all')}
              >
                Todos ({clients.length})
              </Button>
              <Button
                variant={filter === 'with_debt' ? 'secondary' : 'ghost'}
                onClick={() => setFilter('with_debt')}
              >
                Con Deudas ({clientsWithDebt})
              </Button>
            </div>
            <Button
              variant="default"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={20} className="mr-2" /> Crear Cliente
            </Button>
          </div>

          {/* Tabla de Clientes */}
          <Card>
            <CardBody className="p-0">
              {/* Vista móvil - Cards */}
              <div className="md:hidden">
                {filteredClients.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {filteredClients.map((client) => (
                      <div key={client.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                              <UserCheck size={20} className="text-indigo-600" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900">{client.name}</div>
                              <div className="text-xs text-gray-500">{client.phone || client.email || 'Sin contacto'}</div>
                            </div>
                          </div>
                          <Badge variant={client.total_debt > 0 ? 'danger' : 'success'}>
                            {client.total_debt > 0 ? 'Con Deuda' : 'Al Día'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-600">Total Compras:</span>
                            <p className="font-bold text-gray-900">S/ {client.total_purchases.toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Deuda:</span>
                            <p className="font-bold text-red-600">S/ {client.total_debt.toFixed(2)}</p>
                            {client.unpaid_sales > 0 && (
                              <p className="text-xs text-gray-500">{client.unpaid_sales} sin pagar</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewDetails(client)} className="flex-1">
                            <Eye size={16} className="mr-1" /> Ver Detalle
                          </Button>
                          {client.total_debt > 0 && (
                            <Button size="sm" onClick={() => handlePayDebt(client.id)} className="flex-1">
                              Pagar Deuda
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <UserCheck size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay clientes</h3>
                    <p className="text-gray-600">
                      {filter === 'with_debt' 
                        ? 'No hay clientes con deudas pendientes'
                        : 'Los clientes aparecerán cuando realicen compras'}
                    </p>
                  </div>
                )}
              </div>

              {/* Vista desktop - Tabla */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Total Compras</TableHead>
                      <TableHead>Deuda Pendiente</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                              <UserCheck size={20} className="text-indigo-600" />
                            </div>
                            <div className="text-sm font-bold text-gray-900">{client.name}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-900">{client.phone || '-'}</div>
                          <div className="text-xs text-gray-500">{client.email || '-'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-bold text-gray-900">S/ {client.total_purchases.toFixed(2)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-lg font-bold text-red-600">S/ {client.total_debt.toFixed(2)}</div>
                          {client.unpaid_sales > 0 && (
                            <div className="text-xs text-gray-500">{client.unpaid_sales} Ventas sin pagar</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={client.total_debt > 0 ? 'danger' : 'success'}>
                            {client.total_debt > 0 ? 'Con Deuda' : 'Al Día'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewDetails(client)}>
                              <Eye size={16} className="mr-1" /> Ver
                            </Button>
                            {client.total_debt > 0 && (
                              <Button size="sm" onClick={() => handlePayDebt(client.id)}>Pagar</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {filteredClients.length === 0 && (
                  <div className="text-center py-12">
                    <UserCheck size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay clientes</h3>
                    <p className="text-gray-600">
                      {filter === 'with_debt' 
                        ? 'No hay clientes con deudas pendientes'
                        : 'Los clientes aparecerán cuando realicen compras'}
                    </p>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
      </div>

      {/* Modal Detalles Cliente */}
      <Dialog open={selectedClient !== null} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-2xl">
              Historial de Ventas - {selectedClient?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground font-semibold">Total Compras</p>
                <p className="text-2xl font-bold">S/ {selectedClient?.total_purchases.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-700 font-semibold">Deuda Pendiente</p>
                <p className="text-2xl font-bold text-red-600">S/ {selectedClient?.total_debt.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-700 font-semibold">Ventas Sin Pagar</p>
                <p className="text-2xl font-bold text-amber-600">{selectedClient?.unpaid_sales}</p>
              </div>
            </div>

            {/* Tabla de Rentas */}
            {clientRentals.length > 0 && (
              <div className="border rounded-lg overflow-hidden mb-4">
                <div className="bg-blue-50 px-4 py-2 border-b">
                  <h3 className="font-bold text-blue-900">Alquileres de Mesas</h3>
                </div>
                
                {/* Vista móvil - Cards */}
                <div className="md:hidden divide-y">
                  {clientRentals.map((rental) => (
                    <div key={rental.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{rental.tables?.name || 'N/A'}</p>
                          <p className="text-sm text-gray-500">{new Date(rental.end_time).toLocaleDateString('es-PE')}</p>
                        </div>
                        <Badge variant={rental.is_paid ? 'success' : 'danger'} className="text-xs">
                          {rental.is_paid ? 'Pagado' : 'Pendiente'}
                        </Badge>
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
                <div className="hidden md:block overflow-x-auto">
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
                      {clientRentals.map((rental) => (
                        <tr key={rental.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{rental.tables?.name || 'N/A'}</td>
                          <td className="px-4 py-3 font-bold text-green-600">S/ {Number(rental.total_amount).toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={rental.is_paid ? 'success' : 'danger'} className="text-xs">
                              {rental.is_paid ? 'Pagado' : 'Pendiente'}
                            </Badge>
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
              
              {clientSales.length > 0 ? (
                <>
                  {/* Vista móvil - Cards */}
                  <div className="md:hidden divide-y">
                    {clientSales.map((sale) => (
                      <div key={sale.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Package size={16} className="text-muted-foreground" />
                            <div>
                              <p className="font-medium text-gray-900">{sale.products?.name || 'N/A'}</p>
                              <p className="text-sm text-gray-500">{sale.rentals?.tables?.name || 'Sin mesa'}</p>
                            </div>
                          </div>
                          <Badge variant={sale.is_paid ? 'success' : 'danger'} className="text-xs">
                            {sale.is_paid ? 'Pagado' : 'Fiado'}
                          </Badge>
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
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Producto</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Mesa</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Cantidad</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Total</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Estado</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Fecha</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {clientSales.map((sale) => (
                          <tr key={sale.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Package size={16} className="text-muted-foreground" />
                                <span className="font-medium">{sale.products?.name || 'N/A'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {sale.rentals?.tables?.name || '-'}
                            </td>
                            <td className="px-4 py-3 font-semibold">{sale.quantity}</td>
                            <td className="px-4 py-3 font-bold text-green-600">S/ {Number(sale.total_amount).toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <Badge variant={sale.is_paid ? 'success' : 'danger'} className="text-xs">
                                {sale.is_paid ? 'Pagado' : 'Fiado'}
                              </Badge>
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

      {/* Modal Crear Cliente */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateClient} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nombre *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nombre del cliente"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Teléfono</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="999 999 999"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="cliente@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Permitir Fiado</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="permitir_fiado"
                    checked={form.permitir_fiado === true}
                    onChange={() => setForm({ ...form, permitir_fiado: true })}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="text-sm text-green-700 font-medium">SÍ</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="permitir_fiado"
                    checked={form.permitir_fiado === false}
                    onChange={() => setForm({ ...form, permitir_fiado: false })}
                    className="w-4 h-4 text-red-600"
                  />
                  <span className="text-sm text-red-700 font-medium">NO</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Si seleccionas &quot;SÍ&quot;, el cliente podrá realizar compras fiadas (a crédito)
              </p>
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creando...' : 'Crear Cliente'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
