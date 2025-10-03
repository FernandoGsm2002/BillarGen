# BillarGen - Sistema de Administración de Negocios de Billar

Sistema multitenant completo para la gestión de Negocios de billar, desarrollado con Next.js 15, TypeScript, Tailwind CSS y Supabase.

## Características

### Para Super Administradores
- Crear y gestionar cuentas de administradores
- Cada administrador tiene su propio tenant (negocio aislado)
- Vista general de todos los negocios

### Para Administradores
- Gestión completa de empleados (workers)
- Configuración de mesas de billar
- Gestión de productos y precios
- Configuración de tarifa por hora
- Vista de rentas activas
- Dashboard con estadísticas

### Para Empleados (Workers)
- Iniciar y finalizar rentas de mesas
- Registro de clientes
- Sistema de ventas de productos
- Carrito de compras interactivo
- Vista en tiempo real de mesas disponibles/ocupadas

## Requisitos Previos

- Node.js 18+ 
- npm o yarn
- Cuenta de Supabase (gratuita)

## Instalación

1. **Clonar el repositorio**
```bash
git clone <tu-repositorio>
cd billargen-app
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**

Crea un archivo `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
```

4. **Configurar la base de datos**

Ve a tu proyecto de Supabase → SQL Editor y ejecuta el contenido del archivo `main.sql`

5. **Crear el primer Super Admin**

En el SQL Editor de Supabase:

```sql
INSERT INTO users (username, password, role, tenant_id)
VALUES ('superadmin', 'admin123', 'super_admin', NULL);
```

6. **Ejecutar el proyecto**

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Uso del Sistema

### 1. Login
- Accede con el super admin creado
- Credenciales: `superadmin` / `admin123`

### 2. Como Super Admin
- Crea un nuevo administrador con su negocio (tenant)
- Proporciona: nombre del negocio, usuario y contraseña

### 3. Como Administrador
- Inicia sesión con las credenciales del admin
- Configura la tarifa por hora para las rentas
- Agrega mesas de billar (Ej: Mesa 1, Mesa 2, etc.)
- Agrega productos (Ej: Cerveza $30, Refresco $20)
- Crea empleados para tu negocio

### 4. Como Empleado
- Inicia sesión con las credenciales del worker
- Click en una mesa disponible (verde) para iniciar renta
- Registra el cliente (nombre, email, teléfono)
- Durante la renta, puedes registrar Ventas de productos
- Finaliza la renta para calcular el total automáticamente

## Estructura del Proyecto

```
billargen-app/
├── src/
│   ├── app/
│   │   ├── admin/dashboard/      # Dashboard de administradores
│   │   ├── worker/dashboard/     # Dashboard de empleados
│   │   ├── super-admin/dashboard/# Dashboard super admin
│   │   ├── login/                # Página de login
│   │   └── layout.tsx            # Layout principal
│   ├── lib/
│   │   └── supabaseClient.ts     # Cliente de Supabase
│   └── types/
│       └── database.types.ts     # Tipos TypeScript
├── main.sql                      # Schema de base de datos
└── SETUP.md                      # Guía de configuración
```

## Modelo de Datos

- **tenants**: Negocios independientes
- **users**: Usuarios (super_admin, admin, worker)
- **clients**: Clientes de cada negocio
- **tables**: Mesas de billar
- **rentals**: Rentas de mesas
- **products**: Productos para venta
- **sales**: Ventas de productos

## Seguridad

**Importante para Producción:**
- Implementar hash de contraseñas (bcrypt)
- Configurar Row Level Security (RLS) en Supabase
- Usar Supabase Auth en lugar de autenticación manual
- Implementar validación de datos en el backend

## Tecnologías

- **Frontend**: Next.js 15, React 19, TypeScript
- **Estilos**: Tailwind CSS v4
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticación**: Custom (migrar a Supabase Auth recomendado)

## Próximas Mejoras

- [ ] Reportes y estadísticas avanzadas
- [ ] Gráficas de Ventas y ocupación
- [ ] Sistema de pagos integrado
- [ ] Notificaciones en tiempo real
- [ ] Exportación de reportes (PDF/Excel)
- [ ] App móvil con React Native
- [ ] Sistema de reservas

## Contribuir

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## Soporte

Para preguntas o soporte, consulta el archivo `SETUP.md` o abre un issue en GitHub.
