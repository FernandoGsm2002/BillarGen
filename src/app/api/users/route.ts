import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// GET - Obtener usuarios (filtrado por tenant_id si se proporciona)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id');
    const role = searchParams.get('role');

    let query = supabase.from('users').select('*');

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    if (role) {
      query = query.eq('role', role);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Remover contraseñas de la respuesta
    const usersWithoutPasswords = data.map(({ password, ...user }) => user);

    return NextResponse.json({ users: usersWithoutPasswords });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo usuario
export async function POST(request: NextRequest) {
  try {
    const { username, password, role, tenant_id, created_by } = await request.json();

    if (!username || !password || !role) {
      return NextResponse.json(
        { error: 'Username, password, and role are required' },
        { status: 400 }
      );
    }

    // Validar rol
    if (!['super_admin', 'admin', 'worker'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Admin y worker requieren tenant_id
    if (role !== 'super_admin' && !tenant_id) {
      return NextResponse.json(
        { error: 'tenant_id is required for admin and worker roles' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('users')
      .insert([{
        username,
        password, // En producción, hashear con bcrypt
        role,
        tenant_id: role === 'super_admin' ? null : tenant_id,
        created_by
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { password: _, ...userWithoutPassword } = data;

    return NextResponse.json({ user: userWithoutPassword }, { status: 201 });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
