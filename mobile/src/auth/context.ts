import { createContext } from 'react';
import type { User } from '../types';

export interface AuthContextValue {
  user: User | null;
  /** True while the initial session bootstrap (token → /me) is running. */
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
