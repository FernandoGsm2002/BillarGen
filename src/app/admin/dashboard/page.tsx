"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { TenantConfig } from '@/types/database.types';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Package, TrendingUp, AlertTriangle, DollarSign, Users, Calendar, Filter, MoreHorizontal, BarChart3, UserCheck, Settings } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/Badge';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [stats, setStats] = useState({
    totalTables: 0,
    availableTables: 0,
    occupiedTables: 0,
    lowStockProducts: 0,
    totalSales: 0,
    todaySales: 0,
    totalProducts: 0,
    activeRentals: 0,
    totalClients: 0,
    topProducts: [] as Array<{name: string, sales: number, revenue: number}>
  });
  
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date()
  });
  
  const [viewPeriod, setViewPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  // Función para formatear moneda con texto adaptativo
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `S/ ${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `S/ ${(amount / 1000).toFixed(1)}K`;
    } else {
      return `S/ ${amount.toFixed(2)}`;
    }
  };

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
    loadData(parsedUser.tenant_id);
    loadTenantConfig(parsedUser.tenant_id);
  }, [router]);

  const loadTenantConfig = async (tenantId: number) => {
    try {
      const { data, error } = await supabase
        .from('tenant_config')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error cargando configuración:', error);
        return;
      }

      if (data) {
        setTenantConfig(data);
      }
    } catch (error) {
      console.error('Error en loadTenantConfig:', error);
    }
  };

  const loadData = useCallback(async (tenantId: number) => {
    try {
    // Cargar mesas
    const { data: tablesData } = await supabase
      .from('tables')
      .select('*')
      .eq('tenant_id', tenantId);

    // Cargar productos con stock bajo
      const { data: lowStockData } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .lt('stock', 10);

      // Cargar total de productos activos
      const { data: allProductsData } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      // Cargar alquileres activos
      const { data: activeRentalsData } = await supabase
        .from('rentals')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('end_time', null);

      // Cargar total de clientes
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id')
        .eq('tenant_id', tenantId);

      // Cargar ventas totales en el período
    const { data: salesData } = await supabase
      .from('sales')
      .select('total_amount')
        .eq('tenant_id', tenantId)
        .gte('created_at', dateRange.startDate.toISOString())
        .lte('created_at', dateRange.endDate.toISOString());

    // Cargar ventas de hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
    const { data: todaySalesData } = await supabase
      .from('sales')
      .select('total_amount')
      .eq('tenant_id', tenantId)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      // Cargar productos más vendidos
      const { data: topProductsData } = await supabase
        .from('sales')
        .select(`
          quantity,
          unit_price,
          total_amount,
          products:product_id (
            id,
            name
          )
        `)
        .eq('tenant_id', tenantId)
        .gte('created_at', dateRange.startDate.toISOString())
        .lte('created_at', dateRange.endDate.toISOString())
        .not('products', 'is', null);

      // Procesar productos más vendidos
      const productSales: { [key: string]: { name: string; sales: number; revenue: number } } = {};
      
      topProductsData?.forEach((sale: any) => {
        if (sale.products && sale.products.name) {
          const productName = sale.products.name;
          if (!productSales[productName]) {
            productSales[productName] = { name: productName, sales: 0, revenue: 0 };
          }
          productSales[productName].sales += sale.quantity || 0;
          productSales[productName].revenue += Number(sale.total_amount) || 0;
        }
      });

      const topProducts = Object.values(productSales)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

    setStats({
      totalTables: tablesData?.length || 0,
      availableTables: tablesData?.filter(t => t.is_available).length || 0,
      occupiedTables: tablesData?.filter(t => !t.is_available).length || 0,
        lowStockProducts: lowStockData?.length || 0,
      totalSales: salesData?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0,
        todaySales: todaySalesData?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0,
        totalProducts: allProductsData?.length || 0,
        activeRentals: activeRentalsData?.length || 0,
        totalClients: clientsData?.length || 0,
        topProducts
      });
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  }, [dateRange]);

  // Recargar datos cuando cambian los filtros
  useEffect(() => {
    if (user) {
      loadData(user.tenant_id);
    }
  }, [dateRange, viewPeriod, user, loadData]);

  const handlePeriodChange = (period: 'daily' | 'weekly' | 'monthly') => {
    setViewPeriod(period);
    const today = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'daily':
        startDate.setDate(today.getDate() - 1);
        break;
      case 'weekly':
        startDate.setDate(today.getDate() - 7);
        break;
      case 'monthly':
        startDate.setDate(today.getDate() - 30);
        break;
    }
    
    setDateRange({ startDate, endDate: today });
  };

  const formatDateRange = () => {
    const start = dateRange.startDate.toLocaleDateString('es-PE', { 
      month: 'short', 
      day: 'numeric' 
    });
    const end = dateRange.endDate.toLocaleDateString('es-PE', { 
      month: 'short', 
      day: 'numeric' 
    });
    return `${start} - ${end}`;
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-gray-50">
        <Sidebar role={user.role as 'admin' | 'worker' | 'super_admin'} username={user.username} />
        
        <div className="flex-1 overflow-auto">
        {/* Header */}
          <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="px-4 py-4 lg:px-8 lg:py-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <SidebarTrigger className="lg:hidden p-2 hover:bg-gray-100 rounded-lg" />
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                      {tenantConfig?.business_name 
                        ? `Bienvenido a ${tenantConfig.business_name} Billar`
                        : 'Bienvenido a tu Billar'
                      }
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">Resumen general de tu negocio</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
                    <Calendar size={16} />
                    {formatDateRange()}
                  </Button>
                  <select 
                    value={viewPeriod}
                    onChange={(e) => handlePeriodChange(e.target.value as 'daily' | 'weekly' | 'monthly')}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 hidden md:block"
                  >
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter size={16} />
                    <span className="hidden sm:inline">Filtro</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-4 lg:p-8 xl:p-12 space-y-6 lg:space-y-8 w-full max-w-[1800px] mx-auto">
            {/* Top Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              <Card className="p-6 bg-white border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <Package size={16} />
                      Productos Activos
                    </p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalProducts}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Package size={24} className="text-blue-600" />
                  </div>
                </div>
              </Card>
              
              <Card className="p-6 bg-white border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <DollarSign size={16} />
                      Ingresos Totales
                    </p>
                    <p className="text-3xl font-bold text-green-600 mt-2">{formatCurrency(stats.totalSales)}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <DollarSign size={24} className="text-green-600" />
                  </div>
                </div>
              </Card>
              
              <Card className="p-6 bg-white border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <TrendingUp size={16} />
                      Alquileres Activos
                    </p>
                    <p className="text-3xl font-bold text-purple-600 mt-2">{stats.activeRentals}</p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <TrendingUp size={24} className="text-purple-600" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Business Overview */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
              <Card className="p-6 bg-white border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Productos Más Vendidos</h2>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Filter size={16} />
                    Filtro
                  </Button>
                </div>
                <div className="space-y-4">
                  {stats.topProducts.length > 0 ? (
                    stats.topProducts.map((product, index) => (
                      <div key={product.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-bold text-sm">#{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{product.name}</p>
                            <p className="text-sm text-gray-500">{product.sales} unidades vendidas</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{formatCurrency(product.revenue)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <BarChart3 size={48} className="mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">Sin datos disponibles</p>
                      <p className="text-sm">Comienza a hacer ventas para ver tu análisis</p>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-6 bg-white border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Total de Clientes</h2>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{viewPeriod === 'daily' ? 'Diario' : viewPeriod === 'weekly' ? 'Semanal' : 'Mensual'}</p>
                    <p className="text-2xl font-bold">{stats.totalClients}</p>
                    <p className="text-xs text-gray-500">Clientes registrados</p>
                  </div>
                </div>
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users size={48} className="text-blue-600" />
                    </div>
                    {stats.totalClients > 0 ? (
                      <div>
                        <p className="text-lg font-medium text-gray-900">¡Excelente!</p>
                        <p className="text-sm text-gray-500">Tienes {stats.totalClients} cliente{stats.totalClients !== 1 ? 's' : ''} registrado{stats.totalClients !== 1 ? 's' : ''}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-lg font-medium text-gray-500">Sin clientes aún</p>
                        <p className="text-sm text-gray-400">Los clientes aparecerán aquí cuando se registren</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Tables Status */}
            <Card className="p-6 bg-white border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Estado de las Mesas</h2>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal size={16} />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-100 rounded-lg">
                      <Image src="/icons/mesa.ico" alt="Mesa" width={32} height={32} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total de Mesas</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.totalTables}</p>
            </div>
          </div>
        </div>

                <div className="p-6 bg-green-50 rounded-lg border border-green-200 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Image src="/icons/mesa.ico" alt="Mesa" width={32} height={32} />
              </div>
                    <div>
                      <p className="text-sm font-medium text-green-600 uppercase tracking-wide">Disponibles</p>
                      <p className="text-3xl font-bold text-green-700">{stats.availableTables}</p>
              </div>
            </div>
          </div>

                <div className="p-6 bg-red-50 rounded-lg border border-red-200 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-100 rounded-lg">
                      <Image src="/icons/mesa.ico" alt="Mesa" width={32} height={32} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-600 uppercase tracking-wide">Ocupadas</p>
                      <p className="text-3xl font-bold text-red-700">{stats.occupiedTables}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Sales and Stock */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-8">
              <Card className="p-6 bg-white border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">VENTAS HOY</h3>
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                    <DollarSign size={12} className="mr-1" />
                    Hoy
                  </Badge>
                </div>
                <p className="text-3xl font-bold text-blue-600">{formatCurrency(stats.todaySales)}</p>
              </Card>

              <Card className="p-6 bg-white border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">STOCK BAJO</h3>
                  {stats.lowStockProducts > 0 && (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                      <AlertTriangle size={12} className="mr-1" />
                      {stats.lowStockProducts}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold text-amber-600">{stats.lowStockProducts}</p>
                  <p className="text-sm text-gray-500">productos &lt; 10 unidades</p>
                </div>
              </Card>

              <Card className="p-6 bg-white border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">ALQUILERES</h3>
                  <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                    <TrendingUp size={12} className="mr-1" />
                    Activo
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold text-purple-600">{stats.activeRentals}</p>
                  <p className="text-sm text-gray-500">mesas en uso</p>
                </div>
              </Card>

              <Card className="p-6 bg-white border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">CLIENTES</h3>
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                    <Users size={12} className="mr-1" />
                    Total
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold text-green-600">{stats.totalClients}</p>
                  <p className="text-sm text-gray-500">registrados</p>
                </div>
              </Card>
          </div>

          {/* Quick Actions */}
            <Card className="p-6 bg-white border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package size={20} className="text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Accesos Rápidos</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/tables')}
                  className="h-auto flex-col gap-3 p-4 lg:p-6 hover:bg-gray-50 transition-all duration-200 border-2 border-gray-200 hover:border-blue-300"
                >
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Image src="/icons/mesa.ico" alt="Mesa" width={28} height={28} />
                  </div>
                  <span className="text-sm font-medium">Mesas</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/products')}
                  className="h-auto flex-col gap-3 p-4 lg:p-6 hover:bg-gray-50 transition-all duration-200 border-2 border-gray-200 hover:border-green-300"
                >
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Package size={28} className="text-green-600" />
                  </div>
                  <span className="text-sm font-medium">Productos</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/sales')}
                  className="h-auto flex-col gap-3 p-4 lg:p-6 hover:bg-gray-50 transition-all duration-200 border-2 border-gray-200 hover:border-purple-300"
                >
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <TrendingUp size={28} className="text-purple-600" />
                  </div>
                  <span className="text-sm font-medium">Ventas</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/workers')}
                  className="h-auto flex-col gap-3 p-4 lg:p-6 hover:bg-gray-50 transition-all duration-200 border-2 border-gray-200 hover:border-orange-300"
                >
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Users size={28} className="text-orange-600" />
                  </div>
                  <span className="text-sm font-medium">Empleados</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/clients')}
                  className="h-auto flex-col gap-3 p-4 lg:p-6 hover:bg-gray-50 transition-all duration-200 border-2 border-gray-200 hover:border-teal-300"
                >
                  <div className="p-3 bg-teal-100 rounded-lg">
                    <UserCheck size={28} className="text-teal-600" />
                  </div>
                  <span className="text-sm font-medium">Clientes</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/stats')}
                  className="h-auto flex-col gap-3 p-4 lg:p-6 hover:bg-gray-50 transition-all duration-200 border-2 border-gray-200 hover:border-indigo-300"
                >
                  <div className="p-3 bg-indigo-100 rounded-lg">
                    <BarChart3 size={28} className="text-indigo-600" />
                  </div>
                  <span className="text-sm font-medium">Estadísticas</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/settings')}
                  className="h-auto flex-col gap-3 p-4 lg:p-6 hover:bg-gray-50 transition-all duration-200 border-2 border-gray-200 hover:border-gray-400"
                >
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <Settings size={28} className="text-gray-600" />
                  </div>
                  <span className="text-sm font-medium">Configuración</span>
                </Button>
              </div>
          </Card>
        </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
