import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TenantConfig } from '@/types/database.types';

// Extender jsPDF para incluir autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
  }
}

interface DailySession {
  id: number;
  session_name: string;
  start_time: string;
  end_time: string | null;
  is_active: boolean;
  tenant_id: number;
  created_by: number;
  created_at: string;
}

interface SessionFinancials {
  session_id: number;
  total_sales_revenue: number;
  total_rentals_revenue: number;
  total_revenue: number;
  products_sold: number;
  rentals_completed: number;
  average_sale: number;
  session_duration: string;
  total_hours: number;
  sales_details: Array<{
    id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    is_paid: boolean;
    created_at: string;
    customer_name?: string;
  }>;
  rentals_details: Array<{
    id: number;
    table_name: string;
    start_time: string;
    end_time: string;
    duration_hours: number;
    total_amount: number;
  }>;
  unpaid_sales_total: number;
  paid_sales_total: number;
  unpaid_sales_count: number;
}

export const generateSessionPDF = async (
  session: DailySession,
  financials: SessionFinancials,
  tenantConfig: TenantConfig
): Promise<void> => {
  try {
    console.log('Generando PDF de sesión...');
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
    
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text(`REPORTE DETALLADO DE SESIÓN DE TRABAJO`, 105, 60, { align: 'center' } as any);
    doc.text(session.session_name, 105, 70, { align: 'center' } as any);
    
    // Línea separadora
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(20, 77, 190, 77);

    let yPosition = 90;

    // Información de la sesión
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('INFORMACIÓN DE LA SESIÓN', 20, yPosition);
    yPosition += 10;

    const sessionStartDate = new Date(session.start_time);
    const sessionEndDate = session.end_time ? new Date(session.end_time) : new Date();

    autoTable(doc, {
      startY: yPosition,
      head: [['DETALLE', 'INFORMACIÓN']],
      body: [
        ['Nombre de la Sesión:', session.session_name],
        ['Fecha de Inicio:', sessionStartDate.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })],
        ['Hora de Inicio:', sessionStartDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })],
        ['Hora de Finalización:', session.end_time ? sessionEndDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : 'Sesión activa'],
        ['Duración Total:', financials.session_duration],
        ['Estado:', session.is_active ? 'Activa' : 'Finalizada'],
        ['Generado el:', reportDate]
      ],
      theme: 'striped',
      headStyles: { 
        fillColor: [33, 37, 41], 
        textColor: 255,
        fontSize: 11,
        fontStyle: 'bold'
      },
      bodyStyles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 70, fontStyle: 'bold' },
        1: { cellWidth: 110 }
      },
      margin: { left: 20, right: 20 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 20;

    // Resumen financiero
    doc.setFontSize(14);
    doc.text('RESUMEN FINANCIERO', 20, yPosition);
    yPosition += 10;

    autoTable(doc, {
      startY: yPosition,
      head: [['CONCEPTO', 'CANTIDAD', 'MONTO', 'OBSERVACIONES']],
      body: [
        ['Ingresos por Ventas de Productos', `${financials.products_sold} unidades`, `S/ ${financials.total_sales_revenue.toFixed(2)}`, `Promedio: S/ ${financials.average_sale.toFixed(2)} por venta`],
        ['Ingresos por Alquiler de Mesas', `${financials.rentals_completed} mesas`, `S/ ${financials.total_rentals_revenue.toFixed(2)}`, `Promedio: S/ ${(financials.total_rentals_revenue / Math.max(financials.rentals_completed, 1)).toFixed(2)} por mesa`],
        ['TOTAL DE INGRESOS', '-', `S/ ${financials.total_revenue.toFixed(2)}`, 'Suma total de la sesión'],
        ['Ventas Pagadas', `${financials.sales_details.filter(s => s.is_paid).length} ventas`, `S/ ${financials.paid_sales_total.toFixed(2)}`, 'Efectivo recibido'],
        ['Ventas Pendientes (Fiadas)', `${financials.unpaid_sales_count} ventas`, `S/ ${financials.unpaid_sales_total.toFixed(2)}`, 'Por cobrar'],
        ['Ingresos por Hora', '-', `S/ ${(financials.total_revenue / financials.total_hours).toFixed(2)}`, 'Productividad de la sesión']
      ],
      theme: 'striped',
      headStyles: { 
        fillColor: [40, 167, 69], 
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 60, fontStyle: 'bold' },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
        3: { cellWidth: 55, fontSize: 8 }
      },
      margin: { left: 20, right: 20 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 20;

    // Nueva página si es necesario
    if (yPosition > 220) {
      doc.addPage();
      yPosition = 30;
    }

    // Detalle de productos vendidos
    if (financials.sales_details.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('DETALLE DE PRODUCTOS VENDIDOS', 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Total de ${financials.sales_details.length} transacciones de productos registradas`, 20, yPosition);
      yPosition += 12;

      autoTable(doc, {
        startY: yPosition,
        head: [['HORA', 'PRODUCTO', 'CANT.', 'PRECIO UNIT.', 'TOTAL', 'ESTADO', 'CLIENTE']],
        body: financials.sales_details.map(sale => [
          new Date(sale.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
          sale.product_name,
          sale.quantity.toString(),
          `S/ ${sale.unit_price.toFixed(2)}`,
          `S/ ${sale.total_amount.toFixed(2)}`,
          sale.is_paid ? 'Pagado' : 'Fiado',
          sale.customer_name || '-'
        ]),
        theme: 'striped',
        headStyles: { 
          fillColor: [52, 152, 219], 
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 45, fontStyle: 'bold' },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 25, halign: 'right' },
          4: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
          5: { cellWidth: 20, halign: 'center' },
          6: { cellWidth: 30 }
        },
        margin: { left: 20, right: 20 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    // Detalle de mesas rentadas
    if (financials.rentals_details.length > 0) {
      // Nueva página si es necesario
      if (yPosition > 200) {
        doc.addPage();
        yPosition = 30;
      }

      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('DETALLE DE ALQUILER DE MESAS', 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Total de ${financials.rentals_details.length} sesiones de juego completadas`, 20, yPosition);
      yPosition += 12;

      autoTable(doc, {
        startY: yPosition,
        head: [['MESA', 'HORA INICIO', 'HORA FIN', 'DURACIÓN', 'MONTO TOTAL']],
        body: financials.rentals_details.map(rental => [
          rental.table_name,
          new Date(rental.start_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
          new Date(rental.end_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
          `${rental.duration_hours.toFixed(1)} horas`,
          `S/ ${rental.total_amount.toFixed(2)}`
        ]),
        theme: 'striped',
        headStyles: { 
          fillColor: [106, 90, 205], 
          textColor: 255,
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold' },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 30, halign: 'center' },
          3: { cellWidth: 30, halign: 'center' },
          4: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 20, right: 20 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    // Análisis y conclusiones
    if (yPosition > 220) {
      doc.addPage();
      yPosition = 30;
    }

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('ANÁLISIS Y CONCLUSIONES', 20, yPosition);
    yPosition += 12;

    const analysisData = [
      ['Duración de la Sesión:', financials.session_duration],
      ['Productividad por Hora:', `S/ ${(financials.total_revenue / financials.total_hours).toFixed(2)}`],
      ['Promedio por Venta:', `S/ ${financials.average_sale.toFixed(2)}`],
      ['Porcentaje de Ventas Fiadas:', `${((financials.unpaid_sales_total / financials.total_sales_revenue) * 100).toFixed(1)}%`],
      ['Ingresos Primarios (Mesas):', `${((financials.total_rentals_revenue / financials.total_revenue) * 100).toFixed(1)}% del total`],
      ['Ingresos Secundarios (Productos):', `${((financials.total_sales_revenue / financials.total_revenue) * 100).toFixed(1)}% del total`]
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [['INDICADOR', 'VALOR']],
      body: analysisData,
      theme: 'grid',
      headStyles: { 
        fillColor: [25, 135, 84], 
        textColor: 255,
        fontSize: 11,
        fontStyle: 'bold'
      },
      bodyStyles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 90, fontStyle: 'bold' },
        1: { cellWidth: 70, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 20, right: 20 }
    });

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
      doc.text(`Sesión: ${session.session_name} - Este reporte es confidencial`, 105, 295, { align: 'center' } as any);
    }

    // Descargar
    const sessionDate = new Date(session.start_time).toISOString().split('T')[0];
    const fileName = `Sesion_${businessName.replace(/\s+/g, '_')}_${session.session_name.replace(/\s+/g, '_')}_${sessionDate}.pdf`;
    console.log('Guardando PDF de sesión:', fileName);
    doc.save(fileName);
    console.log('PDF de sesión exportado exitosamente');

  } catch (error) {
    console.error('Error generando PDF de sesión:', error);
    throw new Error(`Error al generar el reporte PDF de la sesión: ${error}`);
  }
};
