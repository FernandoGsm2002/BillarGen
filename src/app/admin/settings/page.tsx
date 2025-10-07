"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { TenantConfig } from '@/types/database.types';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Settings, Building2, Save } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    business_name: '',
    ruc: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    description: ''
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
    loadConfig(parsedUser.tenant_id);
  }, [router]);

  const loadConfig = async (tenantId: number) => {
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
        setConfig(data);
        setFormData({
          business_name: data.business_name || '',
          ruc: data.ruc || '',
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          description: data.description || ''
        });
      }
    } catch (error) {
      console.error('Error en loadConfig:', error);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const configData = {
        tenant_id: user.tenant_id,
        business_name: formData.business_name || null,
        ruc: formData.ruc || null,
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        website: formData.website || null,
        description: formData.description || null,
        updated_at: new Date().toISOString()
      };

      if (config) {
        // Update existing config
        const { error } = await supabase
          .from('tenant_config')
          .update(configData)
          .eq('tenant_id', user.tenant_id);

        if (error) throw error;
      } else {
        // Insert new config
        const { error } = await supabase
          .from('tenant_config')
          .insert([configData]);

        if (error) throw error;
      }

      alert('✅ Configuración guardada exitosamente');
      loadConfig(user.tenant_id);
    } catch (error) {
      console.error('Error guardando configuración:', error);
      alert('❌ Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
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
                  <Settings size={32} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Configuración</h1>
                  <p className="text-base text-muted-foreground mt-1">Personaliza tu negocio</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-4 md:p-6 lg:p-8">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 size={24} />
                  <h2 className="text-2xl font-bold">Información de la Empresa</h2>
                </div>
              </CardHeader>
              <CardBody>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Business Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Nombre de la Empresa *
                      </label>
                      <Input
                        value={formData.business_name}
                        onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                        placeholder="Ej: La Capilla Billar"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        RUC (opcional)
                      </label>
                      <Input
                        value={formData.ruc}
                        onChange={(e) => setFormData({ ...formData, ruc: e.target.value })}
                        placeholder="Ej: 20123456789"
                        maxLength={11}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Teléfono (opcional)
                      </label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="Ej: 987654321"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Dirección (opcional)
                      </label>
                      <Input
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Ej: Av. Principal 123, Lima"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Email (opcional)
                      </label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Ej: info@lacapilla.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Sitio Web (opcional)
                      </label>
                      <Input
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        placeholder="Ej: https://www.lacapilla.com"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Descripción (opcional)
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Breve descripción de tu negocio..."
                        className="w-full px-3 py-2 border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        rows={4}
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        loadConfig(user.tenant_id);
                      }}
                      disabled={loading}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="min-w-[120px]"
                    >
                      {loading ? (
                        'Guardando...'
                      ) : (
                        <>
                          <Save size={20} className="mr-2" />
                          Guardar
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>

            {/* Information Card */}
            <Card className="mt-6">
              <CardBody>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building2 size={24} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Información de la Empresa</h3>
                    <p className="text-sm text-gray-600">
                      La información de tu empresa aparecerá en el sidebar y en los reportes del sistema. 
                      Esto ayuda a personalizar la experiencia y dar una imagen más profesional a tu negocio.
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      <strong>Nota:</strong> Todos los campos son opcionales excepto el nombre de la empresa.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}

