import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// GET - Obtener ventas
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id');
    const rentalId = searchParams.get('rental_id');

    let query = supabase
      .from('sales')
      .select('*, clients(name), products(name, price), rentals(id)');

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    if (rentalId) {
      query = query.eq('rental_id', rentalId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sales: data });
  } catch (error) {
    console.error('Get sales error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Crear nueva venta
export async function POST(request: NextRequest) {
  try {
    const { tenant_id, client_id, product_id, rental_id, quantity } = await request.json();

    if (!tenant_id || !product_id || !quantity) {
      return NextResponse.json(
        { error: 'tenant_id, product_id, and quantity are required' },
        { status: 400 }
      );
    }

    // Obtener precio del producto
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('price')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const unitPrice = product.price;
    const totalAmount = unitPrice * quantity;

    // Crear venta
    const { data, error } = await supabase
      .from('sales')
      .insert([{
        tenant_id,
        client_id,
        product_id,
        rental_id,
        quantity,
        unit_price: unitPrice,
        total_amount: totalAmount,
        is_paid: false
      }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sale: data }, { status: 201 });
  } catch (error) {
    console.error('Create sale error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Crear múltiples ventas (batch)
export async function PUT(request: NextRequest) {
  try {
    const { sales } = await request.json();

    if (!Array.isArray(sales) || sales.length === 0) {
      return NextResponse.json(
        { error: 'Sales array is required' },
        { status: 400 }
      );
    }

    // Procesar cada venta
    const salesData = [];
    for (const sale of sales) {
      const { tenant_id, client_id, product_id, rental_id, quantity } = sale;

      // Obtener precio del producto
      const { data: product } = await supabase
        .from('products')
        .select('price')
        .eq('id', product_id)
        .single();

      if (product) {
        salesData.push({
          tenant_id,
          client_id,
          product_id,
          rental_id,
          quantity,
          unit_price: product.price,
          total_amount: product.price * quantity,
          is_paid: false
        });
      }
    }

    // Insertar todas las ventas
    const { data, error } = await supabase
      .from('sales')
      .insert(salesData)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sales: data }, { status: 201 });
  } catch (error) {
    console.error('Batch create sales error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
