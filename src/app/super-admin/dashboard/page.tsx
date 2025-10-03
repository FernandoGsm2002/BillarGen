"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { User } from '@/types/database.types';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatCard, Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Building2, Users, TrendingUp, Grid3x3, Package, DollarSign } from 'lucide-react';

interface TenantStats {
  tenant_id: number;
  tenant_name: string;
  total_workers: number;
  total_tables: number;
  total_products: number;
  active_rentals: number;
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number | null } | null>(null);
  const [admins, setAdmins] = useState<User[]>([]);
  const [tenantStats, setTenantStats] = useState<TenantStats[]>([]);
  const [totalTenants, setTotalTenants] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    username: '',
    password: '',
    tenant_name: ''
  });

  useEffect(() => {
    // Verificar autenticación
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'super_admin') {
      router.push('/login');
      return;
    }

    setUser(parsedUser);
    loadAdmins();
    loadStats();
  }, [router]);

  const loadAdmins = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*, tenants(name)')
      .eq('role', 'admin')
      .order('created_at', { ascending: false });

    if (data) {
      setAdmins(data as User[]);
    }
  };

  const loadStats = async () => {
    // Obtener total de tenants
    const { data: tenantsData } = await supabase
      .from('tenants')
      .select('*');
    
    if (tenantsData) {
      setTotalTenants(tenantsData.length);
      
      // Obtener estadísticas por tenant
      const stats: TenantStats[] = [];
      
      for (const tenant of tenantsData) {
        // Contar workers
        const { data: workers } = await supabase
          .from('users')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('role', 'worker');
        
        // Contar mesas
        const { data: tables } = await supabase
          .from('tables')
          .select('id')
          .eq('tenant_id', tenant.id);
        
        // Contar productos
        const { data: products } = await supabase
          .from('products')
          .select('id')
          .eq('tenant_id', tenant.id);
        
        // Contar rentas activas
        const { data: rentals } = await supabase
          .from('rentals')
          .select('id')
          .eq('tenant_id', tenant.id)
          .is('end_time', null);
        
        stats.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          total_workers: workers?.length || 0,
          total_tables: tables?.length || 0,
          total_products: products?.length || 0,
          active_rentals: rentals?.length || 0
        });
      }
      
      setTenantStats(stats);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Crear tenant
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert([{ name: newAdmin.tenant_name }])
        .select()
        .single();

      if (tenantError) throw tenantError;

      // Crear usuario admin
      const { error: userError } = await supabase
        .from('users')
        .insert([{
          username: newAdmin.username,
          password: newAdmin.password, // En producción, hashear la contraseña
          role: 'admin',
          tenant_id: tenantData.id,
          created_by: user?.id || null
        }]);

      if (userError) throw userError;

      // Resetear formulario y recargar
      setNewAdmin({ username: '', password: '', tenant_name: '' });
      setShowCreateModal(false);
      loadAdmins();
      loadStats();
    } catch (error) {
      console.error('Error creating admin:', error);
      alert('Error al crear administrador');
    }
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
        <Sidebar role="super_admin" username={user.username} />
        
        <div className="flex-1 overflow-auto">
          {/* Header */}
          <div className="bg-card border-b">
            <div className="px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-muted rounded-xl">
                  <Building2 size={32} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Panel Super Admin</h1>
                  <p className="text-base text-muted-foreground mt-1">Gestión de negocios y administradores</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-4 md:p-6 lg:p-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <StatCard
            title="Total Negocios"
            value={totalTenants}
            accent="slate"
            icon={<Building2 size={40} />}
          />
          <StatCard
            title="Administradores"
            value={admins.length}
            accent="blue"
            icon={<Users size={40} />}
          />
          <StatCard
            title="Rentas Activas"
            value={tenantStats.reduce((sum, t) => sum + t.active_rentals, 0)}
            accent="emerald"
            icon={<TrendingUp size={40} />}
          />
        </div>

        {/* Tenant Statistics */}
        {tenantStats.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold">Estadísticas por Negocio</h2>
            </CardHeader>
            <CardBody className="p-0">
              <table className="min-w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Negocio</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empleados</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mesas</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Productos</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rentas Activas</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tenantStats.map((stat) => (
                    <tr key={stat.tenant_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {stat.tenant_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stat.total_workers}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stat.total_tables}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stat.total_products}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          stat.active_rentals > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {stat.active_rentals}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        )}
        
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Administradores</h2>
              <Button
                onClick={() => setShowCreateModal(true)}
                size="lg"
                className="gap-2"
              >
                + Crear Administrador
              </Button>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <table className="min-w-full">
              <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Negocio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha de Creación
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {admins.map((admin) => (
                <tr key={admin.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {admin.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {admin.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(admin as { tenants?: { name: string } }).tenants?.name || `Tenant ${admin.tenant_id}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(admin.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </CardBody>
        </Card>
        </div>
        </div>
      </div>

      {/* Create Admin Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Administrador</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Nombre del Negocio (Tenant)
              </label>
              <Input
                type="text"
                value={newAdmin.tenant_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAdmin({ ...newAdmin, tenant_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Usuario
              </label>
              <Input
                type="text"
                value={newAdmin.username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAdmin({ ...newAdmin, username: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Contraseña
              </label>
              <Input
                type="password"
                value={newAdmin.password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                required
              />
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                Crear
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </SidebarProvider>
  );
}
