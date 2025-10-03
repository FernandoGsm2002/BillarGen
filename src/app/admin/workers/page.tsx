"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { User } from '@/types/database.types';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatCard, Card, CardBody } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Users as UsersIcon } from 'lucide-react';

export default function WorkersPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [workers, setWorkers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '' });

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
    loadWorkers(parsedUser.tenant_id);
  }, [router]);

  const loadWorkers = async (tenantId: number) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('role', 'worker')
      .order('created_at', { ascending: false });

    if (data) setWorkers(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase
      .from('users')
      .insert([{
        username: formData.username,
        password: formData.password,
        role: 'worker',
        tenant_id: user.tenant_id,
        created_by: user.id
      }]);

    if (!error) {
      setFormData({ username: '', password: '' });
      setShowModal(false);
      loadWorkers(user.tenant_id);
    } else {
      alert('Error al crear empleado: ' + error.message);
    }
  };

  const handleDelete = async (workerId: number) => {
    if (!user) return;
    if (!confirm('¿Eliminar este empleado?')) return;

    await supabase
      .from('users')
      .delete()
      .eq('id', workerId);

    loadWorkers(user.tenant_id);
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
                <UsersIcon size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Empleados</h1>
                <p className="text-base text-muted-foreground mt-1">Gestiona los trabajadores</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 lg:p-8">
          <div className="mb-6">
            <StatCard
              title="Total Empleados"
              value={workers.length}
              accent="slate"
              icon={<UsersIcon size={40} />}
              className="max-w-sm"
            />
          </div>
          
          <div className="flex justify-end mb-6">

            <Button
              size="lg"
              onClick={() => setShowModal(true)}
              className="gap-2"
            >
              <Plus size={20} />
              Agregar Empleado
            </Button>
          </div>

          <Card>
            <CardBody className="p-0">
              <table className="min-w-full">
                <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha de Creación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                          <UsersIcon size={20} />
                        </div>
                        <span className="font-semibold text-base">{worker.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(worker.created_at).toLocaleDateString('es-PE')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(worker.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        {workers.length === 0 && (
          <div className="text-center py-16">
            <UsersIcon size={64} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No hay empleados</h3>
            <p className="text-gray-700 mb-6 font-medium">Comienza agregando tu primer empleado</p>
            <Button
              size="lg"
              onClick={() => setShowModal(true)}
              className="gap-2"
            >
              <Plus size={20} />
              Agregar Empleado
            </Button>
          </div>
        )}
        </div>
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Empleado</DialogTitle>
          </DialogHeader>
            
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Usuario
              </label>
              <Input
                type="text"
                value={formData.username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, username: e.target.value })}
                required
                placeholder="Nombre de usuario"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Contraseña
              </label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, password: e.target.value })}
                required
                placeholder="Contraseña"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setFormData({ username: '', password: '' });
                }}
              >
                Cancelar
              </Button>
              <Button type="submit">
                Crear Empleado
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </SidebarProvider>
  );
}
