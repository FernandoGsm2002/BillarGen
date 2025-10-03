"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Table } from '@/types/database.types';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Plus } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatCard, Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import TableCard from '@/components/TableCard';

export default function TablesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [formData, setFormData] = useState({ name: '', hourly_rate: '10.00' });

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
    loadTables(parsedUser.tenant_id);
  }, [router]);

  const loadTables = async (tenantId: number) => {
    const { data } = await supabase
      .from('tables')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (data) setTables(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingTable) {
      // Actualizar mesa existente
      const { error } = await supabase
        .from('tables')
        .update({
          name: formData.name,
          hourly_rate: parseFloat(formData.hourly_rate)
        })
        .eq('id', editingTable.id);

      if (!error) {
        setShowModal(false);
        setEditingTable(null);
        setFormData({ name: '', hourly_rate: '10.00' });
        if (user) loadTables(user.tenant_id);
      } else {
        alert('Error al actualizar mesa: ' + error.message);
      }
    } else {
      // Crear nueva mesa
      const { error } = await supabase
        .from('tables')
        .insert([{
          name: formData.name,
          hourly_rate: parseFloat(formData.hourly_rate),
          tenant_id: user?.tenant_id || 0,
          is_available: true
        }]);

      if (!error) {
        setShowModal(false);
        setFormData({ name: '', hourly_rate: '10.00' });
        if (user) loadTables(user.tenant_id);
      } else {
        alert('Error al crear mesa: ' + error.message);
      }
    }
  };

  const handleDelete = async (table: Table) => {
    if (!table.is_available) {
      alert('No se puede eliminar una mesa ocupada. Finaliza la renta primero.');
      return;
    }

    if (!confirm(`¿Eliminar la mesa "${table.name}"?`)) return;

    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', table.id);

    if (!error && user) {
      loadTables(user.tenant_id);
    } else if (error) {
      alert('Error al eliminar mesa: ' + error.message);
    }
  };

  const handleEdit = (table: Table) => {
    setEditingTable(table);
    setFormData({
      name: table.name,
      hourly_rate: table.hourly_rate.toString()
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTable(null);
    setFormData({ name: '', hourly_rate: '10.00' });
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        <Sidebar role={(user.role as 'admin' | 'worker' | 'super_admin') || 'admin'} username={user.username} />
      
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-card border-b">
          <div className="px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="md:hidden" />
              <div className="p-4 bg-muted rounded-xl">
                <Image src="/icons/mesa.ico" alt="Mesa" width={32} height={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Mesas</h1>
                <p className="text-base text-muted-foreground mt-1">Administra las mesas de billar</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 lg:p-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard
              title="Total Mesas"
              value={tables.length}
              accent="slate"
              icon={<Image src="/icons/mesa.ico" alt="Mesa" width={40} height={40} />}
            />
            <StatCard
              title="Disponibles"
              value={tables.filter(t => t.is_available).length}
              accent="emerald"
              icon={<Image src="/icons/mesa.ico" alt="Mesa" width={40} height={40} />}
            />
            <StatCard
              title="Ocupadas"
              value={tables.filter(t => !t.is_available).length}
              accent="red"
              icon={<Image src="/icons/mesa.ico" alt="Mesa" width={40} height={40} />}
            />
          </div>

          {/* Add Button */}
          <div className="mb-6">
            <Button
              onClick={() => setShowModal(true)}
              size="lg"
              className="gap-2"
            >
              <Plus size={20} />
              Agregar Mesa
            </Button>
          </div>

          {/* Tables Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {tables.map((table) => (
              <TableCard
                key={table.id}
                name={table.name}
                hourlyRate={table.hourly_rate}
                status={table.is_available ? 'available' : 'occupied'}
                onPrimary={() => handleEdit(table)}
                onSecondary={() => handleDelete(table)}
                primaryLabel="Editar"
                secondaryLabel="Eliminar"
                disabledSecondary={!table.is_available}
              />
            ))}
          </div>

          {tables.length === 0 && (
            <div className="text-center py-16 bg-card rounded-xl shadow-lg">
              <Image src="/icons/mesa.ico" alt="Mesa" width={64} height={64} className="mx-auto mb-4 opacity-40" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No hay mesas</h3>
              <p className="text-gray-700 mb-6 font-medium">Comienza agregando tu primera mesa de billar</p>
              <Button
                onClick={() => setShowModal(true)}
                size="lg"
                className="gap-2"
              >
                <Plus size={20} />
                Agregar Primera Mesa
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTable ? 'Editar Mesa' : 'Agregar Nueva Mesa'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Nombre de la Mesa
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Ej: Mesa 1, Mesa VIP, Sala A"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Precio por Hora (S/)
              </label>
              <Input
                type="number"
                value={formData.hourly_rate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, hourly_rate: e.target.value })}
                required
                min="0"
                step="0.50"
                placeholder="10.00"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseModal}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {editingTable ? 'Actualizar' : 'Crear Mesa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </SidebarProvider>
  );
}
