"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Table, Client } from '@/types/database.types';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/Badge';
import Image from 'next/image';
import { Package, Clock, DollarSign } from 'lucide-react';

interface RentalWithDetails {
  id: number;
  start_time: string;
  tables: { name: string; hourly_rate: number } | null;
  clients: { name: string; phone: string | null } | null;
}

export default function WorkerTablesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [activeRentals, setActiveRentals] = useState<RentalWithDetails[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [endingRental, setEndingRental] = useState<RentalWithDetails | null>(null);
  const [rentalSales, setRentalSales] = useState<Array<{ id: number; total_amount: number; is_paid: boolean; quantity: number; products?: { name: string } }>>([]);

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

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  const loadData = async (tenantId: number) => {
    const { data: tablesData } = await supabase
      .from('tables')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    const { data: rentalsData } = await supabase
      .from('rentals')
      .select('*, clients(name, phone), tables(name, hourly_rate)')
      .eq('tenant_id', tenantId)
      .is('end_time', null);

    const { data: clientsData } = await supabase
      .from('clients')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (tablesData) setTables(tablesData);
    if (rentalsData) setActiveRentals(rentalsData as RentalWithDetails[]);
    if (clientsData) setClients(clientsData as Client[]);
  };

  const handleStartRental = (table: Table) => {
    setSelectedTable(table);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTable) return;

    try {
      // Crear renta (client_id puede ser NULL para clientes anónimos)
      await supabase
        .from('rentals')
        .insert([{
          tenant_id: user.tenant_id,
          client_id: selectedClientId || null,
          table_id: selectedTable.id,
          start_time: new Date().toISOString()
        }]);

      // Marcar mesa como ocupada
      await supabase
        .from('tables')
        .update({ is_available: false })
        .eq('id', selectedTable.id);

      setSelectedClientId(null);
      setShowModal(false);
      setSelectedTable(null);
      loadData(user.tenant_id);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al iniciar renta');
    }
  };

  const calculateElapsedTime = (startTime: string) => {
    const start = new Date(startTime);
    const now = currentTime;
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    return { hours, minutes, seconds, totalHours: diffMs / (1000 * 60 * 60) };
  };

  const calculateAmount = (startTime: string, hourlyRate: number) => {
    const { totalHours } = calculateElapsedTime(startTime);
    return totalHours * hourlyRate;
  };

  const handleEndRental = async (rental: RentalWithDetails) => {
    if (!user) return;

    // Obtener ventas asociadas a esta renta
    const { data: salesData } = await supabase
      .from('sales')
      .select('*, products(name)')
      .eq('rental_id', rental.id);

    setEndingRental(rental);
    setRentalSales(salesData || []);
  };

  const confirmEndRental = async () => {
    if (!user || !endingRental) return;

    const elapsed = calculateElapsedTime(endingRental.start_time);
    const rentalAmount = calculateAmount(endingRental.start_time, endingRental.tables?.hourly_rate || 10);
    const consumptionAmount = rentalSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    const totalAmount = rentalAmount + consumptionAmount;

    // Preguntar si el cliente pagó
    const isPaid = confirm(`Total a pagar: S/ ${totalAmount.toFixed(2)}\n\n¿El cliente pagó la cuenta completa?`);

    try {
      // Buscar table_id de la renta
      const { data: rentalData } = await supabase
        .from('rentals')
        .select('table_id')
        .eq('id', endingRental.id)
        .single();

      // Actualizar renta con estado de pago (solo el monto de la renta, sin consumo)
      await supabase
        .from('rentals')
        .update({
          end_time: new Date().toISOString(),
          total_amount: rentalAmount,
          is_paid: isPaid
        })
        .eq('id', endingRental.id);

      // Marcar ventas según el pago
      if (rentalSales.length > 0) {
        await supabase
          .from('sales')
          .update({ is_paid: isPaid })
          .eq('rental_id', endingRental.id);
      }

      // Liberar mesa
      if (rentalData?.table_id) {
        await supabase
          .from('tables')
          .update({ is_available: true })
          .eq('id', rentalData.table_id);
      }

      setEndingRental(null);
      setRentalSales([]);
      
      // Recargar datos después de un pequeño delay para asegurar que la DB se actualizó
      setTimeout(() => {
        loadData(user.tenant_id);
      }, 500);
      
      alert(isPaid ? 'Renta finalizada y pagada' : 'Renta finalizada - Deuda registrada');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al finalizar renta');
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
        <div className="bg-card border-b">
          <div className="px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="md:hidden" />
              <div className="p-4 bg-muted rounded-xl">
                <Image src="/icons/mesa.ico" alt="Mesa" width={32} height={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Mesas</h1>
                <p className="text-base text-muted-foreground mt-1">Gestiona las rentas de mesas</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 lg:p-8">
          {/* Mesas Grid */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-6">Mesas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tables.map((table) => {
                const rental = activeRentals.find(r => r.tables?.name === table.name);
                const elapsed = rental ? calculateElapsedTime(rental.start_time) : null;
                const amount = rental ? calculateAmount(rental.start_time, table.hourly_rate) : 0;
                
                return (
                  <div key={table.id} className="relative">
                    <div className={`relative rounded-2xl overflow-hidden border shadow-sm bg-card ${
                      table.is_available ? 'border-green-200' : 'border-red-200'
                    }`}>
                      <div className="relative w-full aspect-[4/5] min-h-[360px]">
                        <Image
                          src="/pngs/mesas.png"
                          alt="Mesa de billar"
                          fill
                          priority={false}
                          className="object-cover rounded-2xl"
                          sizes="(max-width: 768px) 100vw, 320px"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                        {/* Info overlay */}
                        <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                          <div className="space-y-3">
                            {/* Header con nombre y estado */}
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="text-xl md:text-2xl font-semibold text-white drop-shadow-sm">{table.name}</h3>
                                <p className="text-sm md:text-base font-medium text-white/90 drop-shadow-sm">S/ {table.hourly_rate.toFixed(2)} / hora</p>
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur border ${
                                table.is_available
                                  ? 'bg-green-100/80 text-green-900 border-green-300'
                                  : 'bg-red-100/80 text-red-900 border-red-300'
                              }`}>
                                {table.is_available ? 'Disponible' : 'Ocupada'}
                              </span>
                            </div>

                            {/* Info de renta activa */}
                            {rental && elapsed && (
                              <div className="bg-black/40 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-white">
                                    <span className="text-xs font-medium">Cliente:</span>
                                    <span className="text-sm font-semibold">{rental.clients?.name}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-white/90">Tiempo:</span>
                                    <span className="font-mono font-bold text-blue-300 text-lg">
                                      {String(elapsed.hours).padStart(2, '0')}:{String(elapsed.minutes).padStart(2, '0')}:{String(elapsed.seconds).padStart(2, '0')}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-white/90">Monto:</span>
                                    <span className="text-lg font-bold text-emerald-300">S/ {amount.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Botón de acción */}
                            <Button
                              onClick={() => table.is_available ? handleStartRental(table) : rental && handleEndRental(rental)}
                              disabled={!table.is_available && !rental}
                              variant={!table.is_available && rental ? 'default' : table.is_available ? 'default' : 'secondary'}
                              className={`w-full ${
                                !table.is_available && rental
                                  ? 'bg-blue-600 hover:bg-blue-700'
                                  : ''
                              }`}
                            >
                              {table.is_available ? 'Iniciar Renta' : rental ? 'Finalizar Renta' : 'Ocupada'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Iniciar Renta */}
      <Dialog open={showModal && selectedTable !== null} onOpenChange={(open) => { if (!open) { setShowModal(false); setSelectedTable(null); setSelectedClientId(null); }}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar Renta - {selectedTable?.name}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tarifa: <span className="font-bold">S/ {selectedTable?.hourly_rate.toFixed(2)}/hora</span>
            </p>

            <div>
              <label className="block text-sm font-medium mb-2">Seleccionar Cliente</label>
              <select
                value={selectedClientId ?? ''}
                onChange={(e) => setSelectedClientId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Cliente Anónimo (Sin registrar)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` - ${c.phone}` : ''}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-2">
                Si no seleccionas un cliente, la renta será anónima. Puedes crear clientes desde <a href="/worker/clients" className="underline">Clientes</a>.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowModal(false); setSelectedTable(null); setSelectedClientId(null); }}
              >
                Cancelar
              </Button>
              <Button type="submit">
                Iniciar Renta
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Finalizar Renta */}
      <Dialog open={endingRental !== null} onOpenChange={(open) => !open && setEndingRental(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Finalizar Renta - {endingRental?.tables?.name}</DialogTitle>
          </DialogHeader>
          
          {endingRental && (
            <div className="space-y-4">
              {/* Cliente */}
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground font-semibold mb-1">Cliente</p>
                <p className="text-lg font-bold">{endingRental.clients?.name}</p>
                {endingRental.clients?.phone && (
                  <p className="text-sm text-muted-foreground">{endingRental.clients.phone}</p>
                )}
              </div>

              {/* Tiempo y Monto de Mesa */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={20} className="text-blue-600" />
                    <p className="text-sm text-blue-700 font-semibold">Tiempo</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 font-mono">
                    {(() => {
                      const elapsed = calculateElapsedTime(endingRental.start_time);
                      return `${elapsed.hours}h ${elapsed.minutes}m`;
                    })()}
                  </p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign size={20} className="text-emerald-600" />
                    <p className="text-sm text-emerald-700 font-semibold">Costo Mesa</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">
                    S/ {calculateAmount(endingRental.start_time, endingRental.tables?.hourly_rate || 10).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Consumo */}
              {rentalSales.length > 0 && (
                <div>
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <Package size={20} />
                    Consumo
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold">Producto</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold">Cant.</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {rentalSales.map((sale) => (
                          <tr key={sale.id}>
                            <td className="px-4 py-2 text-sm">{sale.products?.name || 'N/A'}</td>
                            <td className="px-4 py-2 text-center font-semibold">{sale.quantity}</td>
                            <td className="px-4 py-2 text-right font-bold text-green-600">
                              S/ {Number(sale.total_amount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-muted/30 font-bold">
                          <td className="px-4 py-2" colSpan={2}>Subtotal Consumo</td>
                          <td className="px-4 py-2 text-right text-green-600">
                            S/ {rentalSales.reduce((sum, s) => sum + Number(s.total_amount), 0).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Total Final */}
              <div className="p-5 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border-2 border-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-slate-900">TOTAL A COBRAR</span>
                  <span className="text-3xl font-bold text-slate-900">
                    S/ {(
                      calculateAmount(endingRental.start_time, endingRental.tables?.hourly_rate || 10) +
                      rentalSales.reduce((sum, s) => sum + Number(s.total_amount), 0)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setEndingRental(null); setRentalSales([]); }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={confirmEndRental}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Confirmar y Cobrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </SidebarProvider>
  );
}
