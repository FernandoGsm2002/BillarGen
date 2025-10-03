"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { ShoppingCart, User, Package, Calendar, CreditCard, AlertCircle } from 'lucide-react';
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

export default function SalesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [sales, setSales] = useState<SaleWithDetails[]>([]);
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all');

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
    loadSales(parsedUser.tenant_id, 'all');
  }, [router]);

  const loadSales = async (tenantId: number, filterType: string) => {
    let query = supabase
      .from('sales')
      .select('*, products(name), users(username), clients(name), rentals(id, tables(name))')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (filterType === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = query.gte('created_at', today.toISOString());
    } else if (filterType === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('created_at', weekAgo.toISOString());
    }

    const { data } = await query;
    if (data) setSales(data as SaleWithDetails[]);
  };

  const handleFilterChange = (newFilter: 'all' | 'today' | 'week') => {
    setFilter(newFilter);
    if (user) loadSales(user.tenant_id, newFilter);
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        <Sidebar role={user.role as 'admin' | 'worker' | 'super_admin'} username={user.username} />

        <div className="flex-1 overflow-auto">
          {/* Header */}
          <div className="bg-card border-b">
            <div className="px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
              <h1 className="text-3xl font-bold">Ventas</h1>
              <p className="text-base text-muted-foreground mt-1">Historial de Ventas realizadas</p>
            </div>
          </div>

          <div className="p-4 md:p-6 lg:p-8">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatCard title="Total Ventas" value={`S/ ${totalSales.toFixed(2)}`} accent="emerald" icon={<ShoppingCart size={40} />} />
              <StatCard title="Cantidad" value={sales.length} accent="blue" icon={<Package size={40} />} />
              <StatCard title="Promedio" value={`S/ ${sales.length > 0 ? (totalSales / sales.length).toFixed(2) : '0.00'}`} accent="slate" icon={<Calendar size={40} />} />
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-3">
              <Button
                variant={filter === 'all' ? 'default' : 'ghost'}
                onClick={() => handleFilterChange('all')}
              >
                Todas
              </Button>
              <Button
                variant={filter === 'today' ? 'default' : 'ghost'}
                onClick={() => handleFilterChange('today')}
              >
                Hoy
              </Button>
              <Button
                variant={filter === 'week' ? 'default' : 'ghost'}
                onClick={() => handleFilterChange('week')}
              >
                Última Semana
              </Button>
            </div>
            {/* Sales Table */}
            <Card>
              <CardBody className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
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
                    {sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <Package size={20} className="text-gray-400 mr-3" />
                            <div className="text-sm font-medium text-gray-900">
                              {sale.products?.name || 'N/A'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <User size={20} className="text-gray-400 mr-3" />
                            <div className="text-sm text-gray-900">
                              {sale.clients?.name || 'Sin cliente'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-900">
                            {sale.rentals?.tables?.name || '-'}
                          </div>
                        </TableCell>
                        <TableCell>{sale.users?.username || 'N/A'}</TableCell>
                        <TableCell className="font-semibold">{sale.quantity}</TableCell>
                        <TableCell className="font-bold text-green-600">S/ {Number(sale.total_amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={sale.is_paid ? 'success' : 'danger'}>
                            {sale.is_paid ? (
                              <><CreditCard size={14} className="mr-1" /> Pagado</>
                            ) : (
                              <><AlertCircle size={14} className="mr-1" /> Fiado</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm text-gray-500">
                            <Calendar size={16} className="mr-2" />
                            {new Date(sale.created_at).toLocaleDateString('es-PE')}
                            <span className="ml-2 text-xs">
                              {new Date(sale.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {sales.length === 0 && (
                  <div className="text-center py-12">
                    <ShoppingCart size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay Ventas</h3>
                    <p className="text-gray-600">No se han registrado Ventas en este período</p>
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
