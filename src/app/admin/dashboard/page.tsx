"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { TenantConfig } from '@/types/database.types';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { StatCard, Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Package, TrendingUp, AlertTriangle, DollarSign, Users, Building2 } from 'lucide-react';
import Image from 'next/image';

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
    todaySales: 0
  });

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
        <div className="bg-white border-b border-gray-200">
          <div className="px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <SidebarTrigger className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors" />
                <div className="p-3 sm:p-4 bg-gray-100 rounded-xl">
                  <TrendingUp size={28} className="text-gray-700 sm:w-8 sm:h-8" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
                  <p className="text-sm sm:text-base text-gray-600 mt-1 hidden sm:block">Resumen general de tu negocio</p>
                  <p className="text-xs text-gray-500 mt-1 sm:hidden">Tu negocio</p>
                </div>
              </div>
              {tenantConfig && (
                <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="relative w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                    {tenantConfig.logo_url ? (
                      <Image 
                        src={tenantConfig.logo_url} 
                        alt={tenantConfig.business_name || 'Logo'} 
                        width={32} 
                        height={32} 
                        className="object-contain"
                      />
                    ) : (
                      <Building2 size={20} className="text-gray-600" />
                    )}
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900">{tenantConfig.business_name || 'Mi Negocio'}</p>
                    {tenantConfig.ruc && (
                      <p className="text-xs text-gray-500">RUC: {tenantConfig.ruc}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-6">
          {/* Welcome Section */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
              <div className="mb-4 sm:mb-0">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">¡Bienvenido de vuelta!</h2>
                <p className="text-gray-600 text-lg">Aquí tienes un resumen de tu negocio</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-sm">Hoy</p>
                <p className="text-2xl font-bold text-gray-800">{new Date().toLocaleDateString('es-PE')}</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <StatCard
              title="Total Mesas"
              value={stats.totalTables}
              accent="slate"
              icon={<Image src="/icons/mesa.ico" alt="Mesa" width={40} height={40} className="drop-shadow-sm" />}
            />
            <StatCard
              title="Disponibles"
              value={stats.availableTables}
              accent="slate"
              icon={<Image src="/icons/mesa.ico" alt="Mesa" width={40} height={40} className="drop-shadow-sm" />}
            />
            <StatCard
              title="Ocupadas"
              value={stats.occupiedTables}
              accent="slate"
              icon={<Image src="/icons/mesa.ico" alt="Mesa" width={40} height={40} className="drop-shadow-sm" />}
            />
            <StatCard
              title="Stock Bajo"
              value={stats.lowStockProducts}
              subtitle="< 10 unidades"
              accent="amber"
              icon={<AlertTriangle size={40} className="drop-shadow-sm" />}
            />
            <StatCard
              title="Ventas Hoy"
              value={formatCurrency(stats.todaySales)}
              accent="slate"
              icon={<DollarSign size={40} className="drop-shadow-sm" />}
            />
            <StatCard
              title="Ventas Totales"
              value={formatCurrency(stats.totalSales)}
              accent="slate"
              icon={<TrendingUp size={40} className="drop-shadow-sm" />}
            />
          </div>

          {/* Quick Actions */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Package size={20} className="text-gray-700" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Accesos Rápidos</h2>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/tables')}
                  className="h-auto flex-col gap-3 p-4 sm:p-6 hover:bg-gray-50 transition-all duration-200 border-2 border-gray-200 hover:border-gray-300"
                >
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <Image src="/icons/mesa.ico" alt="Mesa" width={28} height={28} />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">Mesas</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/products')}
                  className="h-auto flex-col gap-3 p-4 sm:p-6 hover:bg-gray-50 transition-all duration-200 border-2 border-gray-200 hover:border-gray-300"
                >
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <Package size={28} className="text-gray-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">Productos</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/sales')}
                  className="h-auto flex-col gap-3 p-4 sm:p-6 hover:bg-gray-50 transition-all duration-200 border-2 border-gray-200 hover:border-gray-300"
                >
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <TrendingUp size={28} className="text-gray-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">Ventas</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/workers')}
                  className="h-auto flex-col gap-3 p-4 sm:p-6 hover:bg-gray-50 transition-all duration-200 border-2 border-gray-200 hover:border-gray-300"
                >
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <Users size={28} className="text-gray-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">Empleados</span>
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
