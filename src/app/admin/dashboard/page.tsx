"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { StatCard, Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Package, TrendingUp, AlertTriangle, DollarSign, Users } from 'lucide-react';
import Image from 'next/image';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [stats, setStats] = useState({
    totalTables: 0,
    availableTables: 0,
    occupiedTables: 0,
    lowStockProducts: 0,
    totalSales: 0,
    todaySales: 0
  });

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
  }, [router]);

  const loadData = async (tenantId: number) => {
    // Cargar mesas
    const { data: tablesData } = await supabase
      .from('tables')
      .select('*')
      .eq('tenant_id', tenantId);

    // Cargar productos con stock bajo
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .lt('stock', 10);

    // Cargar ventas totales
    const { data: salesData } = await supabase
      .from('sales')
      .select('total_amount')
      .eq('tenant_id', tenantId);

    // Cargar ventas de hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todaySalesData } = await supabase
      .from('sales')
      .select('total_amount')
      .eq('tenant_id', tenantId)
      .gte('created_at', today.toISOString());

    setStats({
      totalTables: tablesData?.length || 0,
      availableTables: tablesData?.filter(t => t.is_available).length || 0,
      occupiedTables: tablesData?.filter(t => !t.is_available).length || 0,
      lowStockProducts: productsData?.length || 0,
      totalSales: salesData?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0,
      todaySales: todaySalesData?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0
    });
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        <Sidebar role={user.role as 'admin' | 'worker' | 'super_admin'} username={user.username} />
        
        <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-card border-b">
          <div className="px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="md:hidden" />
              <div className="p-4 bg-muted rounded-xl">
                <TrendingUp size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-base text-muted-foreground mt-1">Resumen general de tu negocio</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4 md:p-6 lg:p-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard
              title="Total Mesas"
              value={stats.totalTables}
              accent="slate"
              icon={<Image src="/icons/mesa.ico" alt="Mesa" width={40} height={40} />}
            />
            <StatCard
              title="Disponibles"
              value={stats.availableTables}
              accent="emerald"
              icon={<Image src="/icons/mesa.ico" alt="Mesa" width={40} height={40} />}
            />
            <StatCard
              title="Ocupadas"
              value={stats.occupiedTables}
              accent="red"
              icon={<Image src="/icons/mesa.ico" alt="Mesa" width={40} height={40} />}
            />
            <StatCard
              title="Stock Bajo"
              value={stats.lowStockProducts}
              subtitle="Productos < 10 unidades"
              accent="amber"
              icon={<AlertTriangle size={40} />}
            />
            <StatCard
              title="Ventas Hoy"
              value={`S/ ${stats.todaySales.toFixed(2)}`}
              accent="blue"
              icon={<DollarSign size={40} />}
            />
            <StatCard
              title="Ventas Totales"
              value={`S/ ${stats.totalSales.toFixed(2)}`}
              accent="slate"
              icon={<TrendingUp size={40} />}
            />
          </div>

          {/* Quick Actions */}
          <Card className="mt-6">
            <CardHeader>
              <h2 className="text-lg font-semibold">Accesos Rápidos</h2>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/tables')}
                  className="h-auto flex-col gap-2 p-4"
                >
                  <Image src="/icons/mesa.ico" alt="Mesa" width={24} height={24} />
                  <span className="text-sm font-semibold">Mesas</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/products')}
                  className="h-auto flex-col gap-2 p-4"
                >
                  <Package size={24} />
                  <span className="text-sm font-semibold">Productos</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/sales')}
                  className="h-auto flex-col gap-2 p-4"
                >
                  <TrendingUp size={24} />
                  <span className="text-sm font-semibold">Ventas</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/workers')}
                  className="h-auto flex-col gap-2 p-4"
                >
                  <Users size={24} />
                  <span className="text-sm font-semibold">Empleados</span>
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
