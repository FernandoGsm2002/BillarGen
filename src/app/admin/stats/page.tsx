"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { TrendingUp, DollarSign, ShoppingCart, Clock, Users, Package, Calendar, Activity, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Stats24h {
  totalSales: number;
  totalAmount: number;
  totalProducts: number;
  totalRentals: number;
  topProducts: Array<{ name: string; quantity: number; total: number }>;
  topWorkers: Array<{ username: string; sales: number; total: number }>;
  hourlyData: Array<{ hour: number; sales: number; amount: number }>;
}

interface SessionData {
  id: number;
  session_name: string;
  start_time: string;
  end_time: string | null;
  is_active: boolean;
  total_sales_revenue: number;
  total_rentals_revenue: number;
  total_revenue: number;
  products_sold: number;
  rentals_completed: number;
  duration: string;
}

interface SessionDetail {
  session: SessionData;
  sales: Array<{
    id: number;
    quantity: number;
    total_amount: number;
    created_at: string;
    products: { name: string } | null;
    clients: { name: string } | null;
    users: { username: string } | null;
  }>;
  rentals: Array<{
    id: number;
    total_amount: number;
    start_time: string;
    end_time: string;
    clients: { name: string } | null;
    tables: { name: string } | null;
  }>;
  stockReport: Array<{
    product_name: string;
    initial_stock: number;
    final_stock: number;
    sold_quantity: number;
    difference: number;
  }>;
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
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [showSessionDetail, setShowSessionDetail] = useState(false);

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
    loadSessions(parsedUser.tenant_id);
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

  const loadSessions = async (tenantId: number) => {
    try {
      // Obtener sesiones de los últimos 30 días
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);

      const { data: sessionsData } = await supabase
        .from('daily_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('start_time', last30Days.toISOString())
        .order('start_time', { ascending: false });

      if (sessionsData) {
        // Calcular datos financieros para cada sesión
        const sessionsWithFinancials = await Promise.all(
          sessionsData.map(async (session) => {
            const sessionEndTime = session.end_time || new Date().toISOString();

            // Obtener ventas de la sesión
            const { data: salesData } = await supabase
              .from('sales')
              .select('total_amount, quantity')
              .eq('tenant_id', tenantId)
              .gte('created_at', session.start_time)
              .lt('created_at', sessionEndTime);

            // Obtener rentas de la sesión
            const { data: rentalsData } = await supabase
              .from('rentals')
              .select('total_amount')
              .eq('tenant_id', tenantId)
              .gte('start_time', session.start_time)
              .not('end_time', 'is', null)
              .lte('end_time', sessionEndTime);

            const total_sales_revenue = salesData?.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0) || 0;
            const total_rentals_revenue = rentalsData?.reduce((sum, rental) => sum + Number(rental.total_amount || 0), 0) || 0;
            const total_revenue = total_sales_revenue + total_rentals_revenue;
            const products_sold = salesData?.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0) || 0;
            const rentals_completed = rentalsData?.length || 0;

            // Calcular duración
            const startTime = new Date(session.start_time);
            const endTime = new Date(sessionEndTime);
            const durationMs = endTime.getTime() - startTime.getTime();
            const hours = Math.floor(durationMs / (1000 * 60 * 60));
            const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
            const duration = `${hours}h ${minutes}m`;

            return {
              ...session,
              total_sales_revenue,
              total_rentals_revenue,
              total_revenue,
              products_sold,
              rentals_completed,
              duration
            };
          })
        );

        setSessions(sessionsWithFinancials);
      }
    } catch (error) {
      console.error('Error cargando sesiones:', error);
    }
  };

  const loadSessionDetail = async (session: SessionData) => {
    try {
      const sessionEndTime = session.end_time || new Date().toISOString();

      // Obtener ventas detalladas de la sesión
      const { data: salesData } = await supabase
        .from('sales')
        .select(`
          id,
          quantity,
          total_amount,
          created_at,
          products(name),
          clients(name),
          users(username)
        `)
        .eq('tenant_id', user?.tenant_id)
        .gte('created_at', session.start_time)
        .lt('created_at', sessionEndTime);

      // Obtener rentas detalladas de la sesión
      const { data: rentalsData } = await supabase
        .from('rentals')
        .select(`
          id,
          total_amount,
          start_time,
          end_time,
          clients(name),
          tables(name)
        `)
        .eq('tenant_id', user?.tenant_id)
        .gte('start_time', session.start_time)
        .not('end_time', 'is', null)
        .lte('end_time', sessionEndTime);

      // Obtener snapshots de stock para la sesión
      const { data: stockSnapshots } = await supabase
        .from('daily_stock_snapshots')
        .select(`
          initial_stock,
          final_stock,
          products(name)
        `)
        .eq('tenant_id', user?.tenant_id)
        .eq('session_id', session.id);

      // Calcular ventas por producto durante la sesión
      const productSales = new Map();
      (salesData || []).forEach(sale => {
        const products = Array.isArray(sale.products) ? sale.products[0] : sale.products;
        const productName = products?.name || 'Producto N/A';
        if (!productSales.has(productName)) {
          productSales.set(productName, 0);
        }
        productSales.set(productName, productSales.get(productName) + sale.quantity);
      });

      // Crear reporte de stock
      const stockReport = (stockSnapshots || []).map(snapshot => {
        const products = Array.isArray(snapshot.products) ? snapshot.products[0] : snapshot.products;
        const productName = products?.name || 'Producto N/A';
        const soldQuantity = productSales.get(productName) || 0;
        const initialStock = snapshot.initial_stock || 0;
        const finalStock = snapshot.final_stock || 0;
        const difference = initialStock - finalStock;
        
        return {
          product_name: productName,
          initial_stock: initialStock,
          final_stock: finalStock,
          sold_quantity: soldQuantity,
          difference: difference
        };
      });

      const sessionDetail: SessionDetail = {
        session,
        sales: (salesData || []).map(sale => ({
          ...sale,
          products: Array.isArray(sale.products) ? sale.products[0] : sale.products,
          clients: Array.isArray(sale.clients) ? sale.clients[0] : sale.clients,
          users: Array.isArray(sale.users) ? sale.users[0] : sale.users
        })),
        rentals: (rentalsData || []).map(rental => ({
          ...rental,
          clients: Array.isArray(rental.clients) ? rental.clients[0] : rental.clients,
          tables: Array.isArray(rental.tables) ? rental.tables[0] : rental.tables
        })),
        stockReport: stockReport
      };

      setSelectedSession(sessionDetail);
      setShowSessionDetail(true);
    } catch (error) {
      console.error('Error cargando detalle de sesión:', error);
      alert('Error al cargar los detalles de la sesión');
    }
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
            <div className="flex items-center gap-4">
              <SidebarTrigger className="md:hidden" />
              <h1 className="text-3xl font-bold">📊 Estadísticas</h1>
            </div>
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

              {/* Historial de Sesiones */}
              <Card className="mt-8">
                <CardHeader accent="emerald">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Activity size={24} className="text-green-600" />
                    Historial de Sesiones (Últimos 30 días)
                  </h2>
                </CardHeader>
                <CardBody>
                  {sessions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <div className="min-w-full">
                        <div className="grid grid-cols-1 gap-4 md:hidden">
                          {/* Vista móvil - Cards */}
                          {sessions.map((session) => (
                            <div key={session.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-900">{session.session_name}</h3>
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  session.is_active 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {session.is_active ? 'Activa' : 'Finalizada'}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-gray-600">Inicio:</span>
                                  <p className="font-medium">{new Date(session.start_time).toLocaleString('es-PE')}</p>
                                </div>
                                <div>
                                  <span className="text-gray-600">Duración:</span>
                                  <p className="font-medium">{session.duration}</p>
                                </div>
                                <div>
                                  <span className="text-gray-600">Ingresos:</span>
                                  <p className="font-bold text-green-600">S/ {session.total_revenue.toFixed(2)}</p>
                                </div>
                                <div>
                                  <span className="text-gray-600">Productos:</span>
                                  <p className="font-medium">{session.products_sold}</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => loadSessionDetail(session)}
                                className="flex items-center gap-1 w-full mt-3"
                              >
                                <Eye size={14} />
                                Ver Detalle
                              </Button>
                            </div>
                          ))}
                        </div>

                        {/* Vista desktop - Tabla */}
                        <div className="hidden md:block">
                          <table className="min-w-full">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Sesión</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Fecha/Hora</th>
                                <th className="text-center py-3 px-4 font-semibold text-gray-700">Duración</th>
                                <th className="text-center py-3 px-4 font-semibold text-gray-700">Ventas</th>
                                <th className="text-center py-3 px-4 font-semibold text-gray-700">Rentas</th>
                                <th className="text-center py-3 px-4 font-semibold text-gray-700">Total</th>
                                <th className="text-center py-3 px-4 font-semibold text-gray-700">Productos</th>
                                <th className="text-center py-3 px-4 font-semibold text-gray-700">Estado</th>
                                <th className="text-center py-3 px-4 font-semibold text-gray-700">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {sessions.map((session) => (
                                <tr key={session.id} className="hover:bg-gray-50">
                                  <td className="py-3 px-4">
                                    <div className="font-medium text-gray-900">{session.session_name}</div>
                                  </td>
                                  <td className="py-3 px-4 text-sm text-gray-600">
                                    {new Date(session.start_time).toLocaleString('es-PE')}
                                  </td>
                                  <td className="py-3 px-4 text-center text-sm font-medium">
                                    {session.duration}
                                  </td>
                                  <td className="py-3 px-4 text-center font-semibold text-green-600">
                                    S/ {session.total_sales_revenue.toFixed(2)}
                                  </td>
                                  <td className="py-3 px-4 text-center font-semibold text-blue-600">
                                    S/ {session.total_rentals_revenue.toFixed(2)}
                                  </td>
                                  <td className="py-3 px-4 text-center font-bold text-purple-600">
                                    S/ {session.total_revenue.toFixed(2)}
                                  </td>
                                  <td className="py-3 px-4 text-center font-medium">
                                    {session.products_sold}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                      session.is_active 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {session.is_active ? 'Activa' : 'Finalizada'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => loadSessionDetail(session)}
                                      className="flex items-center gap-1"
                                    >
                                      <Eye size={14} />
                                      Ver Detalle
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay sesiones registradas</h3>
                      <p className="text-gray-600">Las sesiones aparecerán aquí cuando comiences a usar el sistema de control de sesiones en Productos.</p>
                    </div>
                  )}
                </CardBody>
              </Card>
            </>
          )}
        </div>
      </div>
      </div>

      {/* Modal Detalle de Sesión */}
      <Dialog open={showSessionDetail} onOpenChange={setShowSessionDetail}>
        <DialogContent className="!max-w-6xl max-h-[90vh] overflow-hidden flex flex-col mx-2 sm:mx-4 md:mx-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Activity size={24} />
              Detalle de Sesión: {selectedSession?.session.session_name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedSession && (
            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              {/* Resumen de la Sesión */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Duración</p>
                    <p className="text-lg font-bold text-blue-600">{selectedSession.session.duration}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Ingresos Totales</p>
                    <p className="text-lg font-bold text-green-600">S/ {selectedSession.session.total_revenue.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Productos Vendidos</p>
                    <p className="text-lg font-bold text-purple-600">{selectedSession.session.products_sold}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Mesas Rentadas</p>
                    <p className="text-lg font-bold text-orange-600">{selectedSession.session.rentals_completed}</p>
                  </div>
                </div>
              </div>

              {/* Reporte de Stock */}
              {selectedSession.stockReport.length > 0 && (
                <div className="bg-white border rounded-lg mb-6">
                  <div className="p-4 border-b bg-purple-50">
                    <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2">
                      <Package size={20} />
                      Reporte de Stock ({selectedSession.stockReport.length} productos)
                    </h3>
                    <p className="text-sm text-purple-600">Stock inicial vs final de la sesión</p>
                  </div>
                  <div className="overflow-x-auto">
                    {/* Vista móvil - Cards */}
                    <div className="md:hidden divide-y">
                      {selectedSession.stockReport.map((item, index) => (
                        <div key={index} className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-gray-900">{item.product_name}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              item.difference === item.sold_quantity 
                                ? 'bg-green-100 text-green-800' 
                                : item.difference > item.sold_quantity
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {item.difference === item.sold_quantity ? 'Correcto' : 'Diferencia'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-600">Stock Inicial:</span>
                              <p className="font-bold text-blue-600">{item.initial_stock}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Stock Final:</span>
                              <p className="font-bold text-purple-600">{item.final_stock}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Vendido:</span>
                              <p className="font-bold text-green-600">{item.sold_quantity}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Diferencia:</span>
                              <p className={`font-bold ${
                                item.difference === item.sold_quantity 
                                  ? 'text-green-600' 
                                  : 'text-red-600'
                              }`}>
                                {item.difference}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Vista desktop - Tabla */}
                    <div className="hidden md:block">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Producto</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-600">Stock Inicial</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-600">Stock Final</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-600">Vendido</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-600">Diferencia</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-600">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedSession.stockReport.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{item.product_name}</td>
                              <td className="px-4 py-3 text-center font-bold text-blue-600">{item.initial_stock}</td>
                              <td className="px-4 py-3 text-center font-bold text-purple-600">{item.final_stock}</td>
                              <td className="px-4 py-3 text-center font-bold text-green-600">{item.sold_quantity}</td>
                              <td className={`px-4 py-3 text-center font-bold ${
                                item.difference === item.sold_quantity ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {item.difference}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  item.difference === item.sold_quantity 
                                    ? 'bg-green-100 text-green-800' 
                                    : item.difference > item.sold_quantity
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {item.difference === item.sold_quantity ? 'Correcto' : 
                                   item.difference > item.sold_quantity ? 'Faltante' : 'Sobrante'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Ventas Detalladas */}
                <div className="bg-white border rounded-lg">
                  <div className="p-4 border-b bg-green-50">
                    <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
                      <ShoppingCart size={20} />
                      Ventas de Productos ({selectedSession.sales.length})
                    </h3>
                    <p className="text-sm text-green-600">Total: S/ {selectedSession.session.total_sales_revenue.toFixed(2)}</p>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {selectedSession.sales.length > 0 ? (
                      <div className="divide-y">
                        {selectedSession.sales.map((sale) => (
                          <div key={sale.id} className="p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-semibold text-gray-900">{sale.products?.name || 'Producto N/A'}</p>
                                <p className="text-sm text-gray-600">Cantidad: {sale.quantity}</p>
                              </div>
                              <p className="font-bold text-green-600">S/ {Number(sale.total_amount).toFixed(2)}</p>
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                              <p>Cliente: {sale.clients?.name || 'Cliente Anónimo'}</p>
                              <p>Vendedor: {sale.users?.username || 'N/A'}</p>
                              <p>Fecha: {new Date(sale.created_at).toLocaleString('es-PE')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        <ShoppingCart size={48} className="mx-auto mb-4 text-gray-300" />
                        <p>No hay ventas registradas en esta sesión</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rentas Detalladas */}
                <div className="bg-white border rounded-lg">
                  <div className="p-4 border-b bg-blue-50">
                    <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2">
                      <Clock size={20} />
                      Rentas de Mesas ({selectedSession.rentals.length})
                    </h3>
                    <p className="text-sm text-blue-600">Total: S/ {selectedSession.session.total_rentals_revenue.toFixed(2)}</p>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {selectedSession.rentals.length > 0 ? (
                      <div className="divide-y">
                        {selectedSession.rentals.map((rental) => (
                          <div key={rental.id} className="p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-semibold text-gray-900">{rental.tables?.name || 'Mesa N/A'}</p>
                                <p className="text-sm text-gray-600">
                                  Duración: {(() => {
                                    const start = new Date(rental.start_time);
                                    const end = new Date(rental.end_time);
                                    const diffMs = end.getTime() - start.getTime();
                                    const hours = Math.floor(diffMs / (1000 * 60 * 60));
                                    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                                    return `${hours}h ${minutes}m`;
                                  })()}
                                </p>
                              </div>
                              <p className="font-bold text-blue-600">S/ {Number(rental.total_amount).toFixed(2)}</p>
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                              <p>Cliente: {rental.clients?.name || 'Cliente Anónimo'}</p>
                              <p>Inicio: {new Date(rental.start_time).toLocaleString('es-PE')}</p>
                              <p>Fin: {new Date(rental.end_time).toLocaleString('es-PE')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        <Clock size={48} className="mx-auto mb-4 text-gray-300" />
                        <p>No hay rentas registradas en esta sesión</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowSessionDetail(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
