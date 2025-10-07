"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LogIn, User, Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody } from '@/components/ui/Card';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Buscar el usuario en la tabla users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (userError || !userData) {
        setError('Usuario o contraseña incorrectos');
        setLoading(false);
        return;
      }

      // Verificar la contraseña (en producción deberías usar bcrypt o similar)
      if (userData.password !== password) {
        setError('Usuario o contraseña incorrectos');
        setLoading(false);
        return;
      }

      // Guardar información del usuario en localStorage
      localStorage.setItem('user', JSON.stringify({
        id: userData.id,
        username: userData.username,
        role: userData.role,
        tenant_id: userData.tenant_id
      }));

      // Redirigir según el rol
      if (userData.role === 'super_admin') {
        router.push('/super-admin/dashboard');
      } else if (userData.role === 'admin') {
        router.push('/admin/dashboard');
      } else if (userData.role === 'worker') {
        router.push('/worker/tables');
      } else {
        router.push('/login');
      }
    } catch (err) {
      setError('Error al iniciar sesión. Intenta de nuevo.');
    }

    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      {/* Decoración de fondo sutil */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
      </div>

      <Card className="relative w-full max-w-md mx-4">
        <CardBody className="p-8 md:p-10">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-32 h-32 mb-4 bg-muted rounded-2xl p-4 shadow-sm">
              <Image
                src="/pngs/logologin.png"
                alt="BillarExpert"
                fill
                className="object-contain p-1"
              />
            </div>
            <h1 className="text-3xl font-bold mb-1">BillarExpert</h1>
            <p className="text-muted-foreground font-medium">Sistema de Gestión</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="username" className="block mb-2 text-sm font-semibold">
                Usuario
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  type="text"
                  id="username"
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  placeholder="Ingresa tu usuario"
                  required
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block mb-2 text-sm font-semibold">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  type="password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  placeholder="Ingresa tu contraseña"
                  required
                />
              </div>
            </div>
            
            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold"
              disabled={loading}
            >
              {loading ? (
                'Ingresando...'
              ) : (
                <>
                  <LogIn size={20} className="mr-2" />
                  Ingresar
                </>
              )}
            </Button>
            
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle size={18} className="text-destructive shrink-0" />
                <p className="text-sm text-destructive font-medium">{error}</p>
              </div>
            )}
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
