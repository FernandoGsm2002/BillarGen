"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  LayoutDashboard, 
  Grid3x3, 
  Package, 
  ShoppingCart, 
  LogOut,
  Users,
  UserCheck,
  TrendingUp
} from 'lucide-react';
import { Sidebar as UiSidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarProvider } from '@/components/ui/sidebar';

interface SidebarProps {
  role: 'admin' | 'worker' | 'super_admin';
  username: string;
}

export default function Sidebar({ role, username }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

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

  return (
    <UiSidebar className="border-r" collapsible="icon">
      <SidebarHeader className="border-b p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <Image src="/pngs/lacapilla.png" alt="La Capilla" width={52} height={52} className="object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">La Capilla</h1>
            <p className="text-base text-muted-foreground uppercase tracking-wide">Billar</p>
          </div>
        </div>
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-base font-semibold truncate">{username}</p>
          <p className="text-sm text-muted-foreground capitalize mt-1">{role.replace('_', ' ')}</p>
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
