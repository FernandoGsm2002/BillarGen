import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { TenantConfig } from '@/types/database.types';

// Extender jsPDF para incluir autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
  }
}

interface ComprehensiveStats {
  total_all_time_revenue: number;
  total_all_time_sales: number;
  total_all_time_products_sold: number;
  total_all_time_rentals: number;
  current_week: {
    week: string;
    sales_revenue: number;
    rentals_revenue: number;
    total_revenue: number;
    products_sold: number;
    rentals_completed: number;
  };
  previous_week: {
    week: string;
    total_revenue: number;
    products_sold: number;
  };
  daily_stats: Array<{
    date: string;
    total_revenue: number;
    products_sold: number;
  }>;
  top_products: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  top_workers: Array<{
    username: string;
    sales_count: number;
    revenue: number;
  }>;
}

export const exportToPDF = async (
  stats: ComprehensiveStats,
  tenantConfig: TenantConfig | null
): Promise<void> => {
  try {
    console.log('📄 Iniciando exportación PDF...');
    const doc = new jsPDF();
    
    // Configuración del documento
    const businessName = tenantConfig?.business_name || 'Mi Negocio';
    const ruc = tenantConfig?.ruc || 'Sin RUC';
    const reportDate = new Date().toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Header del documento
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text(businessName, 105, 20, { align: 'center' } as any);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`RUC: ${ruc}`, 105, 30, { align: 'center' } as any);
    doc.text(`Reporte de Estadísticas - ${reportDate}`, 105, 38, { align: 'center' } as any);
    
    // Línea separadora
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 45, 190, 45);

    let yPosition = 55;

    // Resumen General
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text('📊 Resumen General', 20, yPosition);
    yPosition += 10;

    autoTable(doc, {
      startY: yPosition,
      head: [['Métrica', 'Valor']],
      body: [
        ['Ingresos Totales', `S/ ${stats.total_all_time_revenue.toFixed(2)}`],
        ['Ventas Totales', stats.total_all_time_sales.toString()],
        ['Productos Vendidos', stats.total_all_time_products_sold.toString()],
        ['Mesas Rentadas', stats.total_all_time_rentals.toString()]
      ],
      theme: 'grid',
      headStyles: { fillColor: [52, 152, 219] },
      styles: { fontSize: 10 },
      margin: { left: 20, right: 20 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    // Comparativo Semanal
    doc.setFontSize(16);
    doc.text('📈 Comparativo Semanal', 20, yPosition);
    yPosition += 10;

    const weeklyChange = ((stats.current_week.total_revenue - stats.previous_week.total_revenue) / stats.previous_week.total_revenue * 100);
    const changeText = weeklyChange >= 0 ? `+${weeklyChange.toFixed(1)}%` : `${weeklyChange.toFixed(1)}%`;

    autoTable(doc, {
      startY: yPosition,
      head: [['Período', 'Ingresos', 'Productos Vendidos']],
      body: [
        ['Semana Actual', `S/ ${stats.current_week.total_revenue.toFixed(2)}`, stats.current_week.products_sold.toString()],
        ['Semana Anterior', `S/ ${stats.previous_week.total_revenue.toFixed(2)}`, stats.previous_week.products_sold.toString()],
        ['Cambio', changeText, `${stats.current_week.products_sold - stats.previous_week.products_sold} unidades`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [46, 204, 113] },
      styles: { fontSize: 10 },
      margin: { left: 20, right: 20 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    // Top Productos
    if (stats.top_products.length > 0) {
      doc.setFontSize(16);
      doc.text('🏆 Top Productos', 20, yPosition);
      yPosition += 10;

      autoTable(doc, {
        startY: yPosition,
        head: [['#', 'Producto', 'Cantidad', 'Ingresos']],
        body: stats.top_products.map((product, index) => [
          (index + 1).toString(),
          product.name,
          product.quantity.toString(),
          `S/ ${product.revenue.toFixed(2)}`
        ]),
        theme: 'grid',
        headStyles: { fillColor: [255, 193, 7] },
        styles: { fontSize: 10 },
        margin: { left: 20, right: 20 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    // Nueva página si es necesario
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    // Top Trabajadores
    if (stats.top_workers.length > 0) {
      doc.setFontSize(16);
      doc.text('👥 Top Trabajadores', 20, yPosition);
      yPosition += 10;

      autoTable(doc, {
        startY: yPosition,
        head: [['#', 'Usuario', 'Ventas', 'Ingresos']],
        body: stats.top_workers.map((worker, index) => [
          (index + 1).toString(),
          worker.username,
          worker.sales_count.toString(),
          `S/ ${worker.revenue.toFixed(2)}`
        ]),
        theme: 'grid',
        headStyles: { fillColor: [155, 89, 182] },
        styles: { fontSize: 10 },
        margin: { left: 20, right: 20 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    // Tendencia Diaria
    if (stats.daily_stats.length > 0) {
      if (yPosition > 200) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.text('📅 Tendencia Diaria (Últimos 7 días)', 20, yPosition);
      yPosition += 10;

      autoTable(doc, {
        startY: yPosition,
        head: [['Fecha', 'Ingresos', 'Productos']],
        body: stats.daily_stats.map(day => [
          new Date(day.date).toLocaleDateString('es-PE'),
          `S/ ${day.total_revenue.toFixed(2)}`,
          day.products_sold.toString()
        ]),
        theme: 'grid',
        headStyles: { fillColor: [52, 152, 219] },
        styles: { fontSize: 10 },
        margin: { left: 20, right: 20 }
      });
    }

    // Footer
    const pageCount = (doc as any).internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' } as any);
      doc.text('Generado por BillarGen', 20, 290);
      doc.text(reportDate, 190, 290, { align: 'right' } as any);
    }

    // Descargar
    const fileName = `Reporte_${businessName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    console.log('💾 Guardando archivo PDF:', fileName);
    doc.save(fileName);
    console.log('✅ PDF exportado exitosamente');

  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    throw new Error(`Error al generar el reporte PDF: ${error}`);
  }
};

export const exportToExcel = async (
  stats: ComprehensiveStats,
  tenantConfig: TenantConfig | null
): Promise<void> => {
  try {
    console.log('📊 Iniciando exportación Excel...');
    const businessName = tenantConfig?.business_name || 'Mi Negocio';
    const ruc = tenantConfig?.ruc || 'Sin RUC';
    const reportDate = new Date().toLocaleDateString('es-PE');

    // Crear workbook
    const wb = XLSX.utils.book_new();

    // Hoja 1: Resumen General
    const summaryData = [
      ['REPORTE DE ESTADÍSTICAS', '', '', ''],
      [businessName, '', '', ''],
      [`RUC: ${ruc}`, '', '', ''],
      [`Fecha: ${reportDate}`, '', '', ''],
      ['', '', '', ''],
      ['RESUMEN GENERAL', '', '', ''],
      ['Métrica', 'Valor', '', ''],
      ['Ingresos Totales', `S/ ${stats.total_all_time_revenue.toFixed(2)}`, '', ''],
      ['Ventas Totales', stats.total_all_time_sales, '', ''],
      ['Productos Vendidos', stats.total_all_time_products_sold, '', ''],
      ['Mesas Rentadas', stats.total_all_time_rentals, '', ''],
      ['', '', '', ''],
      ['COMPARATIVO SEMANAL', '', '', ''],
      ['Período', 'Ingresos', 'Productos', 'Rentas'],
      ['Semana Actual', stats.current_week.total_revenue, stats.current_week.products_sold, stats.current_week.rentals_completed],
      ['Semana Anterior', stats.previous_week.total_revenue, stats.previous_week.products_sold, 0],
      ['Diferencia', stats.current_week.total_revenue - stats.previous_week.total_revenue, stats.current_week.products_sold - stats.previous_week.products_sold, '']
    ];

    const ws_summary = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Estilos para el resumen
    ws_summary['!cols'] = [
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, ws_summary, 'Resumen');

    // Hoja 2: Top Productos
    if (stats.top_products.length > 0) {
      const productsData = [
        ['TOP PRODUCTOS', '', '', ''],
        ['Ranking', 'Producto', 'Cantidad', 'Ingresos'],
        ...stats.top_products.map((product, index) => [
          index + 1,
          product.name,
          product.quantity,
          product.revenue
        ])
      ];

      const ws_products = XLSX.utils.aoa_to_sheet(productsData);
      ws_products['!cols'] = [
        { width: 10 },
        { width: 25 },
        { width: 12 },
        { width: 12 }
      ];

      XLSX.utils.book_append_sheet(wb, ws_products, 'Top Productos');
    }

    // Hoja 3: Top Trabajadores
    if (stats.top_workers.length > 0) {
      const workersData = [
        ['TOP TRABAJADORES', '', '', ''],
        ['Ranking', 'Usuario', 'Ventas', 'Ingresos'],
        ...stats.top_workers.map((worker, index) => [
          index + 1,
          worker.username,
          worker.sales_count,
          worker.revenue
        ])
      ];

      const ws_workers = XLSX.utils.aoa_to_sheet(workersData);
      ws_workers['!cols'] = [
        { width: 10 },
        { width: 20 },
        { width: 12 },
        { width: 12 }
      ];

      XLSX.utils.book_append_sheet(wb, ws_workers, 'Top Trabajadores');
    }

    // Hoja 4: Tendencia Diaria
    if (stats.daily_stats.length > 0) {
      const dailyData = [
        ['TENDENCIA DIARIA', '', ''],
        ['Fecha', 'Ingresos', 'Productos'],
        ...stats.daily_stats.map(day => [
          new Date(day.date).toLocaleDateString('es-PE'),
          day.total_revenue,
          day.products_sold
        ])
      ];

      const ws_daily = XLSX.utils.aoa_to_sheet(dailyData);
      ws_daily['!cols'] = [
        { width: 12 },
        { width: 12 },
        { width: 12 }
      ];

      XLSX.utils.book_append_sheet(wb, ws_daily, 'Tendencia Diaria');
    }

    // Descargar
    const fileName = `Reporte_${businessName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    console.log('💾 Guardando archivo Excel:', fileName);
    XLSX.writeFile(wb, fileName);
    console.log('✅ Excel exportado exitosamente');

  } catch (error) {
    console.error('❌ Error generando Excel:', error);
    throw new Error(`Error al generar el reporte Excel: ${error}`);
  }
};
