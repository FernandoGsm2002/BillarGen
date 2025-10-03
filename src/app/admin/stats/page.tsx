"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { TrendingUp, DollarSign, ShoppingCart, Clock, Users, Package } from 'lucide-react';

interface Stats24h {
  totalSales: number;
  totalAmount: number;
  totalProducts: number;
  totalRentals: number;
  topProducts: Array<{ name: string; quantity: number; total: number }>;
  topWorkers: Array<{ username: string; sales: number; total: number }>;
  hourlyData: Array<{ hour: number; sales: number; amount: number }>;
}

export default function StatsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [stats, setStats] = useState<Stats24h>({
    totalSales: 0,
    totalAmount: 0,
    totalProducts: 0,
    totalRentals: 0,
    topProducts: [],
    topWorkers: [],
    hourlyData: []
  });
  const [loading, setLoading] = useState(true);

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
    loadStats(parsedUser.tenant_id);
  }, [router]);

  const loadStats = async (tenantId: number) => {
    setLoading(true);
    
    // Fecha de hace 24 horas
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);

    // Ventas últimas 24h
    const { data: salesData } = await supabase
      .from('sales')
      .select('*, products(name), users(username)')
      .eq('tenant_id', tenantId)
      .gte('created_at', last24h.toISOString());

    // Rentas últimas 24h
    const { data: rentalsData } = await supabase
      .from('rentals')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', last24h.toISOString());

    if (salesData) {
      // Calcular totales
      const totalAmount = salesData.reduce((sum, s) => sum + Number(s.total_amount), 0);
      const totalProducts = salesData.reduce((sum, s) => sum + s.quantity, 0);

      // Top productos
      const productMap = new Map();
      salesData.forEach(sale => {
        const name = sale.products?.name || 'Desconocido';
        if (!productMap.has(name)) {
          productMap.set(name, { name, quantity: 0, total: 0 });
        }
        const product = productMap.get(name);
        product.quantity += sale.quantity;
        product.total += Number(sale.total_amount);
      });
      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Top trabajadores
      const workerMap = new Map();
      salesData.forEach(sale => {
        const username = sale.users?.username || 'Desconocido';
        if (!workerMap.has(username)) {
          workerMap.set(username, { username, sales: 0, total: 0 });
        }
        const worker = workerMap.get(username);
        worker.sales += 1;
        worker.total += Number(sale.total_amount);
      });
      const topWorkers = Array.from(workerMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Ventas por hora
      const hourlyMap = new Map();
      salesData.forEach(sale => {
        const hour = new Date(sale.created_at).getHours();
        if (!hourlyMap.has(hour)) {
          hourlyMap.set(hour, { hour, sales: 0, amount: 0 });
        }
        const hourData = hourlyMap.get(hour);
        hourData.sales += 1;
        hourData.amount += Number(sale.total_amount);
      });
      const hourlyData = Array.from(hourlyMap.values()).sort((a, b) => a.hour - b.hour);

      setStats({
        totalSales: salesData.length,
        totalAmount,
        totalProducts,
        totalRentals: rentalsData?.length || 0,
        topProducts,
        topWorkers,
        hourlyData
      });
    }

    setLoading(false);
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
          <div className="px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
            <h1 className="text-3xl font-bold">📊 Estadísticas</h1>
            <p className="text-base text-muted-foreground mt-1">Últimas 24 horas</p>
          </div>
        </div>

        <div className="p-4 md:p-6 lg:p-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando estadísticas...</p>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card variant="stat">
                  <CardHeader accent="emerald">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-700 text-sm font-bold uppercase">Total Ventas</p>
                        <p className="text-4xl font-bold text-gray-900 mt-2">S/ {stats.totalAmount.toFixed(2)}</p>
                      </div>
                      <DollarSign size={48} className="text-green-600 opacity-20" />
                    </div>
                  </CardHeader>
                </Card>

                <Card variant="stat">
                  <CardHeader accent="blue">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-700 text-sm font-bold uppercase">Transacciones</p>
                        <p className="text-4xl font-bold text-gray-900 mt-2">{stats.totalSales}</p>
                      </div>
                      <ShoppingCart size={48} className="text-blue-600 opacity-20" />
                    </div>
                  </CardHeader>
                </Card>

                <Card variant="stat">
                  <CardHeader accent="slate">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-700 text-sm font-bold uppercase">Productos Vendidos</p>
                        <p className="text-4xl font-bold text-gray-900 mt-2">{stats.totalProducts}</p>
                      </div>
                      <Package size={48} className="text-purple-600 opacity-20" />
                    </div>
                  </CardHeader>
                </Card>

                <Card variant="stat">
                  <CardHeader accent="amber">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-700 text-sm font-bold uppercase">Rentas Iniciadas</p>
                        <p className="text-4xl font-bold text-gray-900 mt-2">{stats.totalRentals}</p>
                      </div>
                      <Clock size={48} className="text-orange-600 opacity-20" />
                    </div>
                  </CardHeader>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Productos */}
                <Card>
                  <CardHeader accent="blue">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <TrendingUp size={24} className="text-indigo-600" />
                      Top 5 Productos
                    </h2>
                  </CardHeader>
                  <CardBody>
                    {stats.topProducts.length > 0 ? (
                      <div className="space-y-3">
                        {stats.topProducts.map((product, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">{product.name}</p>
                                <p className="text-sm text-gray-600">{product.quantity} unidades</p>
                              </div>
                            </div>
                            <p className="text-lg font-bold text-green-600">S/ {product.total.toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-8">No hay datos</p>
                    )}
                  </CardBody>
                </Card>

                {/* Top Trabajadores */}
                <Card>
                  <CardHeader accent="blue">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <Users size={24} className="text-blue-600" />
                      Top 5 Vendedores
                    </h2>
                  </CardHeader>
                  <CardBody>
                    {stats.topWorkers.length > 0 ? (
                      <div className="space-y-3">
                        {stats.topWorkers.map((worker, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">{worker.username}</p>
                                <p className="text-sm text-gray-600">{worker.sales} ventas</p>
                              </div>
                            </div>
                            <p className="text-lg font-bold text-green-600">S/ {worker.total.toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-8">No hay datos</p>
                    )}
                  </CardBody>
                </Card>
              </div>

              {/* Ventas por Hora */}
              {stats.hourlyData.length > 0 && (
                <Card className="mt-8">
                  <CardHeader accent="slate">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <Clock size={24} className="text-purple-600" />
                      Ventas por Hora
                    </h2>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-2">
                      {stats.hourlyData.map((hour) => (
                        <div key={hour.hour} className="flex items-center gap-4">
                          <div className="w-16 text-sm font-bold text-gray-700">
                            {String(hour.hour).padStart(2, '0')}:00
                          </div>
                          <div className="flex-1">
                            <div className="bg-gray-200 rounded-full h-8 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-purple-500 to-indigo-600 h-full flex items-center justify-end px-3 text-white font-bold text-sm"
                                style={{ width: `${(hour.amount / stats.totalAmount) * 100}%` }}
                              >
                                {hour.sales > 0 && `${hour.sales} ventas`}
                              </div>
                            </div>
                          </div>
                          <div className="w-24 text-right font-bold text-gray-900">
                            S/ {hour.amount.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
      </div>
    </SidebarProvider>
  );
}
