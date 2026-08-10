// src/types/index.ts

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  price_per_day: number;
  image_url: string;
  owner_id: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  is_available: boolean;
  created_at: string;
}

export interface Rental {
  id: string;
  item_id: string;
  renter_id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  created_at: string;
  items?: Item; // Вложенный объект товара
}

export interface Profile extends User {
  bio?: string;
  phone?: string;
}