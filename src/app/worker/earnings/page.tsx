"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { TrendingUp, ShoppingCart, Clock, Calendar, Package, CreditCard, DollarSign, Activity, Eye, Users, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
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
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'sessions'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sales' | 'rentals'>('all');
  const [currentSession, setCurrentSession] = useState<{ 
    id: number; 
    session_name: string; 
    start_time: string; 
    is_active: boolean 
  } | null>(null);
  const [sessionStats, setSessionStats] = useState({
    sales_revenue: 0,
    rentals_revenue: 0,
    total_revenue: 0,
    products_sold: 0,
    rentals_completed: 0
  });
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);

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
    loadCurrentSession(parsedUser.tenant_id, parsedUser.id);
    loadPastSessions(parsedUser.tenant_id, parsedUser.id);
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

  const loadCurrentSession = async (tenantId: number, userId: number) => {
    try {
      // Cargar sesión activa
      const { data: sessionData, error: sessionError } = await supabase
        .from('daily_sessions')
        .select('id, session_name, start_time, is_active')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();

      if (sessionError) {
        if (!sessionError.message.includes('relation "daily_sessions" does not exist')) {
          console.error('Error cargando sesión:', sessionError);
        }
        return;
      }

      if (sessionData) {
        setCurrentSession(sessionData);
        
        // Cargar estadísticas de la sesión actual
        const sessionStart = new Date(sessionData.start_time);
        const now = new Date();

        // Ventas de la sesión
        const { data: sessionSales } = await supabase
          .from('sales')
          .select('total_amount, quantity')
          .eq('tenant_id', tenantId)
          .eq('worker_id', userId)
          .gte('created_at', sessionStart.toISOString())
          .lte('created_at', now.toISOString());

        // Rentas de la sesión
        const { data: sessionRentals } = await supabase
          .from('rentals')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .eq('user_id', userId)
          .gte('start_time', sessionStart.toISOString())
          .lte('start_time', now.toISOString())
          .not('end_time', 'is', null);

        const salesRevenue = sessionSales?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;
        const rentalsRevenue = sessionRentals?.reduce((sum, r) => sum + Number(r.total_amount), 0) || 0;
        const productsSold = sessionSales?.reduce((sum, s) => sum + Number(s.quantity), 0) || 0;

        setSessionStats({
          sales_revenue: salesRevenue,
          rentals_revenue: rentalsRevenue,
          total_revenue: salesRevenue + rentalsRevenue,
          products_sold: productsSold,
          rentals_completed: sessionRentals?.length || 0
        });
      }
    } catch (error) {
      console.error('Error en loadCurrentSession:', error);
    }
  };

  const loadPastSessions = async (tenantId: number, userId: number) => {
    try {
      const { data: sessions, error } = await supabase
        .from('daily_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('created_by', userId)
        .eq('is_active', false)
        .order('start_time', { ascending: false })
        .limit(20);

      if (error) {
        if (!error.message.includes('relation "daily_sessions" does not exist')) {
          console.error('Error cargando sesiones pasadas:', error);
        }
        return;
      }

      if (sessions) {
        // Para cada sesión, cargar estadísticas detalladas
        const sessionsWithStats = await Promise.all(
          sessions.map(async (session) => {
            const sessionStart = new Date(session.start_time);
            const sessionEnd = session.end_time ? new Date(session.end_time) : new Date();

            // Cargar ventas detalladas de la sesión
            const { data: sessionSales } = await supabase
              .from('sales')
              .select(`
                id,
                quantity,
                unit_price,
                total_amount,
                is_paid,
                created_at,
                products(name),
                clients(name)
              `)
              .eq('tenant_id', tenantId)
              .eq('worker_id', userId)
              .gte('created_at', sessionStart.toISOString())
              .lte('created_at', sessionEnd.toISOString())
              .order('created_at', { ascending: false });

            // Cargar rentas detalladas de la sesión
            const { data: sessionRentals } = await supabase
              .from('rentals')
              .select(`
                id,
                start_time,
                end_time,
                total_amount,
                is_paid,
                clients(name),
                tables(name)
              `)
              .eq('tenant_id', tenantId)
              .eq('user_id', userId)
              .gte('start_time', sessionStart.toISOString())
              .lte('start_time', sessionEnd.toISOString())
              .not('end_time', 'is', null)
              .order('start_time', { ascending: false });

            // Procesar ventas con detalles
            const salesDetails = sessionSales?.map(sale => ({
              id: sale.id,
              product_name: (sale.products as any)?.name || 'Producto N/A',
              quantity: Number(sale.quantity),
              unit_price: Number(sale.unit_price),
              total_amount: Number(sale.total_amount),
              is_paid: Boolean(sale.is_paid),
              created_at: sale.created_at,
              customer_name: (sale.clients as any)?.name || 'Cliente Anónimo'
            })) || [];

            // Procesar rentas con detalles
            const rentalsDetails = sessionRentals?.map(rental => ({
              id: rental.id,
              table_name: (rental.tables as any)?.name || 'Mesa N/A',
              start_time: rental.start_time,
              end_time: rental.end_time,
              total_amount: Number(rental.total_amount),
              is_paid: Boolean(rental.is_paid),
              customer_name: (rental.clients as any)?.name || 'Cliente Anónimo',
              duration: rental.end_time 
                ? Math.round((new Date(rental.end_time).getTime() - new Date(rental.start_time).getTime()) / (1000 * 60 * 60) * 10) / 10
                : 0
            })) || [];

            // Calcular estadísticas
            const salesRevenue = salesDetails.reduce((sum, s) => sum + s.total_amount, 0);
            const rentalsRevenue = rentalsDetails.reduce((sum, r) => sum + r.total_amount, 0);
            const paidSales = salesDetails.filter(s => s.is_paid);
            const unpaidSales = salesDetails.filter(s => !s.is_paid);

            return {
              ...session,
              stats: {
                sales_revenue: salesRevenue,
                rentals_revenue: rentalsRevenue,
                total_revenue: salesRevenue + rentalsRevenue,
                products_sold: salesDetails.reduce((sum, s) => sum + s.quantity, 0),
                rentals_completed: rentalsDetails.length,
                paid_sales_total: paidSales.reduce((sum, s) => sum + s.total_amount, 0),
                unpaid_sales_total: unpaidSales.reduce((sum, s) => sum + s.total_amount, 0),
                unpaid_sales_count: unpaidSales.length
              },
              sales_details: salesDetails,
              rentals_details: rentalsDetails
            };
          })
        );

        setPastSessions(sessionsWithStats);
      }
    } catch (error) {
      console.error('Error en loadPastSessions:', error);
    }
  };

  const handleFilterChange = (newFilter: 'all' | 'today' | 'week' | 'sessions') => {
    setFilter(newFilter);
    if (user && newFilter !== 'sessions') {
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
            {/* Sesión Actual */}
            {currentSession && (
              <Card className="mb-6 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                <CardHeader accent="emerald">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-green-900 flex items-center gap-2">
                      <Activity size={24} />
                      Sesión Actual: {currentSession.session_name}
                    </h2>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-700">Activa</span>
                    </div>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    Iniciada: {new Date(currentSession.start_time).toLocaleDateString('es-PE')} a las {' '}
                    {new Date(currentSession.start_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <ShoppingCart size={16} className="text-green-600" />
                        <span className="text-xs font-medium text-green-700">Ventas</span>
                      </div>
                      <div className="text-lg font-bold text-green-800">S/ {sessionStats.sales_revenue.toFixed(2)}</div>
                      <div className="text-xs text-green-600">{sessionStats.products_sold} productos</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={16} className="text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">Rentas</span>
                      </div>
                      <div className="text-lg font-bold text-blue-800">S/ {sessionStats.rentals_revenue.toFixed(2)}</div>
                      <div className="text-xs text-blue-600">{sessionStats.rentals_completed} mesas</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign size={16} className="text-purple-600" />
                        <span className="text-xs font-medium text-purple-700">Total</span>
                      </div>
                      <div className="text-lg font-bold text-purple-800">S/ {sessionStats.total_revenue.toFixed(2)}</div>
                      <div className="text-xs text-purple-600">Sesión completa</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-orange-200 flex flex-col justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFilter('today');
                          setTypeFilter('all');
                          if (user) loadData(user.tenant_id, user.id, 'today');
                        }}
                        className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
                      >
                        <Eye size={14} />
                        Ver Movimientos
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}

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
                <Button
                  variant={filter === 'sessions' ? 'default' : 'outline'}
                  onClick={() => handleFilterChange('sessions')}
                >
                  Sesiones
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

            {/* Lista de Ingresos o Sesiones */}
            <Card>
              <CardHeader accent="slate">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Package size={24} />
                  {filter === 'sessions' 
                    ? `Historial de Sesiones (${pastSessions.length})`
                    : `Historial de Ingresos (${combinedData.length})`
                  }
                </h2>
              </CardHeader>
              <CardBody className="p-0">
                {filter === 'sessions' ? (
                  pastSessions.length > 0 ? (
                    <div className="space-y-4 p-4">
                      {pastSessions.map((session) => (
                        <div key={session.id} className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg overflow-hidden">
                          <div className="p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <h3 className="font-bold text-lg text-blue-900">{session.session_name}</h3>
                                <p className="text-sm text-blue-700">
                                  📅 {new Date(session.start_time).toLocaleDateString('es-PE')} - 
                                  🕐 {new Date(session.start_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                                  {session.end_time && (
                                    <> hasta {new Date(session.end_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</>
                                  )}
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-green-600">
                                  S/ {session.stats.total_revenue.toFixed(2)}
                                </div>
                                <Badge variant="default" className="mt-1">
                                  Finalizada
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                              <div className="bg-white p-3 rounded border border-green-200">
                                <div className="flex items-center gap-1 mb-1">
                                  <ShoppingCart size={14} className="text-green-600" />
                                  <span className="text-xs font-bold text-green-700">Ventas</span>
                                </div>
                                <div className="text-lg font-bold text-green-800">S/ {session.stats.sales_revenue.toFixed(2)}</div>
                                <div className="text-xs text-green-600 font-semibold">{session.stats.products_sold} productos</div>
                              </div>
                              <div className="bg-white p-3 rounded border border-blue-200">
                                <div className="flex items-center gap-1 mb-1">
                                  <Clock size={14} className="text-blue-600" />
                                  <span className="text-xs font-bold text-blue-700">Rentas</span>
                                </div>
                                <div className="text-lg font-bold text-blue-800">S/ {session.stats.rentals_revenue.toFixed(2)}</div>
                                <div className="text-xs text-blue-600 font-semibold">{session.stats.rentals_completed} mesas</div>
                              </div>
                              <div className="bg-white p-3 rounded border border-purple-200">
                                <div className="flex items-center gap-1 mb-1">
                                  <CreditCard size={14} className="text-green-600" />
                                  <span className="text-xs font-bold text-green-700">Pagado</span>
                                </div>
                                <div className="text-lg font-bold text-green-800">S/ {session.stats.paid_sales_total.toFixed(2)}</div>
                                <div className="text-xs text-green-600 font-semibold">Efectivo recibido</div>
                              </div>
                              <div className="bg-white p-3 rounded border border-red-200">
                                <div className="flex items-center gap-1 mb-1">
                                  <AlertCircle size={14} className="text-red-600" />
                                  <span className="text-xs font-bold text-red-700">Fiado</span>
                                </div>
                                <div className="text-lg font-bold text-red-800">S/ {session.stats.unpaid_sales_total.toFixed(2)}</div>
                                <div className="text-xs text-red-600 font-semibold">{session.stats.unpaid_sales_count} pendientes</div>
                              </div>
                            </div>

                            {/* Botón para expandir detalles */}
                            <button
                              onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                              className="w-full bg-white hover:bg-blue-50 border border-blue-300 rounded-lg p-3 flex items-center justify-between transition-all duration-200 font-bold text-blue-700 hover:text-blue-800"
                            >
                              <span className="flex items-center gap-2">
                                <Eye size={16} />
                                Ver Detalles Completos
                              </span>
                              {expandedSession === session.id ? 
                                <ChevronUp size={20} /> : 
                                <ChevronDown size={20} />
                              }
                            </button>
                          </div>

                          {/* Detalles expandibles */}
                          {expandedSession === session.id && (
                            <div className="border-t border-blue-200 bg-white">
                              <div className="p-4 space-y-4">
                                {/* Ventas detalladas */}
                                {session.sales_details && session.sales_details.length > 0 && (
                                  <div>
                                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                                      <ShoppingCart size={18} className="text-green-600" />
                                      Productos Vendidos ({session.sales_details.length})
                                    </h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                      {session.sales_details.map((sale: any, index: number) => (
                                        <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                                          <div className="flex items-center gap-3 flex-1">
                                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                              {index + 1}
                                            </div>
                                            <div className="flex-1">
                                              <div className="font-bold text-gray-900">{sale.product_name}</div>
                                              <div className="text-sm text-gray-600 font-semibold">
                                                👤 {sale.customer_name} • 
                                                📦 {sale.quantity}x S/ {sale.unit_price.toFixed(2)} • 
                                                🕐 {new Date(sale.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className={`font-bold text-lg ${sale.is_paid ? 'text-green-600' : 'text-red-600'}`}>
                                              S/ {sale.total_amount.toFixed(2)}
                                            </div>
                                            <Badge variant={sale.is_paid ? 'success' : 'danger'} className="text-xs font-bold">
                                              {sale.is_paid ? '✅ Pagado' : '❌ Fiado'}
                                            </Badge>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Rentas detalladas */}
                                {session.rentals_details && session.rentals_details.length > 0 && (
                                  <div>
                                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                                      <Clock size={18} className="text-blue-600" />
                                      Mesas Rentadas ({session.rentals_details.length})
                                    </h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                      {session.rentals_details.map((rental: any, index: number) => (
                                        <div key={rental.id} className="flex items-center justify-between p-3 bg-blue-50 rounded border">
                                          <div className="flex items-center gap-3 flex-1">
                                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                              {index + 1}
                                            </div>
                                            <div className="flex-1">
                                              <div className="font-bold text-gray-900">{rental.table_name}</div>
                                              <div className="text-sm text-gray-600 font-semibold">
                                                👤 {rental.customer_name} • 
                                                ⏰ {rental.duration}h • 
                                                🕐 {new Date(rental.start_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} - {new Date(rental.end_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="font-bold text-lg text-blue-600">
                                              S/ {rental.total_amount.toFixed(2)}
                                            </div>
                                            <Badge variant={rental.is_paid ? 'success' : 'warning'} className="text-xs font-bold">
                                              {rental.is_paid ? '✅ Pagado' : '⏳ Pendiente'}
                                            </Badge>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Resumen final */}
                                <div className="border-t pt-4 bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded">
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                                    <div>
                                      <div className="text-lg font-bold text-green-600">S/ {session.stats.paid_sales_total.toFixed(2)}</div>
                                      <div className="text-xs text-green-700 font-bold">💰 Efectivo Recibido</div>
                                    </div>
                                    <div>
                                      <div className="text-lg font-bold text-red-600">S/ {session.stats.unpaid_sales_total.toFixed(2)}</div>
                                      <div className="text-xs text-red-700 font-bold">📋 Por Cobrar</div>
                                    </div>
                                    <div>
                                      <div className="text-lg font-bold text-purple-600">
                                        {(() => {
                                          if (!session.end_time) return 'Activa';
                                          const duration = new Date(session.end_time).getTime() - new Date(session.start_time).getTime();
                                          const hours = Math.floor(duration / (1000 * 60 * 60));
                                          const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
                                          return `${hours}h ${minutes}m`;
                                        })()}
                                      </div>
                                      <div className="text-xs text-purple-700 font-bold">⏱️ Duración Total</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Activity size={48} className="mx-auto text-gray-400 mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay sesiones</h3>
                      <p className="text-gray-600">
                        Las sesiones finalizadas aparecerán aquí
                      </p>
                    </div>
                  )
                ) : combinedData.length > 0 ? (
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
