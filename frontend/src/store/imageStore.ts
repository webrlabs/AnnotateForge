import { create } from 'zustand';
import { Image } from '@/types';

interface ImageStore {
  currentImage: Image | null;
  images: Image[];
  setCurrentImage: (image: Image | null) => void;
  setImages: (images: Image[]) => void;
  addImage: (image: Image) => void;
  updateImage: (id: string, data: Partial<Image>) => void;
  deleteImage: (id: string) => void;
}

export const useImageStore = create<ImageStore>(set => ({
  currentImage: null,
  images: [],

  setCurrentImage: currentImage =>
    set({
      currentImage,
    }),

  setImages: images =>
    set({
      images,
    }),

  addImage: image =>
    set(state => ({
      images: [...state.images, image],
    })),

  updateImage: (id, data) =>
    set(state => ({
      images: state.images.map(img => (img.id === id ? { ...img, ...data } : img)),
      currentImage:
        state.currentImage?.id === id ? { ...state.currentImage, ...data } : state.currentImage,
    })),

  deleteImage: id =>
    set(state => ({
      images: state.images.filter(img => img.id !== id),
      currentImage: state.currentImage?.id === id ? null : state.currentImage,
    })),
}));
