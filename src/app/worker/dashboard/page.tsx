"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Users, Package, ShoppingCart } from 'lucide-react';
import Image from 'next/image';

export default function WorkerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
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
    loadData(parsedUser.tenant_id);
  }, [router]);

  const loadData = async (tenantId: number) => {
    // Cargar mesas
    const { data: tablesData } = await supabase
      .from('tables')
      .select('*')
      .eq('tenant_id', tenantId);

    // Cargar rentas activas
    const { data: activeRentalsData } = await supabase
      .from('rentals')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('end_time', null);

    // Cargar ingresos de hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todayRentalsData } = await supabase
      .from('rentals')
      .select('total_amount')
      .eq('tenant_id', tenantId)
      .gte('created_at', today.toISOString())
      .not('total_amount', 'is', null);

    setStats({
      totalTables: tablesData?.length || 0,
      occupiedTables: tablesData?.filter(t => !t.is_available).length || 0,
      activeRentals: activeRentalsData?.length || 0,
      todayRevenue: todayRentalsData?.reduce((sum, r) => sum + Number(r.total_amount), 0) || 0
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
              <div className="p-4 bg-muted rounded-xl">
                <TrendingUp size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Panel de Empleado</h1>
                <p className="text-base text-muted-foreground mt-1">Resumen de actividad</p>
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

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
          </div>
        </div>
      </div>
      </div>
    </SidebarProvider>
  );
}
