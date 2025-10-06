"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Product } from '@/types/database.types';
import { recordStockChange } from '@/lib/stockUtils';
import Sidebar from '@/components/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import ProductCard from '@/components/ProductCard';
import { StatCard, Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Plus, Trash2, Edit, Package as PackageIcon, DollarSign, TrendingDown, Search, X, BarChart3, Calendar, History, TrendingUp as TrendingUpIcon } from 'lucide-react';
import Image from 'next/image';

const AVAILABLE_IMAGES = [
  { value: '/pngs/pilsen.png', label: 'Pilsen' },
  { value: '/pngs/corona.png', label: 'Corona' },
  { value: '/pngs/heineken.png', label: 'Heineken' },
  { value: '/pngs/cristal.png', label: 'Cristal' },
  { value: '/pngs/lacapilla.png', label: 'La Capilla' },
  { value: '/pngs/cigarro.png', label: 'Cigarro' },
  { value: '/pngs/halls.png', label: 'Halls' },
  { value: '/pngs/trident.png', label: 'Trident' },
  { value: '/pngs/ron.png', label: 'Ron' },
  { value: '/pngs/solysombra.png', label: 'Sol y Sombra' },
  { value: '/pngs/pickeo.png', label: 'Pickeo' },
  { value: '/pngs/pisco.png', label: 'Pisco' },
  { value: '/pngs/vino.png', label: 'Vino' },
];

export default function ProductsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; tenant_id: number } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showStockHistoryModal, setShowStockHistoryModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);
  const [stockHistory, setStockHistory] = useState<Array<{
    id: number;
    change_type: string;
    quantity_change: number;
    stock_before: number;
    stock_after: number;
    reason: string | null;
    created_at: string;
    user_id: number | null;
    users?: { username: string } | null;
  }>>([]);
  const [stockReport, setStockReport] = useState<Array<{
    product: Product;
    initial_stock: number;
    current_stock: number;
    sold_during_session: number;
    difference: number;
    has_snapshot: boolean;
  }>>([]);
  const [sessionFinancials, setSessionFinancials] = useState<{
    total_sales_revenue: number;
    total_rentals_revenue: number;
    total_revenue: number;
    products_sold: number;
    rentals_completed: number;
    average_sale: number;
    session_duration: string;
  } | null>(null);
  const [currentSession, setCurrentSession] = useState<{
    id: number;
    session_name: string;
    start_time: string;
    is_active: boolean;
  } | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    price: '', 
    stock: '0',
    image_url: '/pngs/pilsen.png'
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
    loadProducts(parsedUser.tenant_id);
    loadCurrentSession(parsedUser.tenant_id);
  }, [router]);

  const loadProducts = async (tenantId: number) => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (data) {
      setProducts(data);
      setFilteredProducts(data);
    }
  };

  const loadCurrentSession = async (tenantId: number) => {
    try {
      const { data, error } = await supabase
        .from('daily_sessions')
        .select('id, session_name, start_time, is_active')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();

      if (error) {
        // Si la tabla no existe o no hay sesiones activas, es normal
        if (error.code === 'PGRST116' || error.message.includes('relation "daily_sessions" does not exist')) {
          console.log('No hay sesiones activas o la tabla daily_sessions no existe aún');
          return;
        }
        console.error('Error cargando sesión actual:', error);
        return;
      }

      if (data) {
        setCurrentSession(data);
        console.log('Sesión activa cargada:', data);
      }
    } catch (error) {
      console.error('Error en loadCurrentSession:', error);
    }
  };

  // Debounce para búsqueda (espera 1 segundo después de que el usuario deja de escribir)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim() === '') {
        setFilteredProducts(products);
      } else {
        const filtered = products.filter(product =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredProducts(filtered);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchTerm, products]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const newStock = parseInt(formData.stock);
      
      if (editingProduct) {
        const oldStock = editingProduct.stock;
        const stockChange = newStock - oldStock;
        
        await supabase
          .from('products')
          .update({
            name: formData.name,
            price: parseFloat(formData.price),
            stock: newStock,
            image_url: formData.image_url
          })
          .eq('id', editingProduct.id);

        // Registrar cambio de stock si hubo modificación
        if (stockChange !== 0) {
          await recordStockChange({
            tenantId: user.tenant_id,
            productId: editingProduct.id,
            userId: user.id,
            changeType: stockChange > 0 ? 'increase' : 'adjustment',
            quantityChange: stockChange,
            stockBefore: oldStock,
            stockAfter: newStock,
            reason: stockChange > 0 
              ? `Aumento de stock: +${stockChange} unidades` 
              : `Ajuste de stock: ${stockChange} unidades`
          });
        }
      } else {
        const { data: newProduct } = await supabase
          .from('products')
          .insert([{
            name: formData.name,
            price: parseFloat(formData.price),
            stock: newStock,
            image_url: formData.image_url,
            tenant_id: user.tenant_id,
            is_active: true
          }])
          .select()
          .single();

        // Registrar stock inicial del nuevo producto
        if (newProduct && newStock > 0) {
          await recordStockChange({
            tenantId: user.tenant_id,
            productId: newProduct.id,
            userId: user.id,
            changeType: 'initial',
            quantityChange: newStock,
            stockBefore: 0,
            stockAfter: newStock,
            reason: `Stock inicial del producto: ${newStock} unidades`
          });
        }
      }

      setFormData({ name: '', price: '', stock: '0', image_url: '/pngs/pilsen.png' });
      setEditingProduct(null);
      setShowModal(false);
      loadProducts(user.tenant_id);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar producto');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock.toString(),
      image_url: product.image_url || '/pngs/cerveza.png'
    });
    setShowModal(true);
  };

  const handleDelete = async (productId: number) => {
    if (!confirm('¿Eliminar este producto?')) return;

    await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (user) loadProducts(user.tenant_id);
  };

  const startDaySession = async () => {
    if (!user) return;
    
    // Verificar si ya hay una sesión activa
    if (currentSession) {
      alert('Ya hay una sesión activa. Termina la sesión actual antes de comenzar una nueva.');
      return;
    }

    // Verificar en la base de datos si hay alguna sesión activa
    const { data: activeSessions, error: checkError } = await supabase
      .from('daily_sessions')
      .select('id, session_name')
      .eq('tenant_id', user.tenant_id)
      .eq('is_active', true);

    if (checkError && !checkError.message.includes('relation "daily_sessions" does not exist')) {
      console.error('Error verificando sesiones activas:', checkError);
      alert('❌ Error al verificar sesiones activas');
      return;
    }

    if (activeSessions && activeSessions.length > 0) {
      alert(`Ya hay una sesión activa: "${activeSessions[0].session_name}". Termina la sesión actual antes de comenzar una nueva.`);
      // Cargar la sesión activa en el estado
      loadCurrentSession(user.tenant_id);
      return;
    }

    const sessionName = prompt('Nombre de la sesión (opcional):', `Día ${new Date().toLocaleDateString('es-PE')}`);
    if (sessionName === null) return; // Usuario canceló

    try {
      console.log('Iniciando sesión con datos:', {
        tenant_id: user.tenant_id,
        session_name: sessionName || `Día ${new Date().toLocaleDateString('es-PE')}`,
        created_by: user.id,
        start_time: new Date().toISOString(),
        is_active: true
      });

      // Verificar primero si la tabla existe
      const { error: testError } = await supabase
        .from('daily_sessions')
        .select('id')
        .limit(1);

      if (testError && testError.message.includes('relation "daily_sessions" does not exist')) {
        alert('⚠️ La tabla daily_sessions no existe. Por favor ejecuta primero la migración SQL (migration_daily_sessions.sql)');
        console.error('Tabla daily_sessions no existe:', testError);
        return;
      }

      // Crear nueva sesión
      const { data: sessionData, error: sessionError } = await supabase
        .from('daily_sessions')
        .insert([{
          tenant_id: user.tenant_id,
          session_name: sessionName || `Día ${new Date().toLocaleDateString('es-PE')}`,
          created_by: user.id,
          start_time: new Date().toISOString(),
          is_active: true
        }])
        .select()
        .single();

      if (sessionError) {
        console.error('Error creando sesión:', sessionError);
        alert(`Error creando sesión: ${sessionError.message}\n\n¿Has ejecutado la migración SQL?`);
        return;
      }

      console.log('Sesión creada exitosamente:', sessionData);

      // Verificar si la columna session_id existe en daily_stock_snapshots
      const { error: testSnapshotError } = await supabase
        .from('daily_stock_snapshots')
        .select('session_id')
        .limit(1);

      if (testSnapshotError && testSnapshotError.message.includes('column "session_id" does not exist')) {
        alert('⚠️ La columna session_id no existe en daily_stock_snapshots. Por favor ejecuta la migración SQL completa.');
        console.error('Columna session_id no existe:', testSnapshotError);
        return;
      }

      // Guardar el stock inicial de todos los productos para esta sesión
      const stockSnapshots = products.map(product => ({
        tenant_id: user.tenant_id,
        product_id: product.id,
        session_id: sessionData.id,
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format para compatibilidad
        initial_stock: product.stock
      }));

      console.log('Guardando snapshots de stock:', stockSnapshots);

      const { error: snapshotError } = await supabase
        .from('daily_stock_snapshots')
        .insert(stockSnapshots);

      if (snapshotError) {
        console.error('Error guardando snapshots:', snapshotError);
        alert(`Error guardando stock inicial: ${snapshotError.message}`);
        return;
      }

      console.log('Stock inicial guardado exitosamente');
      
      setCurrentSession(sessionData);
      alert(`✅ Sesión "${sessionData.session_name}" iniciada correctamente`);
    } catch (error) {
      console.error('Error iniciando sesión:', error);
      alert(`❌ Error al iniciar la sesión del día: ${error instanceof Error ? error.message : 'Error desconocido'}\n\n¿Has ejecutado la migración SQL?`);
    }
  };

  const endDaySession = async () => {
    if (!user || !currentSession) {
      alert('No hay una sesión activa para terminar.');
      return;
    }

    if (!confirm(`¿Terminar la sesión "${currentSession.session_name}"?`)) return;

    try {
      const sessionEndTime = new Date().toISOString();

      console.log('Terminando sesión:', currentSession.id);

      // Primero verificar que la sesión existe y está activa
      const { data: sessionCheck, error: checkError } = await supabase
        .from('daily_sessions')
        .select('id, is_active')
        .eq('id', currentSession.id)
        .eq('tenant_id', user.tenant_id)
        .single();

      if (checkError || !sessionCheck) {
        console.error('Error verificando sesión:', checkError);
        alert('❌ Error: No se pudo encontrar la sesión');
        return;
      }

      if (!sessionCheck.is_active) {
        console.log('La sesión ya está terminada');
        setCurrentSession(null);
        alert('⚠️ La sesión ya estaba terminada');
        return;
      }

      // Actualizar la sesión para marcarla como terminada
      const { error: updateError } = await supabase
        .from('daily_sessions')
        .update({
          end_time: sessionEndTime,
          is_active: false,
          updated_at: sessionEndTime
        })
        .eq('id', currentSession.id)
        .eq('tenant_id', user.tenant_id);

      if (updateError) {
        console.error('Error actualizando sesión:', updateError);
        alert('❌ Error al terminar la sesión en la base de datos');
        return;
      }

      console.log('Sesión terminada exitosamente');

      // Calcular datos financieros finales
      await calculateSessionFinancials(sessionEndTime);

      // Generar reporte final
      await generateSessionReport();
      
      // Limpiar estado local
      setCurrentSession(null);
      
      // Mostrar resumen financiero en el alert
      if (sessionFinancials) {
        alert(`✅ Sesión "${currentSession.session_name}" terminada correctamente\n\n💰 Resumen Financiero:\n• Ingresos Totales: S/ ${sessionFinancials.total_revenue.toFixed(2)}\n• Ventas: S/ ${sessionFinancials.total_sales_revenue.toFixed(2)}\n• Rentas: S/ ${sessionFinancials.total_rentals_revenue.toFixed(2)}\n• Duración: ${sessionFinancials.session_duration}`);
      } else {
        alert('✅ Sesión terminada correctamente');
      }

      // Recargar datos para asegurar consistencia
      setTimeout(() => {
        loadCurrentSession(user.tenant_id);
      }, 1000);

    } catch (error) {
      console.error('Error terminando sesión:', error);
      alert('❌ Error al terminar la sesión');
    }
  };

  const generateSessionReport = async () => {
    if (!user || !currentSession) {
      alert('No hay una sesión activa para generar el reporte.');
      return;
    }

    const sessionEndTime = new Date().toISOString();

    // Generar reporte de stock
    const report = await Promise.all(
      products.map(async (product) => {
        // Obtener stock inicial guardado para esta sesión
        const { data: snapshotData } = await supabase
          .from('daily_stock_snapshots')
          .select('initial_stock')
          .eq('tenant_id', user.tenant_id)
          .eq('product_id', product.id)
          .eq('session_id', currentSession.id)
          .single();

        // Obtener ventas durante esta sesión para este producto
        const { data: salesData } = await supabase
          .from('sales')
          .select('quantity')
          .eq('product_id', product.id)
          .gte('created_at', currentSession.start_time)
          .lt('created_at', sessionEndTime);

        const sold_during_session = salesData?.reduce((sum, sale) => sum + sale.quantity, 0) || 0;
        const current_stock = product.stock;
        const initial_stock = snapshotData?.initial_stock || current_stock + sold_during_session;
        const expected_stock = initial_stock - sold_during_session;
        const difference = current_stock - expected_stock;

        return {
          product,
          initial_stock,
          current_stock,
          sold_during_session,
          difference,
          has_snapshot: !!snapshotData
        };
      })
    );

    // Calcular datos financieros
    await calculateSessionFinancials(sessionEndTime);

    setStockReport(report);
    setShowStockModal(true);
  };

  const loadStockHistory = async (product: Product) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('stock_changes')
        .select(`
          *,
          users:user_id (username)
        `)
        .eq('tenant_id', user.tenant_id)
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
        .limit(50); // Últimos 50 cambios

      if (error) {
        console.error('Error cargando historial de stock:', error);
        return;
      }

      setStockHistory(data || []);
      setSelectedProductForHistory(product);
      setShowStockHistoryModal(true);
    } catch (error) {
      console.error('Error en loadStockHistory:', error);
    }
  };

  const calculateSessionFinancials = async (sessionEndTime: string) => {
    if (!user || !currentSession) return;

    try {
      // Obtener ingresos por ventas de productos (incluye consumos en mesas)
      const { data: salesData } = await supabase
        .from('sales')
        .select('total_amount, quantity')
        .eq('tenant_id', user.tenant_id)
        .gte('created_at', currentSession.start_time)
        .lt('created_at', sessionEndTime);

      // Obtener ingresos por rentas de mesas (solo el costo de la mesa, sin consumos)
      const { data: rentalsData } = await supabase
        .from('rentals')
        .select('total_amount, end_time')
        .eq('tenant_id', user.tenant_id)
        .gte('start_time', currentSession.start_time)
        .not('end_time', 'is', null)
        .lte('end_time', sessionEndTime);

      console.log('Sales data:', salesData);
      console.log('Rentals data:', rentalsData);

      const total_sales_revenue = salesData?.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0) || 0;
      const total_rentals_revenue = rentalsData?.reduce((sum, rental) => sum + Number(rental.total_amount || 0), 0) || 0;
      const total_revenue = total_sales_revenue + total_rentals_revenue;
      const products_sold = salesData?.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0) || 0;
      const rentals_completed = rentalsData?.length || 0;
      const average_sale = salesData && salesData.length > 0 ? total_sales_revenue / salesData.length : 0;

      // Calcular duración de la sesión
      const startTime = new Date(currentSession.start_time);
      const endTime = new Date(sessionEndTime);
      const durationMs = endTime.getTime() - startTime.getTime();
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      const session_duration = `${hours}h ${minutes}m`;

      console.log('Calculated financials:', {
        total_sales_revenue,
        total_rentals_revenue,
        total_revenue,
        products_sold,
        rentals_completed,
        average_sale,
        session_duration
      });

      setSessionFinancials({
        total_sales_revenue,
        total_rentals_revenue,
        total_revenue,
        products_sold,
        rentals_completed,
        average_sale,
        session_duration
      });

    } catch (error) {
      console.error('Error calculando datos financieros:', error);
    }
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
  const lowStockCount = products.filter(p => p.stock < 10).length;

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        <Sidebar role={user.role as 'admin' | 'worker' | 'super_admin'} username={user.username} />
      
      <div className="flex-1 overflow-auto">
        <div className="bg-card border-b">
          <div className="px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6 flex items-center gap-4">
            <SidebarTrigger className="md:hidden" />
            <div className="p-4 bg-muted rounded-xl">
              <PackageIcon size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Productos</h1>
              <p className="text-base text-muted-foreground mt-1">Gestiona tu inventario</p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 lg:p-8">
          {/* Session Status */}
          {currentSession && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div>
                    <h3 className="font-semibold text-green-800">Sesión Activa: {currentSession.session_name}</h3>
                    <p className="text-sm text-green-600">
                      Iniciada: {new Date(currentSession.start_time).toLocaleString('es-PE')}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-green-600">
                  Duración: {Math.floor((new Date().getTime() - new Date(currentSession.start_time).getTime()) / (1000 * 60))} min
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
            <StatCard
              title="Total Productos"
              value={products.length}
              accent="slate"
              icon={<PackageIcon size={40} />}
            />
            <StatCard
              title="Valor Inventario"
              value={`S/ ${totalValue.toFixed(2)}`}
              accent="emerald"
              icon={<DollarSign size={40} />}
            />
            <StatCard
              title="Stock Bajo"
              value={lowStockCount}
              accent="amber"
              icon={<TrendingDown size={40} />}
            />
          </div>

          {/* Buscador */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                placeholder="Buscar productos..."
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                onClick={() => setViewMode('grid')}
                size="sm"
              >
                Vista Cuadrícula
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                onClick={() => setViewMode('table')}
                size="sm"
              >
                Vista Tabla
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {!currentSession ? (
                <Button
                  variant="default"
                  size="lg"
                  onClick={startDaySession}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Calendar size={20} className="mr-2" /> Comenzar Día
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={generateSessionReport}
                  >
                    <BarChart3 size={20} className="mr-2" /> Ver Reporte
                  </Button>
                  <Button
                    variant="destructive"
                    size="lg"
                    onClick={endDaySession}
                  >
                    <Calendar size={20} className="mr-2" /> Terminar Día
                  </Button>
                </>
              )}
              <Button
                variant="default"
                size="lg"
                onClick={() => {
                  setEditingProduct(null);
                  setFormData({ name: '', price: '', stock: '0', image_url: '/pngs/pilsen.png' });
                  setShowModal(true);
                }}
              >
                <Plus size={20} className="mr-2" /> Agregar Producto
              </Button>
            </div>
          </div>

          {/* Products Grid */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
              {filteredProducts.map((product) => (
                <div key={product.id} className="relative group">
                  <ProductCard
                    name={product.name}
                    price={product.price}
                    stock={product.stock}
                    image_url={product.image_url}
                    onClick={() => handleEdit(product)}
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      handleDelete(product.id);
                    }}
                    className="absolute top-2 left-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            /* Products Table */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                          {product.image_url ? (
                            <Image
                              src={product.image_url}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <PackageIcon size={24} className="text-gray-400" />
                            </div>
                          )}
                        </div>
                        <span className="font-bold">{product.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-lg font-bold text-indigo-600">
                        S/ {product.price.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${
                        product.stock === 0 ? 'text-red-600' :
                        product.stock < 10 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {product.stock}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-gray-900">
                        S/ {(product.price * product.stock).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        product.stock === 0 
                          ? 'bg-red-100 text-red-900' 
                          : product.stock < 10 
                          ? 'bg-orange-100 text-orange-900' 
                          : 'bg-green-100 text-green-900'
                      }`}>
                        {product.stock === 0 ? 'Agotado' : product.stock < 10 ? 'Poco Stock' : 'Disponible'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleEdit(product)}
                        >
                          <Edit size={16} className="mr-2" /> Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 size={16} className="mr-2" /> Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {filteredProducts.length === 0 && (
            <Card>
              <CardBody>
                <div className="text-center py-12">
                  <PackageIcon size={64} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">No hay productos</h3>
                  <p className="text-gray-700 mb-6 font-medium">Comienza agregando tu primer producto</p>
                  <Button
                    variant="default"
                    size="lg"
                    onClick={() => setShowModal(true)}
                  >
                    <Plus size={24} className="mr-2" /> Agregar Primer Producto
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto mx-4 sm:mx-0">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Producto' : 'Agregar Producto'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Nombre del Producto</label>
          <Input
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ej: Cerveza Pilsen"
            required
          />

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Precio</label>
              <Input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, price: e.target.value })}
                placeholder="10.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Stock</label>
              <Input
                type="number"
                value={formData.stock}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, stock: e.target.value })}
                placeholder="50"
                required
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-bold text-gray-800 mb-2">
              Imagen del Producto
            </label>
            <div className="grid grid-cols-3 gap-4 max-h-[500px] overflow-y-auto p-2">
              {AVAILABLE_IMAGES.map((img) => (
                <button
                  key={img.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, image_url: img.value })}
                  className={`
                    relative rounded-lg overflow-hidden border-4 transition-all bg-white p-4 flex flex-col items-center gap-3
                    ${formData.image_url === img.value 
                      ? 'border-indigo-600 scale-105 shadow-lg' 
                      : 'border-gray-200 hover:border-indigo-300'
                    }
                  `}
                >
                  <div className="relative w-full h-40">
                    <Image
                      src={img.value}
                      alt={img.label}
                      fill
                      className="object-contain"
                      sizes="200px"
                    />
                  </div>
                  <div className="text-gray-900 text-sm text-center font-bold">
                    {img.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowModal(false);
                setEditingProduct(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit">
              {editingProduct ? 'Actualizar' : 'Crear'} Producto
            </Button>
          </DialogFooter>
        </form>
        </DialogContent>
      </Dialog>

      {/* Modal Reporte Stock Diario */}
      <Dialog open={showStockModal} onOpenChange={setShowStockModal}>
        <DialogContent className="!max-w-5xl max-h-[90vh] overflow-hidden flex flex-col mx-2 sm:mx-4 md:mx-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Calendar size={24} />
              Reporte de Stock - {currentSession?.session_name || 'Sesión'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            {/* Resumen Financiero */}
            {sessionFinancials && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border border-green-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  💰 Resumen Financiero de la Sesión
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <p className="text-sm text-gray-600 font-medium">Ingresos por Ventas</p>
                    <p className="text-2xl font-bold text-green-600">S/ {sessionFinancials.total_sales_revenue.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{sessionFinancials.products_sold} productos vendidos</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <p className="text-sm text-gray-600 font-medium">Ingresos por Rentas</p>
                    <p className="text-2xl font-bold text-blue-600">S/ {sessionFinancials.total_rentals_revenue.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{sessionFinancials.rentals_completed} mesas rentadas</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <p className="text-sm text-gray-600 font-medium">Ingresos Totales</p>
                    <p className="text-3xl font-bold text-purple-600">S/ {sessionFinancials.total_revenue.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Duración: {sessionFinancials.session_duration}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <p className="text-sm text-gray-600 font-medium">Venta Promedio</p>
                    <p className="text-2xl font-bold text-orange-600">S/ {sessionFinancials.average_sale.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Por transacción</p>
                  </div>
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              Este reporte compara el stock inicial vs el stock actual durante la sesión.
              {currentSession && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-blue-800">
                  📅 Sesión iniciada: {new Date(currentSession.start_time).toLocaleString('es-PE')}
                </div>
              )}
              {stockReport.some(item => !item.has_snapshot) && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800">
                  ⚠️ Algunos productos no tienen stock inicial guardado para esta sesión.
                </div>
              )}
            </div>

            <div className="border rounded-lg max-h-80 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="w-1/3">Producto</TableHead>
                    <TableHead className="text-center w-20">Inicial</TableHead>
                    <TableHead className="text-center w-20">Vendido</TableHead>
                    <TableHead className="text-center w-20">Actual</TableHead>
                    <TableHead className="text-center w-20">Dif.</TableHead>
                    <TableHead className="text-center w-24">Estado</TableHead>
                    <TableHead className="text-center w-24">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {stockReport.map((item) => (
                  <TableRow key={item.product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100">
                          {item.product.image_url ? (
                            <Image
                              src={item.product.image_url}
                              alt={item.product.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <PackageIcon size={20} className="text-gray-400" />
                            </div>
                          )}
                        </div>
                        <span className="font-medium">{item.product.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-semibold text-blue-600">{item.initial_stock}</span>
                        {!item.has_snapshot && (
                          <span className="text-xs text-amber-600" title="Estimado - No hay stock inicial guardado">*</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-orange-600">{item.sold_during_session}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-green-600">{item.current_stock}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold ${
                        item.difference === 0 ? 'text-green-600' :
                        item.difference < 0 ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {item.difference > 0 ? '+' : ''}{item.difference}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        item.difference === 0 
                          ? 'bg-green-100 text-green-800' 
                          : item.difference < 0 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {item.difference === 0 ? 'Correcto' : 
                         item.difference < 0 ? 'Faltante' : 'Sobrante'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadStockHistory(item.product)}
                        className="h-8"
                        title="Ver historial de cambios"
                      >
                        <History size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                </TableBody>
              </Table>
              
              {stockReport.length === 0 && (
                <div className="text-center py-8">
                  <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay datos para mostrar</h3>
                  <p className="text-gray-600">Asegúrate de tener productos registrados para generar el reporte.</p>
                </div>
              )}
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Resumen de la Sesión:</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total productos: </span>
                  <span className="font-semibold">{stockReport.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total vendido en sesión: </span>
                  <span className="font-semibold text-orange-600">
                    {stockReport.reduce((sum, item) => sum + item.sold_during_session, 0)} unidades
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Productos con diferencias: </span>
                  <span className="font-semibold text-red-600">
                    {stockReport.filter(item => item.difference !== 0).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowStockModal(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Historial de Cambios de Stock */}
      <Dialog open={showStockHistoryModal} onOpenChange={setShowStockHistoryModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col mx-2 sm:mx-4">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <History size={24} />
              Historial de Stock - {selectedProductForHistory?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            {selectedProductForHistory && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-white">
                    {selectedProductForHistory.image_url ? (
                      <Image
                        src={selectedProductForHistory.image_url}
                        alt={selectedProductForHistory.name}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <PackageIcon size={32} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900">{selectedProductForHistory.name}</h3>
                    <div className="flex gap-4 mt-2">
                      <div>
                        <span className="text-sm text-gray-600">Stock Actual: </span>
                        <span className="font-bold text-green-600">{selectedProductForHistory.stock}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Precio: </span>
                        <span className="font-bold text-blue-600">S/ {selectedProductForHistory.price.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              Registro completo de todos los cambios en el stock de este producto (últimos 50 movimientos).
            </div>

            {stockHistory.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead className="w-32">Fecha/Hora</TableHead>
                      <TableHead className="w-28">Tipo</TableHead>
                      <TableHead className="text-center w-20">Anterior</TableHead>
                      <TableHead className="text-center w-20">Cambio</TableHead>
                      <TableHead className="text-center w-20">Nuevo</TableHead>
                      <TableHead className="w-24">Usuario</TableHead>
                      <TableHead>Razón</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockHistory.map((change) => {
                      const changeTypeLabels: Record<string, { label: string; color: string }> = {
                        'increase': { label: 'Aumento', color: 'bg-green-100 text-green-800' },
                        'decrease': { label: 'Disminución', color: 'bg-red-100 text-red-800' },
                        'adjustment': { label: 'Ajuste', color: 'bg-yellow-100 text-yellow-800' },
                        'sale': { label: 'Venta', color: 'bg-blue-100 text-blue-800' },
                        'initial': { label: 'Inicial', color: 'bg-purple-100 text-purple-800' }
                      };
                      const typeInfo = changeTypeLabels[change.change_type] || { label: change.change_type, color: 'bg-gray-100 text-gray-800' };
                      
                      return (
                        <TableRow key={change.id}>
                          <TableCell className="text-xs">
                            {new Date(change.created_at).toLocaleString('es-PE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${typeInfo.color}`}>
                              {typeInfo.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-semibold text-gray-600">{change.stock_before}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold ${
                              change.quantity_change > 0 ? 'text-green-600' : 
                              change.quantity_change < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {change.quantity_change > 0 ? '+' : ''}{change.quantity_change}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-semibold text-blue-600">{change.stock_after}</span>
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                              {change.users?.username || 'Sistema'}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-gray-700">
                            {change.reason || 'Sin descripción'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 border rounded-lg bg-gray-50">
                <History size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay historial de cambios</h3>
                <p className="text-gray-600">Este producto aún no tiene cambios registrados en el stock.</p>
              </div>
            )}

            {stockHistory.length > 0 && (
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Resumen del Historial:</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total de movimientos: </span>
                    <span className="font-semibold">{stockHistory.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total aumentos: </span>
                    <span className="font-semibold text-green-600">
                      +{stockHistory.filter(h => h.quantity_change > 0).reduce((sum, h) => sum + h.quantity_change, 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total disminuciones: </span>
                    <span className="font-semibold text-red-600">
                      {stockHistory.filter(h => h.quantity_change < 0).reduce((sum, h) => sum + h.quantity_change, 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowStockHistoryModal(false);
                setSelectedProductForHistory(null);
                setStockHistory([]);
              }}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </SidebarProvider>
  );
}
