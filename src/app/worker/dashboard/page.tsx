"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { TenantConfig } from '@/types/database.types';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Users, Package, ShoppingCart, Play, Square, Clock } from 'lucide-react';
import Image from 'next/image';
import { initializePushNotifications, showLocalNotification } from '@/lib/pushNotifications';

export default function WorkerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [stats, setStats] = useState({
    totalTables: 0,
    occupiedTables: 0,
    activeRentals: 0,
    todayRevenue: 0
  });
  const [currentSession, setCurrentSession] = useState<{ 
    id: number; 
    session_name: string; 
    start_time: string; 
    is_active: boolean 
  } | null>(null);
  const [sessionDuration, setSessionDuration] = useState<string>('0h 0m');

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
    loadData(parsedUser.tenant_id, parsedUser.id);
    loadTenantConfig(parsedUser.tenant_id);
    loadCurrentSession(parsedUser.tenant_id, parsedUser.id);

    // Inicializar notificaciones push
    initializePushNotifications().then(success => {
      if (success) {
        console.log('Notificaciones push habilitadas');
      }
    });
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

  const loadData = async (tenantId: number, userId: number) => {

    // Cargar mesas (información general del tenant)
    const { data: tablesData } = await supabase
      .from('tables')
      .select('*')
      .eq('tenant_id', tenantId);

    // Cargar rentas activas del trabajador específico
    const { data: activeRentalsData } = await supabase
      .from('rentals')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .is('end_time', null);

    // Cargar ingresos de hoy del trabajador específico
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Ingresos por rentas de hoy del trabajador específico
    const { data: todayRentalsData } = await supabase
      .from('rentals')
      .select('total_amount')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .gte('created_at', today.toISOString())
      .not('total_amount', 'is', null);

    // Ingresos por ventas de hoy del trabajador
    const { data: todaySalesData } = await supabase
      .from('sales')
      .select('total_amount')
      .eq('tenant_id', tenantId)
      .eq('worker_id', userId)
      .gte('created_at', today.toISOString());

    const rentalsRevenue = todayRentalsData?.reduce((sum, r) => sum + Number(r.total_amount), 0) || 0;
    const salesRevenue = todaySalesData?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;
    const totalRevenue = rentalsRevenue + salesRevenue;

    setStats({
      totalTables: tablesData?.length || 0,
      occupiedTables: tablesData?.filter(t => !t.is_available).length || 0,
      activeRentals: activeRentalsData?.length || 0,
      todayRevenue: totalRevenue
    });
  };

  const loadCurrentSession = async (tenantId: number, workerId?: number) => {
    try {
      let query = supabase
        .from('daily_sessions')
        .select('id, session_name, start_time, is_active')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      // Si se proporciona workerId, filtrar por el worker específico
      if (workerId) {
        query = query.eq('created_by', workerId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        if (!error.message.includes('relation "daily_sessions" does not exist')) {
          console.error('Error cargando sesión:', error);
        }
        return;
      }

      if (data) {
        setCurrentSession(data);
        // Inicializar el contador de duración
        updateSessionDuration(data.start_time);
      }
    } catch (error) {
      console.error('Error en loadCurrentSession:', error);
    }
  };

  const updateSessionDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    setSessionDuration(`${hours}h ${minutes}m`);
  };

  const startDaySession = async () => {
    if (!user) return;
    
    // Verificar si ya hay una sesión activa
    if (currentSession) {
      alert('Ya hay una sesión activa. Termina la sesión actual antes de comenzar una nueva.');
      return;
    }

    const sessionName = prompt('Nombre de la sesión (opcional):', `Día ${new Date().toLocaleDateString('es-PE')}`);
    if (sessionName === null) return; // Usuario canceló

    try {
      // Crear nueva sesión
      const { data: newSession, error: sessionError } = await supabase
        .from('daily_sessions')
        .insert({
          tenant_id: user.tenant_id,
          session_name: sessionName || `Día ${new Date().toLocaleDateString('es-PE')}`,
          start_time: new Date().toISOString(),
          is_active: true,
          created_by: user.id
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Error creando sesión:', sessionError);
        alert('❌ Error al crear la sesión');
        return;
      }

      setCurrentSession(newSession);
      
      // Crear notificación para el admin
      await createSessionNotification('session_start', newSession, user);
      
      // Mostrar notificación local
      showLocalNotification(
        '🟢 Sesión Iniciada',
        `Sesión "${sessionName}" iniciada correctamente`,
        { sessionId: newSession.id }
      );
      
      alert(`✅ Sesión "${sessionName}" iniciada correctamente`);
    } catch (error) {
      console.error('Error en startDaySession:', error);
      alert('❌ Error inesperado al crear la sesión');
    }
  };

  const endDaySession = async () => {
    if (!user || !currentSession) return;

    const confirmEnd = confirm('¿Estás seguro de que quieres terminar la sesión del día?');
    if (!confirmEnd) return;

    try {
      const { error } = await supabase
        .from('daily_sessions')
        .update({
          end_time: new Date().toISOString(),
          is_active: false
        })
        .eq('id', currentSession.id);

      if (error) {
        console.error('Error terminando sesión:', error);
        alert('❌ Error al terminar la sesión');
        return;
      }

      // Crear notificación para el admin
      await createSessionNotification('session_end', currentSession, user);
      
      // Mostrar notificación local
      showLocalNotification(
        '🔴 Sesión Finalizada',
        `Sesión "${currentSession.session_name}" finalizada correctamente`,
        { sessionId: currentSession.id }
      );
      
      setCurrentSession(null);
      setSessionDuration('0h 0m');
      alert('✅ Sesión terminada correctamente');
    } catch (error) {
      console.error('Error en endDaySession:', error);
      alert('❌ Error inesperado al terminar la sesión');
    }
  };

  // Función para crear notificaciones de sesión
  const createSessionNotification = async (
    type: 'session_start' | 'session_end', 
    session: any, 
    worker: any
  ) => {
    try {
      // Obtener admin del tenant
      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .eq('tenant_id', worker.tenant_id)
        .eq('role', 'admin')
        .limit(1);

      if (!adminUsers || adminUsers.length === 0) return;

      const title = type === 'session_start' 
        ? '🟢 Sesión Iniciada' 
        : '🔴 Sesión Finalizada';
      
      const message = type === 'session_start'
        ? `${worker.username} ha iniciado la sesión "${session.session_name}"`
        : `${worker.username} ha finalizado la sesión "${session.session_name}"`;

      await supabase
        .from('notifications')
        .insert({
          tenant_id: worker.tenant_id,
          recipient_user_id: adminUsers[0].id,
          sender_user_id: worker.id,
          type,
          title,
          message,
          metadata: {
            session_id: session.id,
            session_name: session.session_name,
            worker_username: worker.username,
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('Error creando notificación:', error);
      // No mostrar error al usuario, es una funcionalidad secundaria
    }
  };

  // Efecto para actualizar duración cada minuto
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentSession) {
      interval = setInterval(() => {
        updateSessionDuration(currentSession.start_time);
      }, 60000); // Actualizar cada minuto
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentSession]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
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
              <div className="p-4 bg-muted rounded-xl">
                <TrendingUp size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold">
                  {tenantConfig?.business_name 
                    ? `Bienvenido a ${tenantConfig.business_name} Billar`
                    : 'Bienvenido a tu Billar'
                  }
                </h1>
                <p className="text-base text-muted-foreground mt-1">Panel de empleado - Resumen de actividad</p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 md:p-6 lg:p-8">
          {/* Indicador de Sesión Activa */}
          {currentSession ? (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div>
                    <p className="font-semibold text-green-900">Sesión Activa: {currentSession.session_name}</p>
                    <p className="text-sm text-green-700">
                      Iniciada: {new Date(currentSession.start_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} - 
                      Duración: {sessionDuration}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={endDaySession}
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                >
                  <Square size={16} />
                  Terminar Día
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Clock size={20} className="text-blue-600" />
                  <div>
                    <p className="font-semibold text-blue-900">Sin Sesión Activa</p>
                    <p className="text-sm text-blue-700">Inicia tu día de trabajo para comenzar a registrar actividades</p>
                  </div>
                </div>
                <Button
                  onClick={startDaySession}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Play size={16} />
                  Iniciar Día
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Mesas" value={stats.totalTables} accent="slate" icon={<Image src="/icons/mesa.ico" alt="Mesa" width={40} height={40} />} />
            <StatCard title="Ocupadas" value={stats.occupiedTables} accent="red" icon={<Image src="/icons/mesa.ico" alt="Mesa" width={40} height={40} />} />
            <StatCard title="Rentas Activas" value={stats.activeRentals} accent="amber" icon={<Users size={40} />} />
            <StatCard title="Ingresos Hoy" value={`S/ ${stats.todayRevenue.toFixed(2)}`} accent="blue" icon={<TrendingUp size={40} />} />
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button variant="outline" onClick={() => router.push('/worker/tables')} className="h-auto flex-col gap-2 p-6 items-start">
              <Image src="/icons/mesa.ico" alt="Mesa" width={24} height={24} />
              <div className="text-left">
                <p className="font-semibold">Ver Mesas</p>
                <p className="text-xs text-muted-foreground">Gestionar rentas</p>
              </div>
            </Button>
            <Button variant="outline" onClick={() => router.push('/worker/clients')} className="h-auto flex-col gap-2 p-6 items-start">
              <Users size={24} />
              <div className="text-left">
                <p className="font-semibold">Ver Clientes</p>
                <p className="text-xs text-muted-foreground">Consulta deudas</p>
              </div>
            </Button>
            <Button variant="outline" onClick={() => router.push('/worker/pos')} className="h-auto flex-col gap-2 p-6 items-start">
              <ShoppingCart size={24} />
              <div className="text-left">
                <p className="font-semibold">Punto de Venta</p>
                <p className="text-xs text-muted-foreground">Registrar consumos</p>
              </div>
            </Button>
            <Button variant="outline" onClick={() => router.push('/worker/earnings')} className="h-auto flex-col gap-2 p-6 items-start">
              <TrendingUp size={24} />
              <div className="text-left">
                <p className="font-semibold">Mis Ingresos</p>
                <p className="text-xs text-muted-foreground">Historial de ventas y rentas</p>
              </div>
            </Button>
          </div>
        </div>
      </div>
      </div>
    </SidebarProvider>
  );
}
