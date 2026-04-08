export interface User {
  id: string;
  email: string;
  name: string;
  avatarKey: string | null;
  avatarUrl: string | null; // pre-signed URL, not stored in DB
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string; // numeric comes as string from DB
  stock: number;
  imageKey: string | null;
  imageUrl: string | null; // pre-signed URL
  categoryId: string | null;
  category: Category | null;
  createdAt: string;
  updatedAt: string;
}
