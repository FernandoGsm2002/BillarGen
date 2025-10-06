"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { TenantConfig } from '@/types/database.types';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardHeader, CardBody, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { TrendingUp, DollarSign, ShoppingCart, Users, Package, Calendar, Download, FileText, FileSpreadsheet, Eye, BarChart3, Activity, TrendingDown, TrendingUpIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface WeeklyStats {
  week: string;
  sales_revenue: number;
  rentals_revenue: number;
  total_revenue: number;
  products_sold: number;
  rentals_completed: number;
  week_start: string;
  week_end: string;
}

interface DailyStats {
  date: string;
  sales_revenue: number;
  rentals_revenue: number;
  total_revenue: number;
  products_sold: number;
  rentals_completed: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
  image_url: string | null;
}

interface TopWorker {
  username: string;
  sales_count: number;
  revenue: number;
}

// Interface removida - no se usa actualmente

interface ComprehensiveStats {
  // Totales generales
  total_all_time_revenue: number;
  total_all_time_sales: number;
  total_all_time_products_sold: number;
  total_all_time_rentals: number;
  
  // Esta semana vs semana anterior
  current_week: WeeklyStats;
  previous_week: WeeklyStats;
  
  // Últimos 7 días
  daily_stats: DailyStats[];
  
  // Top productos y trabajadores
  top_products: TopProduct[];
  top_workers: TopWorker[];
  
  // Estadísticas de este mes
  current_month_revenue: number;
  current_month_sales: number;
  previous_month_revenue: number;
  previous_month_sales: number;
}

export default function StatsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [stats, setStats] = useState<ComprehensiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  // const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week'); // Para uso futuro
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

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
    loadTenantConfig(parsedUser.tenant_id);
    loadComprehensiveStats(parsedUser.tenant_id);
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

  const loadComprehensiveStats = async (tenantId: number) => {
    setLoading(true);
    try {
      // Fechas de referencia
      const now = new Date();
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(now.getDate() - now.getDay()); // Domingo
      currentWeekStart.setHours(0, 0, 0, 0);
      
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
      currentWeekEnd.setHours(23, 59, 59, 999);
      
      const previousWeekStart = new Date(currentWeekStart);
      previousWeekStart.setDate(currentWeekStart.getDate() - 7);
      
      const previousWeekEnd = new Date(currentWeekEnd);
      previousWeekEnd.setDate(currentWeekEnd.getDate() - 7);

      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Obtener datos de ventas y rentas
      const [
        salesData,
        rentalsData,
        topProductsData,
        topWorkersData
      ] = await Promise.all([
        // Ventas
        supabase
          .from('sales')
          .select('total_amount, quantity, created_at, products(name, image_url), users(username)')
          .eq('tenant_id', tenantId),
        
        // Rentas
        supabase
          .from('rentals')
          .select('total_amount, start_time, end_time')
          .eq('tenant_id', tenantId)
          .not('end_time', 'is', null),
        
        // Top productos
        supabase
          .from('sales')
          .select('quantity, total_amount, products(name, image_url)')
          .eq('tenant_id', tenantId)
          .gte('created_at', currentWeekStart.toISOString()),
        
        // Top workers
        supabase
          .from('sales')
          .select('total_amount, users(username)')
          .eq('tenant_id', tenantId)
          .gte('created_at', currentWeekStart.toISOString())
      ]);

      if (salesData.error || rentalsData.error) {
        throw new Error('Error cargando datos');
      }

      // Procesar estadísticas de la semana actual
      const currentWeekSales = salesData.data?.filter(sale => 
        new Date(sale.created_at) >= currentWeekStart && new Date(sale.created_at) <= currentWeekEnd
      ) || [];
      
      const currentWeekRentals = rentalsData.data?.filter(rental => 
        new Date(rental.start_time) >= currentWeekStart && new Date(rental.start_time) <= currentWeekEnd
      ) || [];

      // Procesar estadísticas de la semana anterior
      const previousWeekSales = salesData.data?.filter(sale => 
        new Date(sale.created_at) >= previousWeekStart && new Date(sale.created_at) <= previousWeekEnd
      ) || [];
      
      const previousWeekRentals = rentalsData.data?.filter(rental => 
        new Date(rental.start_time) >= previousWeekStart && new Date(rental.start_time) <= previousWeekEnd
      ) || [];

      // Generar estadísticas diarias para los últimos 7 días
      const dailyStats: DailyStats[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);

        const daySales = salesData.data?.filter(sale => 
          new Date(sale.created_at) >= date && new Date(sale.created_at) < nextDate
        ) || [];
        
        const dayRentals = rentalsData.data?.filter(rental => 
          new Date(rental.start_time) >= date && new Date(rental.start_time) < nextDate
        ) || [];

        dailyStats.push({
          date: date.toISOString().split('T')[0],
          sales_revenue: daySales.reduce((sum, s) => sum + Number(s.total_amount), 0),
          rentals_revenue: dayRentals.reduce((sum, r) => sum + Number(r.total_amount), 0),
          total_revenue: daySales.reduce((sum, s) => sum + Number(s.total_amount), 0) + 
                        dayRentals.reduce((sum, r) => sum + Number(r.total_amount), 0),
          products_sold: daySales.reduce((sum, s) => sum + Number(s.quantity), 0),
          rentals_completed: dayRentals.length
        });
      }

      // Procesar top productos
      const productStats = new Map();
      topProductsData.data?.forEach(sale => {
        if (sale.products) {
          // Manejar tanto objeto como array
          const product = Array.isArray(sale.products) ? sale.products[0] : sale.products;
          if (product && product.name) {
            const key = product.name;
            if (!productStats.has(key)) {
              productStats.set(key, {
                name: product.name,
                quantity: 0,
                revenue: 0,
                image_url: product.image_url
              });
            }
            const productStat = productStats.get(key);
            productStat.quantity += Number(sale.quantity);
            productStat.revenue += Number(sale.total_amount);
          }
        }
      });

      const topProducts = Array.from(productStats.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Procesar top workers
      const workerStats = new Map();
      topWorkersData.data?.forEach(sale => {
        if (sale.users) {
          // Manejar tanto objeto como array
          const user = Array.isArray(sale.users) ? sale.users[0] : sale.users;
          if (user && user.username) {
            const key = user.username;
            if (!workerStats.has(key)) {
              workerStats.set(key, {
                username: user.username,
                sales_count: 0,
                revenue: 0
              });
            }
            const worker = workerStats.get(key);
            worker.sales_count += 1;
            worker.revenue += Number(sale.total_amount);
          }
        }
      });

      const topWorkers = Array.from(workerStats.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Estadísticas del mes actual vs anterior
      const currentMonthSales = salesData.data?.filter(sale => 
        new Date(sale.created_at) >= currentMonthStart
      ) || [];
      
      const currentMonthRentals = rentalsData.data?.filter(rental => 
        new Date(rental.start_time) >= currentMonthStart
      ) || [];

      const previousMonthSales = salesData.data?.filter(sale => 
        new Date(sale.created_at) >= previousMonthStart && new Date(sale.created_at) <= previousMonthEnd
      ) || [];
      
      const previousMonthRentals = rentalsData.data?.filter(rental => 
        new Date(rental.start_time) >= previousMonthStart && new Date(rental.start_time) <= previousMonthEnd
      ) || [];

      const comprehensiveStats: ComprehensiveStats = {
        total_all_time_revenue: 
          (salesData.data?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0) +
          (rentalsData.data?.reduce((sum, r) => sum + Number(r.total_amount), 0) || 0),
        total_all_time_sales: salesData.data?.length || 0,
        total_all_time_products_sold: salesData.data?.reduce((sum, s) => sum + Number(s.quantity), 0) || 0,
        total_all_time_rentals: rentalsData.data?.length || 0,
        
        current_week: {
          week: `${currentWeekStart.toLocaleDateString('es-PE')} - ${currentWeekEnd.toLocaleDateString('es-PE')}`,
          sales_revenue: currentWeekSales.reduce((sum, s) => sum + Number(s.total_amount), 0),
          rentals_revenue: currentWeekRentals.reduce((sum, r) => sum + Number(r.total_amount), 0),
          total_revenue: 
            currentWeekSales.reduce((sum, s) => sum + Number(s.total_amount), 0) +
            currentWeekRentals.reduce((sum, r) => sum + Number(r.total_amount), 0),
          products_sold: currentWeekSales.reduce((sum, s) => sum + Number(s.quantity), 0),
          rentals_completed: currentWeekRentals.length,
          week_start: currentWeekStart.toISOString(),
          week_end: currentWeekEnd.toISOString()
        },
        
        previous_week: {
          week: `${previousWeekStart.toLocaleDateString('es-PE')} - ${previousWeekEnd.toLocaleDateString('es-PE')}`,
          sales_revenue: previousWeekSales.reduce((sum, s) => sum + Number(s.total_amount), 0),
          rentals_revenue: previousWeekRentals.reduce((sum, r) => sum + Number(r.total_amount), 0),
          total_revenue: 
            previousWeekSales.reduce((sum, s) => sum + Number(s.total_amount), 0) +
            previousWeekRentals.reduce((sum, r) => sum + Number(r.total_amount), 0),
          products_sold: previousWeekSales.reduce((sum, s) => sum + Number(s.quantity), 0),
          rentals_completed: previousWeekRentals.length,
          week_start: previousWeekStart.toISOString(),
          week_end: previousWeekEnd.toISOString()
        },
        
        daily_stats: dailyStats,
        top_products: topProducts,
        top_workers: topWorkers,
        
        current_month_revenue: 
          currentMonthSales.reduce((sum, s) => sum + Number(s.total_amount), 0) +
          currentMonthRentals.reduce((sum, r) => sum + Number(r.total_amount), 0),
        current_month_sales: currentMonthSales.length,
        
        previous_month_revenue: 
          previousMonthSales.reduce((sum, s) => sum + Number(s.total_amount), 0) +
          previousMonthRentals.reduce((sum, r) => sum + Number(r.total_amount), 0),
        previous_month_sales: previousMonthSales.length
      };

      setStats(comprehensiveStats);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
      alert('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentageChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const handleExportToPDF = async () => {
    if (!stats) return;
    
    setExporting(true);
    try {
      const { exportToPDF } = await import('@/lib/exportUtils');
      await exportToPDF(stats, tenantConfig);
      
      const businessName = tenantConfig?.business_name || 'Mi Negocio';
      alert(`✅ Reporte PDF descargado exitosamente para ${businessName}`);
    } catch (error) {
      console.error('Error exportando PDF:', error);
      alert('❌ Error al generar reporte PDF. Verifica que el navegador permita descargas.');
    } finally {
      setExporting(false);
      setShowExportModal(false);
    }
  };

  const handleExportToExcel = async () => {
    if (!stats) return;
    
    setExporting(true);
    try {
      const { exportToExcel } = await import('@/lib/exportUtils');
      await exportToExcel(stats, tenantConfig);
      
      const businessName = tenantConfig?.business_name || 'Mi Negocio';
      alert(`✅ Reporte Excel descargado exitosamente para ${businessName}`);
    } catch (error) {
      console.error('Error exportando Excel:', error);
      alert('❌ Error al generar reporte Excel. Verifica que el navegador permita descargas.');
    } finally {
      setExporting(false);
      setShowExportModal(false);
    }
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  if (loading) {
    return (
      <SidebarProvider>
        <div className="flex h-screen bg-background">
          <Sidebar role={user.role as 'admin' | 'worker' | 'super_admin'} username={user.username} />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Activity size={64} className="mx-auto mb-4 text-primary animate-spin" />
              <h2 className="text-2xl font-bold mb-2">Cargando Estadísticas</h2>
              <p className="text-muted-foreground">Analizando datos de tu negocio...</p>
            </div>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  if (!stats) {
    return (
      <SidebarProvider>
        <div className="flex h-screen bg-background">
          <Sidebar role={user.role as 'admin' | 'worker' | 'super_admin'} username={user.username} />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <TrendingDown size={64} className="mx-auto mb-4 text-gray-400" />
              <h2 className="text-2xl font-bold mb-2">Sin Datos</h2>
              <p className="text-muted-foreground">No hay datos suficientes para mostrar estadísticas</p>
            </div>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  const weeklyRevenueChange = calculatePercentageChange(stats.current_week.total_revenue, stats.previous_week.total_revenue);
  const weeklySalesChange = calculatePercentageChange(stats.current_week.products_sold, stats.previous_week.products_sold);
  const monthlyRevenueChange = calculatePercentageChange(stats.current_month_revenue, stats.previous_month_revenue);

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        <Sidebar role={user.role as 'admin' | 'worker' | 'super_admin'} username={user.username} />
        
        <div className="flex-1 overflow-auto">
          {/* Header */}
          <div className="bg-card border-b">
            <div className="px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <SidebarTrigger className="md:hidden" />
                  <div className="p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl text-white">
                    <BarChart3 size={32} />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">Estadísticas</h1>
                    <p className="text-base text-muted-foreground mt-1">Análisis completo de tu negocio</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowExportModal(true)}
                    className="gap-2"
                  >
                    <Download size={20} />
                    Exportar
                  </Button>
                  <Button
                    onClick={() => loadComprehensiveStats(user.tenant_id)}
                    className="gap-2"
                  >
                    <Activity size={20} />
                    Actualizar
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 lg:p-8">
            {/* Resumen General */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Ingresos Totales"
                value={`S/ ${stats.total_all_time_revenue.toFixed(2)}`}
                accent="emerald"
                icon={<DollarSign size={40} />}
              />
              <StatCard
                title="Ventas Totales"
                value={stats.total_all_time_sales}
                accent="blue"
                icon={<ShoppingCart size={40} />}
              />
              <StatCard
                title="Productos Vendidos"
                value={stats.total_all_time_products_sold}
                accent="blue"
                icon={<Package size={40} />}
              />
              <StatCard
                title="Mesas Rentadas"
                value={stats.total_all_time_rentals}
                accent="amber"
                icon={<Calendar size={40} />}
              />
            </div>

            {/* Comparativo Semanal */}
            <Card className="mb-8">
              <CardHeader>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  📊 Comparativo Semanal
                </h2>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Semana Actual */}
                  <div className="bg-gradient-to-br from-green-50 to-blue-50 p-6 rounded-lg border border-green-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      📅 Semana Actual ({stats.current_week.week})
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ingresos por Ventas:</span>
                        <span className="font-bold text-green-600">S/ {stats.current_week.sales_revenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ingresos por Rentas:</span>
                        <span className="font-bold text-blue-600">S/ {stats.current_week.rentals_revenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-gray-900 font-semibold">Total:</span>
                        <span className="font-bold text-purple-600 text-xl">S/ {stats.current_week.total_revenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Productos Vendidos:</span>
                        <span className="font-bold">{stats.current_week.products_sold}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mesas Rentadas:</span>
                        <span className="font-bold">{stats.current_week.rentals_completed}</span>
                      </div>
                    </div>
                  </div>

                  {/* Semana Anterior */}
                  <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-6 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      📅 Semana Anterior ({stats.previous_week.week})
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ingresos por Ventas:</span>
                        <span className="font-bold text-gray-700">S/ {stats.previous_week.sales_revenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ingresos por Rentas:</span>
                        <span className="font-bold text-gray-700">S/ {stats.previous_week.rentals_revenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-gray-900 font-semibold">Total:</span>
                        <span className="font-bold text-gray-700 text-xl">S/ {stats.previous_week.total_revenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Productos Vendidos:</span>
                        <span className="font-bold text-gray-700">{stats.previous_week.products_sold}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mesas Rentadas:</span>
                        <span className="font-bold text-gray-700">{stats.previous_week.rentals_completed}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Indicadores de Cambio */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className={`p-4 rounded-lg text-center ${weeklyRevenueChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {weeklyRevenueChange >= 0 ? <TrendingUpIcon size={20} /> : <TrendingDown size={20} />}
                      <span className="font-bold">{weeklyRevenueChange.toFixed(1)}%</span>
                    </div>
                    <p className="text-sm font-medium">Cambio en Ingresos</p>
                  </div>
                  
                  <div className={`p-4 rounded-lg text-center ${weeklySalesChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {weeklySalesChange >= 0 ? <TrendingUpIcon size={20} /> : <TrendingDown size={20} />}
                      <span className="font-bold">{weeklySalesChange.toFixed(1)}%</span>
                    </div>
                    <p className="text-sm font-medium">Cambio en Ventas</p>
                  </div>
                  
                  <div className={`p-4 rounded-lg text-center ${monthlyRevenueChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {monthlyRevenueChange >= 0 ? <TrendingUpIcon size={20} /> : <TrendingDown size={20} />}
                      <span className="font-bold">{monthlyRevenueChange.toFixed(1)}%</span>
                    </div>
                    <p className="text-sm font-medium">Cambio Mensual</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Gráfico de Tendencia Diaria */}
            <Card className="mb-8">
              <CardHeader>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  📈 Tendencia Diaria (Últimos 7 días)
                </h2>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {stats.daily_stats.map((day, index) => (
                    <div key={day.date} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-medium text-gray-600 w-24">
                          {new Date(day.date).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        </div>
                        <div className="w-48 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                            style={{ 
                              width: `${Math.max(5, (day.total_revenue / Math.max(...stats.daily_stats.map(d => d.total_revenue))) * 100)}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">S/ {day.total_revenue.toFixed(2)}</div>
                        <div className="text-sm text-gray-600">{day.products_sold} productos</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {/* Top Productos y Trabajadores */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Productos */}
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    🏆 Top Productos (Esta Semana)
                  </h2>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    {stats.top_products.length > 0 ? stats.top_products.map((product, idx) => (
                      <div key={product.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-semibold">{product.name}</p>
                            <p className="text-sm text-gray-600">{product.quantity} unidades</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">S/ {product.revenue.toFixed(2)}</div>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8 text-gray-500">
                        <Package size={48} className="mx-auto mb-2 opacity-30" />
                        <p>No hay datos de productos esta semana</p>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>

              {/* Top Trabajadores */}
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    👥 Top Trabajadores (Esta Semana)
                  </h2>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    {stats.top_workers.length > 0 ? stats.top_workers.map((worker, idx) => (
                      <div key={worker.username} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-semibold">{worker.username}</p>
                            <p className="text-sm text-gray-600">{worker.sales_count} ventas</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-blue-600">S/ {worker.revenue.toFixed(2)}</div>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8 text-gray-500">
                        <Users size={48} className="mx-auto mb-2 opacity-30" />
                        <p>No hay datos de trabajadores esta semana</p>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>

        {/* Modal de Exportación */}
        <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download size={24} />
                Exportar Reporte
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Genera un reporte profesional con los datos de tu negocio:
              </div>
              
              {tenantConfig && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-semibold text-blue-900">{tenantConfig.business_name}</p>
                  {tenantConfig.ruc && (
                    <p className="text-sm text-blue-700">RUC: {tenantConfig.ruc}</p>
                  )}
                  <p className="text-xs text-blue-600 mt-1">
                    Fecha: {new Date().toLocaleDateString('es-PE')}
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleExportToPDF}
                  disabled={exporting}
                  className="h-auto flex-col gap-2 p-4"
                  variant="outline"
                >
                  <FileText size={32} />
                  <span>PDF</span>
                </Button>
                <Button
                  onClick={handleExportToExcel}
                  disabled={exporting}
                  className="h-auto flex-col gap-2 p-4"
                  variant="outline"
                >
                  <FileSpreadsheet size={32} />
                  <span>Excel</span>
                </Button>
              </div>
              
              {exporting && (
                <div className="text-center py-4">
                  <Activity size={32} className="mx-auto mb-2 animate-spin text-primary" />
                  <p className="text-sm text-gray-600">Generando reporte...</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowExportModal(false)}
                disabled={exporting}
              >
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarProvider>
  );
}