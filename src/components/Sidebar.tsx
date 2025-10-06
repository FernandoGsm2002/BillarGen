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
import { Sidebar as UiSidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarProvider } from '@/components/ui/sidebar';

interface SidebarProps {
  role: 'admin' | 'worker' | 'super_admin';
  username: string;
}

export default function Sidebar({ role, username }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [tenantId, setTenantId] = useState<number | null>(null);

  useEffect(() => {
    // Load tenant config
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setTenantId(parsedUser.tenant_id);
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
  ];

  const superAdminLinks = [
    { href: '/super-admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/super-admin/tenants', icon: Grid3x3, label: 'Negocios' },
    { href: '/super-admin/admins', icon: Users, label: 'Administradores' },
  ];

  const links = role === 'admin' ? adminLinks : role === 'worker' ? workerLinks : superAdminLinks;

  // Usar configuración del tenant o valores por defecto
  const businessName = tenantConfig?.business_name || 'La Capilla';
  const businessType = 'Billar';
  const logoUrl = tenantConfig?.logo_url || '/pngs/lacapilla.png';

  return (
    <UiSidebar className="border-r border-gray-200" collapsible="icon">
      <SidebarHeader className="border-b border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
            {logoUrl ? (
              <Image 
                src={logoUrl} 
                alt={businessName} 
                width={40} 
                height={40} 
                className="object-contain"
                onError={(e) => {
                  // Fallback if image fails to load
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Building2 size={24} className="text-gray-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-gray-900 leading-tight"
                style={{ 
                  wordBreak: 'break-word',
                  hyphens: 'auto',
                  lineHeight: '1.2'
                }}>
              {businessName}
            </h1>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{businessType}</p>
            {tenantConfig?.ruc && (
              <p className="text-xs text-gray-400 truncate">RUC: {tenantConfig.ruc}</p>
            )}
          </div>
        </div>
        <div className="p-3 bg-gray-100 rounded-lg">
          <p className="text-sm font-semibold text-gray-900 truncate">{username}</p>
          <p className="text-xs text-gray-600 capitalize mt-1">{role.replace('_', ' ')}</p>
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

      <SidebarFooter className="p-5 border-t">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg hover:bg-accent transition-colors text-base font-medium"
        >
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </SidebarFooter>
    </UiSidebar>
  );
}
