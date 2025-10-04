export interface Tenant {
  id: number;
  name: string;
  created_at: string;
}

export interface User {
  id: number;
  tenant_id: number | null;
  username: string;
  password: string;
  role: 'super_admin' | 'admin' | 'worker';
  created_by: number | null;
  created_at: string;
}

export interface Client {
  id: number;
  tenant_id: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export interface Table {
  id: number;
  tenant_id: number | null;
  name: string;
  hourly_rate: number;
  is_available: boolean;
  created_at: string;
}

export interface Rental {
  id: number;
  tenant_id: number | null;
  client_id: number | null;
  table_id: number | null;
  user_id: number | null;
  start_time: string;
  end_time: string | null;
  total_amount: number | null;
  is_paid: boolean;
  created_at: string;
}

export interface Product {
  id: number;
  tenant_id: number | null;
  name: string;
  price: number;
  stock: number;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
}

export interface Sale {
  id: number;
  tenant_id: number | null;
  client_id: number | null;
  product_id: number | null;
  rental_id: number | null;
  worker_id: number | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  is_paid: boolean;
  created_at: string;
}
