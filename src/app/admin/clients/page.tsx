"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Card, CardBody, StatCard } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserCheck, DollarSign, AlertCircle, Search, Eye, Package, Calendar } from 'lucide-react';

interface ClientWithDebt {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
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
  const [clientSales, setClientSales] = useState<any[]>([]);

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
    const { data } = await supabase
      .from('sales')
      .select('*, products(name), rentals(id, tables(name))')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false });
    setClientSales(data || []);
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

          {/* Filtros */}
          <div className="mb-6 flex gap-3">
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

          {/* Tabla de Clientes */}
          <Card>
            <CardBody className="p-0">
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
            </CardBody>
          </Card>
        </div>
      </div>
      </div>

      {/* Modal de Detalles del Cliente */}
      <Dialog open={selectedClient !== null} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
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

            {/* Tabla de Ventas */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Producto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Mesa</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Cantidad</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Fecha</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
              {clientSales.length === 0 && (
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
