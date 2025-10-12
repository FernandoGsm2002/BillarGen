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
    console.log('Iniciando exportación PDF...');
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

    // Header del documento - Profesional y detallado
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text(businessName.toUpperCase(), 105, 20, { align: 'center' } as any);
    
    doc.setFontSize(14);
    doc.setTextColor(60, 60, 60);
    doc.text(`RUC: ${ruc}`, 105, 30, { align: 'center' } as any);
    
    // Información adicional de la empresa
    if (tenantConfig?.address) {
      doc.setFontSize(10);
      doc.text(`Dirección: ${tenantConfig.address}`, 105, 38, { align: 'center' } as any);
    }
    if (tenantConfig?.phone) {
      doc.setFontSize(10);
      doc.text(`Teléfono: ${tenantConfig.phone}`, 105, 46, { align: 'center' } as any);
    }
    
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(`REPORTE ESTADÍSTICO DE VENTAS Y OPERACIONES`, 105, 55, { align: 'center' } as any);
    doc.text(`Generado el ${reportDate}`, 105, 65, { align: 'center' } as any);
    
    // Línea separadora más prominente
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(20, 72, 190, 72);

    let yPosition = 85;

    // Resumen General
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('RESUMEN GENERAL DEL NEGOCIO', 20, yPosition);
    yPosition += 15;

    autoTable(doc, {
      startY: yPosition,
      head: [['INDICADOR', 'VALOR', 'DESCRIPCIÓN']],
      body: [
        ['Ingresos Totales Acumulados', `S/ ${stats.total_all_time_revenue.toFixed(2)}`, 'Suma total de ventas y alquileres'],
        ['Número Total de Ventas', stats.total_all_time_sales.toString(), 'Cantidad de transacciones registradas'],
        ['Productos Vendidos', stats.total_all_time_products_sold.toString(), 'Unidades totales vendidas'],
        ['Alquileres de Mesas', stats.total_all_time_rentals.toString(), 'Total de sesiones de juego completadas'],
        ['Promedio por Venta', `S/ ${(stats.total_all_time_revenue / Math.max(stats.total_all_time_sales, 1)).toFixed(2)}`, 'Ingreso promedio por transacción'],
        ['Productos por Venta', (stats.total_all_time_products_sold / Math.max(stats.total_all_time_sales, 1)).toFixed(1), 'Promedio de unidades por venta']
      ],
      theme: 'striped',
      headStyles: { 
        fillColor: [33, 37, 41], 
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 60, fontStyle: 'bold' },
        1: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
        2: { cellWidth: 80, fontSize: 8 }
      },
      margin: { left: 20, right: 20 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 20;

    // Comparativo Semanal
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('ANÁLISIS COMPARATIVO SEMANAL', 20, yPosition);
    yPosition += 8;
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Comparación entre ${stats.current_week.week} y ${stats.previous_week.week}`, 20, yPosition);
    yPosition += 10;

    const weeklyRevenueChange = stats.previous_week.total_revenue > 0 
      ? ((stats.current_week.total_revenue - stats.previous_week.total_revenue) / stats.previous_week.total_revenue * 100)
      : 0;
    const weeklyProductsChange = stats.previous_week.products_sold > 0
      ? ((stats.current_week.products_sold - stats.previous_week.products_sold) / stats.previous_week.products_sold * 100)
      : 0;
      
    const revenueChangeText = weeklyRevenueChange >= 0 ? `+${weeklyRevenueChange.toFixed(1)}%` : `${weeklyRevenueChange.toFixed(1)}%`;
    const productsChangeText = weeklyProductsChange >= 0 ? `+${weeklyProductsChange.toFixed(1)}%` : `${weeklyProductsChange.toFixed(1)}%`;

    autoTable(doc, {
      startY: yPosition,
      head: [['PERÍODO', 'INGRESOS TOTALES', 'VENTAS', 'PRODUCTOS', 'ALQUILERES']],
      body: [
        [
          'Semana Actual', 
          `S/ ${stats.current_week.total_revenue.toFixed(2)}`, 
          `S/ ${stats.current_week.sales_revenue.toFixed(2)}`,
          `${stats.current_week.products_sold} unidades`, 
          `${stats.current_week.rentals_completed} mesas`
        ],
        [
          'Semana Anterior', 
          `S/ ${stats.previous_week.total_revenue.toFixed(2)}`, 
          'N/A',
          `${stats.previous_week.products_sold} unidades`, 
          'N/A'
        ],
        [
          'Variación', 
          revenueChangeText,
          `S/ ${(stats.current_week.total_revenue - stats.previous_week.total_revenue).toFixed(2)}`,
          `${productsChangeText} (${stats.current_week.products_sold - stats.previous_week.products_sold})`, 
          `${stats.current_week.rentals_completed} esta semana`
        ]
      ],
      theme: 'striped',
      headStyles: { 
        fillColor: [40, 167, 69], 
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 35, halign: 'right' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 40, halign: 'center' },
        4: { cellWidth: 35, halign: 'center' }
      },
      margin: { left: 20, right: 20 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    // Top Productos
    if (stats.top_products.length > 0) {
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('PRODUCTOS MÁS VENDIDOS', 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Ranking de productos por ingresos generados en el período analizado', 20, yPosition);
      yPosition += 12;

      autoTable(doc, {
        startY: yPosition,
        head: [['POSICIÓN', 'NOMBRE DEL PRODUCTO', 'CANTIDAD VENDIDA', 'INGRESOS GENERADOS', 'PROMEDIO POR UNIDAD']],
        body: stats.top_products.map((product, index) => [
          `${index + 1}°`,
          product.name,
          `${product.quantity} unidades`,
          `S/ ${product.revenue.toFixed(2)}`,
          `S/ ${(product.revenue / product.quantity).toFixed(2)}`
        ]),
        theme: 'striped',
        headStyles: { 
          fillColor: [255, 165, 0], 
          textColor: 0,
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 50, fontStyle: 'bold' },
          2: { cellWidth: 30, halign: 'center' },
          3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
          4: { cellWidth: 35, halign: 'right' }
        },
        margin: { left: 20, right: 20 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 18;
    }

    // Nueva página si es necesario
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    // Top Trabajadores
    if (stats.top_workers.length > 0) {
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('RENDIMIENTO DE EMPLEADOS', 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Clasificación de empleados según ventas realizadas y ingresos generados', 20, yPosition);
      yPosition += 12;

      autoTable(doc, {
        startY: yPosition,
        head: [['POSICIÓN', 'NOMBRE DEL EMPLEADO', 'VENTAS REALIZADAS', 'INGRESOS GENERADOS', 'PROMEDIO POR VENTA']],
        body: stats.top_workers.map((worker, index) => [
          `${index + 1}°`,
          worker.username,
          `${worker.sales_count} transacciones`,
          `S/ ${worker.revenue.toFixed(2)}`,
          `S/ ${(worker.revenue / worker.sales_count).toFixed(2)}`
        ]),
        theme: 'striped',
        headStyles: { 
          fillColor: [106, 90, 205], 
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 50, fontStyle: 'bold' },
          2: { cellWidth: 35, halign: 'center' },
          3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
          4: { cellWidth: 30, halign: 'right' }
        },
        margin: { left: 20, right: 20 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 18;
    }

    // Tendencia Diaria
    if (stats.daily_stats.length > 0) {
      if (yPosition > 200) {
        doc.addPage();
        yPosition = 30;
      }

      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('ANÁLISIS DE TENDENCIA DIARIA', 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Evolución del rendimiento del negocio en los últimos 7 días', 20, yPosition);
      yPosition += 12;

      // Calcular totales para la semana
      const weekTotal = stats.daily_stats.reduce((sum, day) => sum + day.total_revenue, 0);
      const weekProducts = stats.daily_stats.reduce((sum, day) => sum + day.products_sold, 0);
      const dailyAverage = weekTotal / stats.daily_stats.length;

      autoTable(doc, {
        startY: yPosition,
        head: [['FECHA', 'DÍA DE LA SEMANA', 'INGRESOS DEL DÍA', 'PRODUCTOS VENDIDOS', '% DEL TOTAL SEMANAL']],
        body: stats.daily_stats.map(day => {
          const dayDate = new Date(day.date);
          const dayName = dayDate.toLocaleDateString('es-PE', { weekday: 'long' });
          const percentage = weekTotal > 0 ? ((day.total_revenue / weekTotal) * 100).toFixed(1) : '0.0';
          
          return [
            dayDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            dayName.charAt(0).toUpperCase() + dayName.slice(1),
            `S/ ${day.total_revenue.toFixed(2)}`,
            `${day.products_sold} unidades`,
            `${percentage}%`
          ];
        }),
        theme: 'striped',
        headStyles: { 
          fillColor: [52, 152, 219], 
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 30, halign: 'center' },
          1: { cellWidth: 35, fontStyle: 'bold' },
          2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
          3: { cellWidth: 35, halign: 'center' },
          4: { cellWidth: 25, halign: 'center' }
        },
        margin: { left: 20, right: 20 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;

      // Agregar resumen semanal
      autoTable(doc, {
        startY: yPosition,
        head: [['RESUMEN SEMANAL', 'VALOR']],
        body: [
          ['Total de la Semana:', `S/ ${weekTotal.toFixed(2)}`],
          ['Promedio Diario:', `S/ ${dailyAverage.toFixed(2)}`],
          ['Productos Totales:', `${weekProducts} unidades`],
          ['Mejor Día:', stats.daily_stats.reduce((best, day) => day.total_revenue > best.total_revenue ? day : best).date],
          ['Día con Más Ventas:', stats.daily_stats.reduce((best, day) => day.products_sold > best.products_sold ? day : best).date]
        ],
        theme: 'grid',
        headStyles: { 
          fillColor: [25, 135, 84], 
          textColor: 255,
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 80, fontStyle: 'bold' },
          1: { cellWidth: 60, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 20, right: 20 }
      });
    }

    // Footer profesional
    const pageCount = (doc as any).internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Línea superior del footer
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(20, 280, 190, 280);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Página ${i} de ${pageCount}`, 105, 288, { align: 'center' } as any);
      doc.text('Sistema de Gestión BillarGen', 20, 288);
      doc.text(`Generado: ${reportDate}`, 190, 288, { align: 'right' } as any);
      
      // Información adicional en el footer
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('Este reporte es confidencial y de uso exclusivo de la empresa', 105, 295, { align: 'center' } as any);
    }

    // Descargar
    const fileName = `Reporte_Estadistico_${businessName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    console.log('Guardando archivo PDF:', fileName);
    doc.save(fileName);
    console.log('PDF exportado exitosamente');

  } catch (error) {
    console.error('Error generando PDF:', error);
    throw new Error(`Error al generar el reporte PDF: ${error}`);
  }
};

export const exportToExcel = async (
  stats: ComprehensiveStats,
  tenantConfig: TenantConfig | null
): Promise<void> => {
  try {
    console.log('Iniciando exportación Excel...');
    const businessName = tenantConfig?.business_name || 'Mi Negocio';
    const ruc = tenantConfig?.ruc || 'Sin RUC';
    const reportDate = new Date().toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Crear workbook
    const wb = XLSX.utils.book_new();

    // Hoja 1: Resumen General
    const summaryData = [
      ['REPORTE ESTADÍSTICO DE VENTAS Y OPERACIONES', '', '', '', ''],
      [businessName.toUpperCase(), '', '', '', ''],
      [`RUC: ${ruc}`, '', '', '', ''],
      [`Generado el: ${reportDate}`, '', '', '', ''],
      [tenantConfig?.address ? `Dirección: ${tenantConfig.address}` : '', '', '', '', ''],
      [tenantConfig?.phone ? `Teléfono: ${tenantConfig.phone}` : '', '', '', '', ''],
      ['', '', '', '', ''],
      ['RESUMEN GENERAL DEL NEGOCIO', '', '', '', ''],
      ['INDICADOR', 'VALOR', 'DESCRIPCIÓN', '', ''],
      ['Ingresos Totales Acumulados', `S/ ${stats.total_all_time_revenue.toFixed(2)}`, 'Suma total de ventas y alquileres', '', ''],
      ['Número Total de Ventas', stats.total_all_time_sales, 'Cantidad de transacciones registradas', '', ''],
      ['Productos Vendidos', stats.total_all_time_products_sold, 'Unidades totales vendidas', '', ''],
      ['Alquileres de Mesas', stats.total_all_time_rentals, 'Total de sesiones de juego completadas', '', ''],
      ['Promedio por Venta', `S/ ${(stats.total_all_time_revenue / Math.max(stats.total_all_time_sales, 1)).toFixed(2)}`, 'Ingreso promedio por transacción', '', ''],
      ['', '', '', '', ''],
      ['ANÁLISIS COMPARATIVO SEMANAL', '', '', '', ''],
      ['PERÍODO', 'INGRESOS TOTALES', 'PRODUCTOS VENDIDOS', 'ALQUILERES', 'VARIACIÓN'],
      ['Semana Actual', stats.current_week.total_revenue, stats.current_week.products_sold, stats.current_week.rentals_completed, ''],
      ['Semana Anterior', stats.previous_week.total_revenue, stats.previous_week.products_sold, 0, ''],
      ['Diferencia Absoluta', stats.current_week.total_revenue - stats.previous_week.total_revenue, stats.current_week.products_sold - stats.previous_week.products_sold, stats.current_week.rentals_completed, 'Mejora/Declive']
    ];

    const ws_summary = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Estilos para el resumen
    ws_summary['!cols'] = [
      { width: 35 },
      { width: 20 },
      { width: 40 },
      { width: 15 },
      { width: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, ws_summary, 'Resumen');

    // Hoja 2: Top Productos
    if (stats.top_products.length > 0) {
      const productsData = [
        ['PRODUCTOS MÁS VENDIDOS', '', '', '', ''],
        ['Ranking de productos por ingresos generados', '', '', '', ''],
        ['', '', '', '', ''],
        ['POSICIÓN', 'NOMBRE DEL PRODUCTO', 'CANTIDAD VENDIDA', 'INGRESOS GENERADOS', 'PROMEDIO POR UNIDAD'],
        ...stats.top_products.map((product, index) => [
          `${index + 1}°`,
          product.name,
          `${product.quantity} unidades`,
          product.revenue,
          (product.revenue / product.quantity).toFixed(2)
        ])
      ];

      const ws_products = XLSX.utils.aoa_to_sheet(productsData);
      ws_products['!cols'] = [
        { width: 12 },
        { width: 30 },
        { width: 18 },
        { width: 20 },
        { width: 18 }
      ];

      XLSX.utils.book_append_sheet(wb, ws_products, 'Top Productos');
    }

    // Hoja 3: Top Trabajadores
    if (stats.top_workers.length > 0) {
      const workersData = [
        ['RENDIMIENTO DE EMPLEADOS', '', '', '', ''],
        ['Clasificación de empleados según ventas y ingresos', '', '', '', ''],
        ['', '', '', '', ''],
        ['POSICIÓN', 'NOMBRE DEL EMPLEADO', 'VENTAS REALIZADAS', 'INGRESOS GENERADOS', 'PROMEDIO POR VENTA'],
        ...stats.top_workers.map((worker, index) => [
          `${index + 1}°`,
          worker.username,
          `${worker.sales_count} transacciones`,
          worker.revenue,
          (worker.revenue / worker.sales_count).toFixed(2)
        ])
      ];

      const ws_workers = XLSX.utils.aoa_to_sheet(workersData);
      ws_workers['!cols'] = [
        { width: 12 },
        { width: 25 },
        { width: 20 },
        { width: 20 },
        { width: 18 }
      ];

      XLSX.utils.book_append_sheet(wb, ws_workers, 'Top Trabajadores');
    }

    // Hoja 4: Tendencia Diaria
    if (stats.daily_stats.length > 0) {
      const weekTotal = stats.daily_stats.reduce((sum, day) => sum + day.total_revenue, 0);
      const weekProducts = stats.daily_stats.reduce((sum, day) => sum + day.products_sold, 0);
      
      const dailyData = [
        ['ANÁLISIS DE TENDENCIA DIARIA', '', '', '', ''],
        ['Evolución del rendimiento en los últimos 7 días', '', '', '', ''],
        ['', '', '', '', ''],
        ['FECHA', 'DÍA DE LA SEMANA', 'INGRESOS DEL DÍA', 'PRODUCTOS VENDIDOS', '% DEL TOTAL SEMANAL'],
        ...stats.daily_stats.map(day => {
          const dayDate = new Date(day.date);
          const dayName = dayDate.toLocaleDateString('es-PE', { weekday: 'long' });
          const percentage = weekTotal > 0 ? ((day.total_revenue / weekTotal) * 100).toFixed(1) : '0.0';
          
          return [
            dayDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            dayName.charAt(0).toUpperCase() + dayName.slice(1),
            day.total_revenue,
            day.products_sold,
            `${percentage}%`
          ];
        }),
        ['', '', '', '', ''],
        ['RESUMEN SEMANAL', '', '', '', ''],
        ['Total de la Semana:', weekTotal.toFixed(2), '', '', ''],
        ['Promedio Diario:', (weekTotal / stats.daily_stats.length).toFixed(2), '', '', ''],
        ['Productos Totales:', weekProducts, '', '', '']
      ];

      const ws_daily = XLSX.utils.aoa_to_sheet(dailyData);
      ws_daily['!cols'] = [
        { width: 15 },
        { width: 18 },
        { width: 18 },
        { width: 18 },
        { width: 15 }
      ];

      XLSX.utils.book_append_sheet(wb, ws_daily, 'Tendencia Diaria');
    }

    // Descargar
    const fileName = `Reporte_Estadistico_${businessName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    console.log('Guardando archivo Excel:', fileName);
    XLSX.writeFile(wb, fileName);
    console.log('Excel exportado exitosamente');

  } catch (error) {
    console.error('Error generando Excel:', error);
    throw new Error(`Error al generar el reporte Excel: ${error}`);
  }
};
