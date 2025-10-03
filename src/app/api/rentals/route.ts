import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// GET - Obtener rentas
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id');
    const active = searchParams.get('active'); // 'true' para rentas activas

    let query = supabase
      .from('rentals')
      .select('*, clients(name, email, phone), tables(table_number, is_available)');

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    if (active === 'true') {
      query = query.is('end_time', null);
    }

    const { data, error } = await query.order('start_time', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rentals: data });
  } catch (error) {
    console.error('Get rentals error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Crear nueva renta
export async function POST(request: NextRequest) {
  try {
    const { tenant_id, client_id, table_id, start_time } = await request.json();

    if (!tenant_id || !client_id || !table_id) {
      return NextResponse.json(
        { error: 'tenant_id, client_id, and table_id are required' },
        { status: 400 }
      );
    }

    // Verificar que la mesa esté disponible
    const { data: table } = await supabase
      .from('tables')
      .select('is_available')
      .eq('id', table_id)
      .single();

    if (!table?.is_available) {
      return NextResponse.json(
        { error: 'Table is not available' },
        { status: 400 }
      );
    }

    // Crear renta
    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .insert([{
        tenant_id,
        client_id,
        table_id,
        start_time: start_time || new Date().toISOString(),
        is_paid: false
      }])
      .select()
      .single();

    if (rentalError) {
      return NextResponse.json({ error: rentalError.message }, { status: 500 });
    }

    // Actualizar disponibilidad de la mesa
    await supabase
      .from('tables')
      .update({ is_available: false })
      .eq('id', table_id);

    return NextResponse.json({ rental }, { status: 201 });
  } catch (error) {
    console.error('Create rental error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Actualizar renta (finalizar)
export async function PATCH(request: NextRequest) {
  try {
    const { id, end_time, total_amount, is_paid } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Rental id is required' },
        { status: 400 }
      );
    }

    // Obtener información de la renta
    const { data: rental } = await supabase
      .from('rentals')
      .select('table_id')
      .eq('id', id)
      .single();

    // Actualizar renta
    const { data, error } = await supabase
      .from('rentals')
      .update({
        end_time: end_time || new Date().toISOString(),
        total_amount,
        is_paid: is_paid || false
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Liberar mesa si se finalizó la renta
    if (end_time && rental?.table_id) {
      await supabase
        .from('tables')
        .update({ is_available: true })
        .eq('id', rental.table_id);
    }

    return NextResponse.json({ rental: data });
  } catch (error) {
    console.error('Update rental error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
