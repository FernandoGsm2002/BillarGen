"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { TenantConfig } from '@/types/database.types';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardHeader, CardBody, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DollarSign, ShoppingCart, Users, Package, Calendar, Download, FileText, FileSpreadsheet, Eye, BarChart3, Activity, TrendingDown, TrendingUpIcon, Clock, CreditCard, Banknote, Calculator } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';

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

interface DailySession {
  id: number;
  session_name: string;
  start_time: string;
  end_time: string | null;
  is_active: boolean;
  tenant_id: number;
  created_by: number;
  created_at: string;
}

interface SessionFinancials {
  session_id: number;
  total_sales_revenue: number;
  total_rentals_revenue: number;
  total_revenue: number;
  products_sold: number;
  rentals_completed: number;
  average_sale: number;
  session_duration: string;
  total_hours: number;
  sales_details: Array<{
    id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    is_paid: boolean;
    created_at: string;
    customer_name?: string;
  }>;
  rentals_details: Array<{
    id: number;
    table_name: string;
    start_time: string;
    end_time: string;
    duration_hours: number;
    total_amount: number;
  }>;
  unpaid_sales_total: number;
  paid_sales_total: number;
  unpaid_sales_count: number;
}

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
  const [sessions, setSessions] = useState<DailySession[]>([]);
  const [selectedSession, setSelectedSession] = useState<DailySession | null>(null);
  const [sessionFinancials, setSessionFinancials] = useState<SessionFinancials | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [declaredAmount, setDeclaredAmount] = useState<string>('');
  const [showDeclaredAmountInput, setShowDeclaredAmountInput] = useState(false);
  const [generatingSessionPDF, setGeneratingSessionPDF] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<string>('');

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
    loadDailySessions(parsedUser.tenant_id);
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

  const loadDailySessions = async (tenantId: number) => {
    try {
      const { data, error } = await supabase
        .from('daily_sessions')
        .select(`
          *,
          users:created_by (username)
        `)
        .eq('tenant_id', tenantId)
        .order('start_time', { ascending: false })
        .limit(30); // Últimas 30 sesiones

      if (error) {
        if (error.message.includes('relation "daily_sessions" does not exist')) {
          console.log('La tabla daily_sessions no existe aún');
          return;
        }
        console.error('Error cargando sesiones:', error);
        return;
      }

      if (data) {
        setSessions(data);
      }
    } catch (error) {
      console.error('Error en loadDailySessions:', error);
    }
  };

  const loadSessionFinancials = async (session: DailySession) => {
    setLoadingSession(true);
    try {
      if (!user) return;

      const startDate = new Date(session.start_time);
      const endDate = session.end_time ? new Date(session.end_time) : new Date();

      // Cargar ventas detalladas de la sesión con información de productos
      const { data: salesData } = await supabase
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
        .eq('tenant_id', user.tenant_id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      // Cargar rentas detalladas de la sesión
      const { data: rentalsData } = await supabase
        .from('rentals')
        .select(`
          id,
          start_time,
          end_time,
          total_amount,
          tables(name)
        `)
        .eq('tenant_id', user.tenant_id)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .not('end_time', 'is', null)
        .order('start_time', { ascending: false });

      // Procesar detalles de ventas
      const salesDetails = salesData?.map(sale => {
        // Manejar tanto objeto como array para products y clients
        const product = Array.isArray(sale.products) ? sale.products[0] : sale.products;
        const client = Array.isArray(sale.clients) ? sale.clients[0] : sale.clients;
        return {
          id: sale.id,
          product_name: product?.name || 'Producto sin nombre',
          quantity: Number(sale.quantity),
          unit_price: Number(sale.unit_price),
          total_amount: Number(sale.total_amount),
          is_paid: Boolean(sale.is_paid),
          created_at: sale.created_at,
          customer_name: client?.name || undefined
        };
      }) || [];

      // Procesar detalles de rentas
      const rentalsDetails = rentalsData?.map(rental => {
        // Manejar tanto objeto como array para tables
        const table = Array.isArray(rental.tables) ? rental.tables[0] : rental.tables;
        
        // Calcular duración manualmente
        const startTime = new Date(rental.start_time);
        const endTime = new Date(rental.end_time);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        
        return {
          id: rental.id,
          table_name: table?.name || 'Mesa sin nombre',
          start_time: rental.start_time,
          end_time: rental.end_time,
          duration_hours: Math.round(durationHours * 10) / 10, // Redondear a 1 decimal
          total_amount: Number(rental.total_amount)
        };
      }) || [];

      // Calcular estadísticas financieras
      const totalSalesRevenue = salesDetails.reduce((sum, sale) => sum + sale.total_amount, 0);
      const totalRentalsRevenue = rentalsDetails.reduce((sum, rental) => sum + rental.total_amount, 0);
      const totalRevenue = totalSalesRevenue + totalRentalsRevenue;
      const productsSold = salesDetails.reduce((sum, sale) => sum + sale.quantity, 0);
      const rentalsCompleted = rentalsDetails.length;
      const averageSale = salesDetails.length > 0 ? totalSalesRevenue / salesDetails.length : 0;

      // Calcular ventas no pagadas vs pagadas
      const unpaidSales = salesDetails.filter(sale => !sale.is_paid);
      const paidSales = salesDetails.filter(sale => sale.is_paid);
      const unpaidSalesTotal = unpaidSales.reduce((sum, sale) => sum + sale.total_amount, 0);
      const paidSalesTotal = paidSales.reduce((sum, sale) => sum + sale.total_amount, 0);

      // Calcular duración
      const duration = endDate.getTime() - startDate.getTime();
      const hours = Math.floor(duration / (1000 * 60 * 60));
      const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
      const sessionDuration = hours === 0 && minutes === 0 ? "1m" : `${hours}h ${minutes}m`;
      const totalHours = Math.max(0.017, hours + (minutes / 60)); // Mínimo 1 minuto = 0.017 horas

      const financials: SessionFinancials = {
        session_id: session.id,
        total_sales_revenue: totalSalesRevenue,
        total_rentals_revenue: totalRentalsRevenue,
        total_revenue: totalRevenue,
        products_sold: productsSold,
        rentals_completed: rentalsCompleted,
        average_sale: averageSale,
        session_duration: sessionDuration,
        total_hours: totalHours,
        sales_details: salesDetails,
        rentals_details: rentalsDetails,
        unpaid_sales_total: unpaidSalesTotal,
        paid_sales_total: paidSalesTotal,
        unpaid_sales_count: unpaidSales.length
      };

      setSessionFinancials(financials);
      setSelectedSession(session);
      setDeclaredAmount(''); // Reset declared amount
      setShowDeclaredAmountInput(false);
      setShowSessionModal(true);
    } catch (error) {
      console.error('Error cargando datos de sesión:', error);
      alert('Error al cargar los detalles de la sesión');
    } finally {
      setLoadingSession(false);
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

  const calculateDiscrepancy = (actualAmount: number, declaredAmount: number) => {
    const difference = actualAmount - declaredAmount;
    const percentage = actualAmount > 0 ? (difference / actualAmount) * 100 : 0;
    return { difference, percentage };
  };

  const handleDeleteSale = async (saleId: number) => {
    if (!user) return;
    
    const confirmDelete = confirm('¿Estás seguro de que quieres eliminar esta venta? Esta acción no se puede deshacer.');
    if (!confirmDelete) return;

    setDeletingRecord(`sale-${saleId}`);
    try {
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', saleId)
        .eq('tenant_id', user.tenant_id);

      if (error) {
        console.error('Error eliminando venta:', error);
        alert('❌ Error al eliminar la venta');
        return;
      }

      // Recargar datos de la sesión
      if (selectedSession) {
        await loadSessionFinancials(selectedSession);
      }
      
      alert('✅ Venta eliminada correctamente');
    } catch (error) {
      console.error('Error en handleDeleteSale:', error);
      alert('❌ Error inesperado al eliminar la venta');
    } finally {
      setDeletingRecord('');
    }
  };

  const handleDeleteRental = async (rentalId: number) => {
    if (!user) return;
    
    const confirmDelete = confirm('¿Estás seguro de que quieres eliminar esta renta? Esta acción no se puede deshacer.');
    if (!confirmDelete) return;

    setDeletingRecord(`rental-${rentalId}`);
    try {
      const { error } = await supabase
        .from('rentals')
        .delete()
        .eq('id', rentalId)
        .eq('tenant_id', user.tenant_id);

      if (error) {
        console.error('Error eliminando renta:', error);
        alert('❌ Error al eliminar la renta');
        return;
      }

      // Recargar datos de la sesión
      if (selectedSession) {
        await loadSessionFinancials(selectedSession);
      }
      
      alert('✅ Renta eliminada correctamente');
    } catch (error) {
      console.error('Error en handleDeleteRental:', error);
      alert('❌ Error inesperado al eliminar la renta');
    } finally {
      setDeletingRecord('');
    }
  };

  const generateSessionPDF = async (session: DailySession, financials: SessionFinancials) => {
    if (!tenantConfig) {
      alert('No se pudo cargar la configuración de la empresa');
      return;
    }

    setGeneratingSessionPDF(true);
    try {
      const { generateSessionPDF } = await import('@/lib/sessionPdfUtils');
      await generateSessionPDF(session, financials, tenantConfig);
      alert('Reporte de sesión descargado exitosamente');
    } catch (error) {
      console.error('Error generando PDF de sesión:', error);
      alert('Error al generar el reporte PDF de la sesión');
    } finally {
      setGeneratingSessionPDF(false);
    }
  };

  const handleDeclaredAmountSubmit = () => {
    if (!sessionFinancials || !declaredAmount) return;
    
    const declared = parseFloat(declaredAmount);
    const actual = sessionFinancials.paid_sales_total + sessionFinancials.total_rentals_revenue; // Ventas pagadas + rentas
    
    if (isNaN(declared)) {
      alert('Por favor ingresa un monto válido');
      return;
    }

    const { difference, percentage } = calculateDiscrepancy(actual, declared);
    
    if (difference > 0) {
      alert(`El trabajador declaró menos de lo esperado:\n` +
            `Monto real esperado: S/ ${actual.toFixed(2)}\n` +
            `Monto declarado: S/ ${declared.toFixed(2)}\n` +
            `Diferencia: S/ ${difference.toFixed(2)} (${percentage.toFixed(1)}%)\n\n` +
            `Considera aplicar un descuento o revisar la sesión.`);
    } else if (difference < 0) {
      alert(`El trabajador declaró más de lo esperado:\n` +
            `Monto real esperado: S/ ${actual.toFixed(2)}\n` +
            `Monto declarado: S/ ${declared.toFixed(2)}\n` +
            `Diferencia: S/ ${Math.abs(difference).toFixed(2)} adicional\n\n` +
            `¡Excelente honestidad!`);
    } else {
      alert(`¡Perfecto! Los montos coinciden exactamente:\n` +
            `Monto declarado: S/ ${declared.toFixed(2)}`);
    }
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
              <div className="flex items-center gap-3 sm:gap-4">
                <SidebarTrigger className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors" />
                <div className="p-3 sm:p-4 bg-gray-100 rounded-xl">
                  <BarChart3 size={28} className="text-gray-700 sm:w-8 sm:h-8" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Estadísticas</h1>
                  <p className="text-sm sm:text-base text-gray-600 mt-1 hidden sm:block">Análisis completo de tu negocio</p>
                  <p className="text-xs text-gray-500 mt-1 sm:hidden">Análisis del negocio</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowExportModal(true)}
                  className="gap-2 text-xs sm:text-sm px-2 sm:px-4"
                  size="sm"
                >
                  <Download size={16} className="sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Exportar</span>
                  <span className="sm:hidden">PDF</span>
                </Button>
                <Button
                  onClick={() => loadComprehensiveStats(user.tenant_id)}
                  className="gap-2 text-xs sm:text-sm px-2 sm:px-4"
                  size="sm"
                >
                  <Activity size={16} className="sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Actualizar</span>
                  <span className="sm:hidden">↻</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen">
          <div className="space-y-4 sm:space-y-6">
            {/* Resumen General */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Semana Actual */}
                  <div className="bg-gradient-to-br from-green-50 to-blue-50 p-4 sm:p-6 rounded-lg border border-green-200">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">
                      📅 Semana Actual ({stats.current_week.week})
                    </h3>
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex justify-between text-sm sm:text-base">
                        <span className="text-gray-600">Ingresos por Ventas:</span>
                        <span className="font-bold text-green-600">S/ {stats.current_week.sales_revenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm sm:text-base">
                        <span className="text-gray-600">Ingresos por Rentas:</span>
                        <span className="font-bold text-blue-600">S/ {stats.current_week.rentals_revenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 text-sm sm:text-base">
                        <span className="text-gray-900 font-semibold">Total:</span>
                        <span className="font-bold text-purple-600 text-lg sm:text-xl">S/ {stats.current_week.total_revenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm sm:text-base">
                        <span className="text-gray-600">Productos Vendidos:</span>
                        <span className="font-bold">{stats.current_week.products_sold}</span>
                      </div>
                      <div className="flex justify-between text-sm sm:text-base">
                        <span className="text-gray-600">Mesas Rentadas:</span>
                        <span className="font-bold">{stats.current_week.rentals_completed}</span>
                      </div>
                    </div>
                  </div>

                  {/* Semana Anterior */}
                  <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-4 sm:p-6 rounded-lg border border-gray-200">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">
                      📅 Semana Anterior ({stats.previous_week.week})
                    </h3>
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex justify-between text-sm sm:text-base">
                        <span className="text-gray-600">Ingresos por Ventas:</span>
                        <span className="font-bold text-gray-700">S/ {stats.previous_week.sales_revenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm sm:text-base">
                        <span className="text-gray-600">Ingresos por Rentas:</span>
                        <span className="font-bold text-gray-700">S/ {stats.previous_week.rentals_revenue.toFixed(2)}</span>
                    </div>
                      <div className="flex justify-between border-t pt-2 text-sm sm:text-base">
                        <span className="text-gray-900 font-semibold">Total:</span>
                        <span className="font-bold text-gray-700 text-lg sm:text-xl">S/ {stats.previous_week.total_revenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm sm:text-base">
                        <span className="text-gray-600">Productos Vendidos:</span>
                        <span className="font-bold text-gray-700">{stats.previous_week.products_sold}</span>
                      </div>
                      <div className="flex justify-between text-sm sm:text-base">
                        <span className="text-gray-600">Mesas Rentadas:</span>
                        <span className="font-bold text-gray-700">{stats.previous_week.rentals_completed}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Indicadores de Cambio */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6">
                  <div className={`p-3 sm:p-4 rounded-lg text-center ${weeklyRevenueChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    <div className="flex items-center justify-center gap-2 mb-1 sm:mb-2">
                      {weeklyRevenueChange >= 0 ? <TrendingUpIcon size={18} className="sm:w-5 sm:h-5" /> : <TrendingDown size={18} className="sm:w-5 sm:h-5" />}
                      <span className="font-bold text-sm sm:text-base">{weeklyRevenueChange.toFixed(1)}%</span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium">Cambio en Ingresos</p>
                  </div>
                  
                  <div className={`p-3 sm:p-4 rounded-lg text-center ${weeklySalesChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    <div className="flex items-center justify-center gap-2 mb-1 sm:mb-2">
                      {weeklySalesChange >= 0 ? <TrendingUpIcon size={18} className="sm:w-5 sm:h-5" /> : <TrendingDown size={18} className="sm:w-5 sm:h-5" />}
                      <span className="font-bold text-sm sm:text-base">{weeklySalesChange.toFixed(1)}%</span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium">Cambio en Ventas</p>
                    </div>
                  
                  <div className={`p-3 sm:p-4 rounded-lg text-center ${monthlyRevenueChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    <div className="flex items-center justify-center gap-2 mb-1 sm:mb-2">
                      {monthlyRevenueChange >= 0 ? <TrendingUpIcon size={18} className="sm:w-5 sm:h-5" /> : <TrendingDown size={18} className="sm:w-5 sm:h-5" />}
                      <span className="font-bold text-sm sm:text-base">{monthlyRevenueChange.toFixed(1)}%</span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium">Cambio Mensual</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Gráfico de Tendencia Diaria */}
            <Card className="mb-6 sm:mb-8">
              <CardHeader>
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold flex items-center gap-2">
                  📈 Tendencia Diaria (Últimos 7 días)
                </h2>
              </CardHeader>
              <CardBody>
                <div className="space-y-3 sm:space-y-4">
                  {stats.daily_stats.map((day, index) => (
                    <div key={day.date} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 sm:gap-4 flex-1">
                        <div className="text-xs sm:text-sm font-medium text-gray-600 w-16 sm:w-24">
                          {new Date(day.date).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        </div>
                        <div className="flex-1 max-w-32 sm:max-w-48 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                            style={{ 
                              width: `${Math.max(5, (day.total_revenue / Math.max(...stats.daily_stats.map(d => d.total_revenue))) * 100)}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <div className="font-bold text-sm sm:text-lg">S/ {day.total_revenue.toFixed(2)}</div>
                        <div className="text-xs sm:text-sm text-gray-600">{day.products_sold} productos</div>
                      </div>
                    </div>
                  ))}
                </div>
                  </CardBody>
                </Card>

            {/* Top Productos y Trabajadores */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Top Productos */}
              <Card>
                <CardHeader>
                  <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                    🏆 Top Productos (Esta Semana)
                  </h2>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3 sm:space-y-4">
                    {stats.top_products.length > 0 ? stats.top_products.map((product, idx) => (
                      <div key={product.name} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0">
                            {idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm sm:text-base truncate">{product.name}</p>
                            <p className="text-xs sm:text-sm text-gray-600">{product.quantity} unidades</p>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <div className="font-bold text-green-600 text-sm sm:text-base">S/ {product.revenue.toFixed(2)}</div>
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
                  <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                    👥 Top Trabajadores (Esta Semana)
                  </h2>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3 sm:space-y-4">
                    {stats.top_workers.length > 0 ? stats.top_workers.map((worker, idx) => (
                      <div key={worker.username} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0">
                            {idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm sm:text-base truncate">{worker.username}</p>
                            <p className="text-xs sm:text-sm text-gray-600">{worker.sales_count} ventas</p>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <div className="font-bold text-blue-600 text-sm sm:text-base">S/ {worker.revenue.toFixed(2)}</div>
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

            {/* Registro de Sesiones Diarias */}
            <Card className="mt-4 sm:mt-6">
              <CardHeader>
                <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <Calendar size={20} className="sm:w-6 sm:h-6" />
                  Registro de Sesiones Diarias
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  Historial de sesiones de trabajo con resúmenes financieros
                </p>
                </CardHeader>
                <CardBody>
                  {sessions.length > 0 ? (
                  <div className="space-y-3">
                          {sessions.map((session) => (
                      <div 
                        key={session.id} 
                        className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 sm:gap-3">
                              <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                                session.is_active ? 'bg-green-500' : 'bg-gray-400'
                              }`} />
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{session.session_name}</h3>
                                <div className="text-xs sm:text-sm text-gray-600 space-y-1 sm:space-y-0 sm:space-x-4 mt-1">
                                  <div className="sm:inline">📅 Iniciada: {new Date(session.start_time).toLocaleDateString('es-PE')} {new Date(session.start_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</div>
                                  {session.end_time && (
                                    <div className="sm:inline">🏁 Finalizada: {new Date(session.end_time).toLocaleDateString('es-PE')} {new Date(session.end_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</div>
                                  )}
                                </div>
                                <div className="mt-2">
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    session.is_active 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {session.is_active ? 'Activa' : 'Finalizada'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadSessionFinancials(session)}
                              disabled={loadingSession}
                              className="flex items-center gap-2 text-xs sm:text-sm"
                            >
                              <Eye size={14} className="sm:w-4 sm:h-4" />
                              <span className="hidden sm:inline">Ver Detalles</span>
                              <span className="sm:hidden">Ver</span>
                            </Button>
                            {!session.is_active && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={async () => {
                                  // Cargar datos de la sesión para el PDF
                                  await loadSessionFinancials(session);
                                  // Esperar un momento para que se carguen los datos
                                  setTimeout(() => {
                                    if (sessionFinancials) {
                                      generateSessionPDF(session, sessionFinancials);
                                    }
                                  }, 1000);
                                }}
                                disabled={generatingSessionPDF}
                                className="flex items-center gap-2 text-xs sm:text-sm bg-red-600 hover:bg-red-700 text-white"
                              >
                                <Download size={14} className="sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">PDF</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    </div>
                  ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar size={48} className="mx-auto mb-2 opacity-30" />
                    <p className="font-medium">No hay sesiones registradas</p>
                    <p className="text-sm mt-1">Las sesiones aparecerán aquí cuando se creen desde productos</p>
                    </div>
                  )}
                </CardBody>
              </Card>
          </div>
        </div>

        {/* Modal de Exportación */}
        <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
          <DialogContent className="w-[95vw] max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Download size={20} className="sm:w-6 sm:h-6" />
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

        {/* Modal de Detalles de Sesión Mejorado */}
        <Dialog open={showSessionModal} onOpenChange={setShowSessionModal}>
          <DialogContent className="w-[98vw] max-w-6xl max-h-[95vh] overflow-hidden mx-1 sm:mx-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Calendar size={20} className="sm:w-6 sm:h-6" />
                <span className="truncate">Detalles de Sesión: {selectedSession?.session_name}</span>
              </DialogTitle>
            </DialogHeader>

            {loadingSession ? (
              <div className="text-center py-8">
                <Activity size={48} className="mx-auto mb-4 animate-spin text-primary" />
                <p>Cargando datos detallados de la sesión...</p>
              </div>
            ) : (
              sessionFinancials && selectedSession && (
                <div className="overflow-y-auto max-h-[75vh] space-y-4 pr-2">
                  {/* Header con información básica - Más compacto */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {/* Información de Sesión */}
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <h3 className="font-semibold text-blue-900 mb-2 text-sm flex items-center gap-1">
                        <Clock size={16} />
                        Información de Sesión
                      </h3>
                      <div className="space-y-1 text-xs text-blue-800">
                        <p className="truncate">📝 {selectedSession.session_name}</p>
                        <p>🕐 {new Date(selectedSession.start_time).toLocaleDateString('es-PE')} {new Date(selectedSession.start_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</p>
                        {selectedSession.end_time && (
                          <p>🏁 {new Date(selectedSession.end_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</p>
                        )}
                        <p>⏱️ Duración: <span className="font-semibold">{sessionFinancials.session_duration}</span></p>
                      </div>
                    </div>

                    {/* Balance del Día */}
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <h3 className="font-semibold text-green-900 mb-2 text-sm flex items-center gap-1">
                        <Calculator size={16} />
                        Balance del Día
                      </h3>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-green-700">💰 Pagadas:</span>
                          <span className="font-bold text-green-800">S/ {sessionFinancials.paid_sales_total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700">🏓 Rentas:</span>
                          <span className="font-bold text-blue-800">S/ {sessionFinancials.total_rentals_revenue.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-1">
                          <span className="text-purple-700 font-semibold">Total:</span>
                          <span className="font-bold text-purple-800">S/ {(sessionFinancials.paid_sales_total + sessionFinancials.total_rentals_revenue).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Estado de Ventas Pendientes */}
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <h3 className="font-semibold text-amber-900 mb-2 text-sm flex items-center gap-1">
                        <CreditCard size={16} />
                        Ventas Pendientes
                      </h3>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-amber-700">🏷️ Cantidad:</span>
                          <span className="font-bold text-amber-800">{sessionFinancials.unpaid_sales_count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-red-700">💳 Total No Pagado:</span>
                          <span className="font-bold text-red-800">S/ {sessionFinancials.unpaid_sales_total.toFixed(2)}</span>
                        </div>
                        {sessionFinancials.unpaid_sales_count > 0 && (
                          <div className="text-xs text-amber-600 mt-1">
                            ⚠️ Revisar cobros pendientes
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Resumen Financiero Compacto */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="bg-white p-3 rounded-lg border shadow-sm">
                      <p className="text-xs text-gray-600 font-medium">Total Ventas</p>
                      <p className="text-lg font-bold text-green-600">S/ {sessionFinancials.total_sales_revenue.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{sessionFinancials.products_sold} productos</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border shadow-sm">
                      <p className="text-xs text-gray-600 font-medium">Total Rentas</p>
                      <p className="text-lg font-bold text-blue-600">S/ {sessionFinancials.total_rentals_revenue.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{sessionFinancials.rentals_completed} mesas</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border shadow-sm">
                      <p className="text-xs text-gray-600 font-medium">Total General</p>
                      <p className="text-lg font-bold text-purple-600">S/ {sessionFinancials.total_revenue.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">Todo incluido</p>
                    </div>
                  </div>

                  {/* Sección de Monto Declarado por Trabajador */}
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
                        <Banknote size={18} />
                        Verificación de Monto Declarado
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeclaredAmountInput(!showDeclaredAmountInput)}
                        className="text-xs"
                      >
                        {showDeclaredAmountInput ? 'Ocultar' : 'Evaluar'}
                      </Button>
                    </div>
                    
                    {showDeclaredAmountInput && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="bg-white p-3 rounded border">
                            <p className="text-sm font-medium text-gray-700 mb-1">Monto Real Esperado:</p>
                            <p className="text-xl font-bold text-green-700">S/ {(sessionFinancials.paid_sales_total + sessionFinancials.total_rentals_revenue).toFixed(2)}</p>
                            <p className="text-xs text-gray-500">Ventas pagadas + rentas</p>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <label htmlFor="declared-amount" className="text-sm font-medium text-gray-700 block mb-1">
                              Monto Declarado por el Trabajador:
                            </label>
                            <div className="flex gap-2">
                              <Input
                                id="declared-amount"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={declaredAmount}
                                onChange={(e) => setDeclaredAmount(e.target.value)}
                                className="text-sm"
                              />
                              <Button
                                onClick={handleDeclaredAmountSubmit}
                                size="sm"
                                className="shrink-0"
                                disabled={!declaredAmount}
                              >
                                Evaluar
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-indigo-600 bg-white p-2 rounded border">
                          💡 <strong>Nota:</strong> Se compara con ventas pagadas + rentas. Las ventas pendientes de pago no forman parte del monto a entregar.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Detalles de Productos Vendidos */}
                  <div className="bg-white rounded-lg border shadow-sm">
                    <div className="p-3 border-b bg-gray-50">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Package size={18} />
                        Productos Vendidos ({sessionFinancials.sales_details.length})
                      </h3>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {sessionFinancials.sales_details.length > 0 ? (
                        <div className="space-y-1 p-2">
                          {sessionFinancials.sales_details.map((sale, index) => (
                            <div key={sale.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm hover:bg-gray-100">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                                  {index + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium truncate">{sale.product_name}</p>
                                  <div className="flex items-center gap-4 text-xs text-gray-600">
                                    <span>🔢 Cant: {sale.quantity}</span>
                                    <span>💰 Unit: S/ {sale.unit_price.toFixed(2)}</span>
                                    <span>🕐 {new Date(sale.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                                    {!sale.is_paid && <span className="text-red-600 font-medium">💳 PENDIENTE</span>}
                                    {sale.customer_name && <span className="text-blue-600">👤 {sale.customer_name}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                <div className="text-right">
                                  <div className={`font-bold ${!sale.is_paid ? 'text-red-600' : 'text-green-600'}`}>
                                    S/ {sale.total_amount.toFixed(2)}
                                  </div>
                                  {!sale.is_paid && (
                                    <div className="text-xs text-red-500">Pendiente</div>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteSale(sale.id)}
                                  disabled={deletingRecord === `sale-${sale.id}`}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                                  title="Eliminar venta"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Package size={32} className="mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No se vendieron productos en esta sesión</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Detalles de Mesas Rentadas */}
                  {sessionFinancials.rentals_details.length > 0 && (
                    <div className="bg-white rounded-lg border shadow-sm">
                      <div className="p-3 border-b bg-gray-50">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          <Users size={18} />
                          Mesas Rentadas ({sessionFinancials.rentals_details.length})
                        </h3>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        <div className="space-y-1 p-2">
                          {sessionFinancials.rentals_details.map((rental, index) => (
                            <div key={rental.id} className="flex items-center justify-between p-2 bg-blue-50 rounded text-sm">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                                  {index + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium">{rental.table_name}</p>
                                  <div className="flex items-center gap-4 text-xs text-gray-600">
                                    <span>🕐 Inicio: {new Date(rental.start_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span>🏁 Fin: {new Date(rental.end_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span>⏱️ {rental.duration_hours.toFixed(1)}h</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                <div className="text-right">
                                  <div className="font-bold text-blue-600">S/ {rental.total_amount.toFixed(2)}</div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteRental(rental.id)}
                                  disabled={deletingRecord === `rental-${rental.id}`}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                                  title="Eliminar renta"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            <DialogFooter className="flex-shrink-0 pt-4 border-t">
              <div className="flex gap-2 w-full">
                {selectedSession && sessionFinancials && !selectedSession.is_active && (
                  <Button
                    variant="secondary"
                    onClick={() => generateSessionPDF(selectedSession, sessionFinancials)}
                    disabled={generatingSessionPDF}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Download size={16} />
                    {generatingSessionPDF ? 'Generando PDF...' : 'Descargar Reporte PDF'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSessionModal(false);
                    setSelectedSession(null);
                    setSessionFinancials(null);
                    setDeclaredAmount('');
                    setShowDeclaredAmountInput(false);
                  }}
                  className="flex-1"
                >
                  Cerrar
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </SidebarProvider>
  );
}