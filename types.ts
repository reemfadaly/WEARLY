export enum Section {
  HOME = 'HOME',
  PROFILE = 'PROFILE',
  WARDROBE = 'WARDROBE',
  AVATAR_STUDIO = 'AVATAR_STUDIO',
  REAL_STUDIO = 'REAL_STUDIO'
}

export type Category = 'Top' | 'Bottom' | 'One-Piece' | 'Shoes' | 'Bag' | 'Accessory' | 'Outerwear';

export interface WardrobeItem {
  id: string;
  image: string; // base64
  category: Category;
  description?: string;
}

export interface UserProfile {
  avatarImage: string | null; // base64 of the generated 3D face
}

export interface GeneratedContent {
  type: 'image' | 'text';
  data: string;
}

export interface ProcessingState {
  isLoading: boolean;
  statusMessage: string;
}
