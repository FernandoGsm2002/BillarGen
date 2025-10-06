-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.clients (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id bigint,
  name text NOT NULL,
  email text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.daily_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id bigint NOT NULL,
  session_name character varying NOT NULL DEFAULT 'Día de trabajo'::character varying,
  start_time timestamp with time zone NOT NULL DEFAULT now(),
  end_time timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_by bigint,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT daily_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT daily_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT daily_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.daily_stock_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id bigint,
  product_id bigint,
  date date,
  initial_stock integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  session_id bigint,
  CONSTRAINT daily_stock_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT daily_stock_snapshots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT daily_stock_snapshots_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT daily_stock_snapshots_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.daily_sessions(id)
);
CREATE TABLE public.products (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id bigint,
  name text NOT NULL,
  price numeric NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  image_url text,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.rentals (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id bigint,
  client_id bigint,
  table_id bigint,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone,
  total_amount numeric,
  is_paid boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id integer,
  CONSTRAINT rentals_pkey PRIMARY KEY (id),
  CONSTRAINT rentals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT rentals_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT rentals_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id),
  CONSTRAINT rentals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.sales (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id bigint,
  client_id bigint,
  product_id bigint,
  rental_id bigint,
  worker_id bigint,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  total_amount numeric NOT NULL,
  is_paid boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT sales_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT sales_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT sales_rental_id_fkey FOREIGN KEY (rental_id) REFERENCES public.rentals(id),
  CONSTRAINT sales_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.users(id)
);
CREATE TABLE public.tables (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id bigint,
  name text NOT NULL,
  hourly_rate numeric NOT NULL DEFAULT 10.00,
  is_available boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tables_pkey PRIMARY KEY (id),
  CONSTRAINT tables_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.tenant_settings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id bigint,
  hourly_rate numeric DEFAULT 50.00,
  currency text DEFAULT 'PEN'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tenant_settings_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.tenants (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tenants_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'worker'::text])),
  tenant_id bigint,
  created_by bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);