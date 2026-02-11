export enum Section {
  HOME = 'HOME',
  SHOP_CATEGORY = 'SHOP_CATEGORY',
  PROFILE = 'PROFILE',
  WARDROBE = 'WARDROBE',
  AVATAR_STUDIO = 'AVATAR_STUDIO',
  CART = 'CART',
  LOGIN = 'LOGIN'
}

export type Category = 'Top' | 'Bottom' | 'One-Piece' | 'Shoes' | 'Bag' | 'Accessory' | 'Outerwear' | 'Dresses';

export interface WardrobeItem {
  id: string;
  image: string; // base64
  category: Category;
  description?: string;
  source?: 'upload' | 'store';
  price?: number;
  brand?: string;
}

export interface ShopItem {
  id: string;
  brand: string;
  price: number;
  image: string; // url or base64 placeholder
  category: Category;
  name: string;
}

export interface UserProfile {
  avatarImage: string | null; // base64 of the generated face
}

export interface ProcessingState {
  isLoading: boolean;
  statusMessage: string;
}