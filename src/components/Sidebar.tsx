"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { TenantConfig } from '@/types/database.types';
import { 
  LayoutDashboard, 
  Grid3x3, 
  Package, 
  ShoppingCart, 
  LogOut,
  Users,
  UserCheck,
  TrendingUp,
  Settings,
  Building2
} from 'lucide-react';
import { SimpleThemeToggle } from '@/components/ui/theme-toggle';
import { NotificationsDropdown } from '@/components/ui/notifications';
import { Sidebar as UiSidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from '@/components/ui/sidebar';

interface SidebarProps {
  role: 'admin' | 'worker' | 'super_admin';
  username: string;
}

export default function Sidebar({ role, username }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [user, setUser] = useState<{ id: number; tenant_id: number } | null>(null);

  useEffect(() => {
    // Load tenant config and user data
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser({ id: parsedUser.id, tenant_id: parsedUser.tenant_id });
      loadTenantConfig(parsedUser.tenant_id);
    }
  }, []);

  const loadTenantConfig = async (tid: number) => {
    try {
      const { data, error } = await supabase
        .from('tenant_config')
        .select('*')
        .eq('tenant_id', tid)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error cargando configuración del tenant:', error);
        return;
      }

      if (data) {
        setTenantConfig(data);
      }
    } catch (error) {
      console.error('Error en loadTenantConfig:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  const adminLinks = [
    { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/admin/tables', icon: Grid3x3, label: 'Mesas' },
    { href: '/admin/products', icon: Package, label: 'Productos' },
    { href: '/admin/clients', icon: UserCheck, label: 'Clientes' },
    { href: '/admin/sales', icon: ShoppingCart, label: 'Ventas' },
    { href: '/admin/stats', icon: TrendingUp, label: 'Estadísticas' },
    { href: '/admin/workers', icon: Users, label: 'Empleados' },
    { href: '/admin/settings', icon: Settings, label: 'Configuración' },
  ];

  const workerLinks = [
    { href: '/worker/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/worker/tables', icon: Grid3x3, label: 'Mesas' },
    { href: '/worker/pos', icon: ShoppingCart, label: 'Punto de Venta' },
    { href: '/worker/clients', icon: UserCheck, label: 'Clientes' },
    { href: '/worker/earnings', icon: TrendingUp, label: 'Ingresos Hoy' },
  ];

  const superAdminLinks = [
    { href: '/super-admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/super-admin/tenants', icon: Grid3x3, label: 'Negocios' },
    { href: '/super-admin/admins', icon: Users, label: 'Administradores' },
  ];

  const links = role === 'admin' ? adminLinks : role === 'worker' ? workerLinks : superAdminLinks;

  // Usar configuración del tenant o valores por defecto
  const businessName = tenantConfig?.business_name || 'BillarExpert';
  const logoUrl = '/pngs/logologin.png'; // Siempre usar logo por defecto

  return (
    <UiSidebar className="border-r border-gray-200" collapsible="icon">
      <SidebarHeader className="border-b border-gray-200 p-4">
        <div className="flex flex-col gap-4">
          {/* Controles superiores - Profesionales y visibles */}
          <div className="flex items-center justify-center gap-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
            <SimpleThemeToggle />
            {role === 'admin' && user && (
              <NotificationsDropdown userId={user.id} tenantId={user.tenant_id} />
            )}
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {role === 'admin' ? 'Controles Admin' : 'Configuración'}
            </div>
          </div>
          
          {/* Logo y usuario */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-md border border-gray-300 dark:border-gray-600">
              {logoUrl ? (
                <Image 
                  src={logoUrl} 
                  alt={businessName} 
                  width={64} 
                  height={64} 
                  className="object-contain p-1"
                  onError={(e) => {
                    // Fallback if image fails to load
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Building2 size={40} className="text-gray-600 dark:text-gray-400" />
              )}
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg w-full border border-gray-200 dark:border-gray-700 shadow-sm">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate text-center">{username}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 capitalize mt-1 text-center font-semibold">
                {role.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold px-3 py-2">Menú</SidebarGroupLabel>
          <SidebarMenu>
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <SidebarMenuItem key={link.href}>
                  <SidebarMenuButton asChild isActive={isActive} className="h-11 text-base">
                    <Link href={link.href} className="flex items-center gap-3 px-3">
                      <Icon size={22} />
                      <span className="font-medium">{link.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-5 border-t dark:border-gray-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 transition-all duration-200 text-base font-bold border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
        >
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </SidebarFooter>
    </UiSidebar>
  );
}
