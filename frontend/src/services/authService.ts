import api from './api';
import { User, UserLogin, UserCreate, Token } from '@/types';

export const authAPI = {
  register: async (data: UserCreate): Promise<User> => {
    const response = await api.post<User>('/auth/register', data);
    return response.data;
  },

  login: async (credentials: UserLogin): Promise<Token> => {
    const response = await api.post<Token>('/auth/login', credentials);
    return response.data;
  },

  guestLogin: async (): Promise<Token> => {
    const response = await api.post<Token>('/auth/guest-login');
    return response.data;
  },

  me: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },
};
