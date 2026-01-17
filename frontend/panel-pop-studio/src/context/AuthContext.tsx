'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';

interface User {
  id: string;
  clerkId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const [user, setUser] = useState<User | null>(null);

  // Sync user with backend when signed in
  useEffect(() => {
    async function syncUser() {
      if (isLoaded && isSignedIn && clerkUser) {
        try {
          const token = await getToken();
          if (!token) return;

          // Sync user with backend
          const response = await fetch(`${API_BASE_URL}/api/auth/sync`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            setUser({
              id: data.user_id,
              clerkId: clerkUser.id,
              email: clerkUser.primaryEmailAddress?.emailAddress || null,
              firstName: clerkUser.firstName,
              lastName: clerkUser.lastName,
              imageUrl: clerkUser.imageUrl,
            });
          }
        } catch (error) {
          console.error('Failed to sync user:', error);
        }
      } else if (isLoaded && !isSignedIn) {
        setUser(null);
      }
    }

    syncUser();
  }, [isLoaded, isSignedIn, clerkUser, getToken]);

  // Authenticated fetch wrapper
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    
    const headers = new Headers(options.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

    return fetch(fullUrl, {
      ...options,
      headers,
    });
  }, [getToken]);

  const getTokenWrapper = useCallback(async () => {
    return await getToken();
  }, [getToken]);

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        isLoaded, 
        isSignedIn: isSignedIn ?? false, 
        getToken: getTokenWrapper,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
