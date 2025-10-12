"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { TenantConfig } from '@/types/database.types';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Users, Package, ShoppingCart } from 'lucide-react';
import Image from 'next/image';

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
