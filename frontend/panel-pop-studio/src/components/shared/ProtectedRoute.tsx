'use client';

import { useAuth, SignIn } from '@clerk/nextjs';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export default function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Sign in to continue</h2>
          <p className="text-gray-400 mb-8">
            Please sign in to access this feature and save your work.
          </p>
          <SignIn 
            routing="hash"
            appearance={{
              elements: {
                rootBox: 'mx-auto',
                card: 'bg-gray-800 border border-gray-700',
                headerTitle: 'text-white',
                headerSubtitle: 'text-gray-400',
                formFieldLabel: 'text-gray-300',
                formFieldInput: 'bg-gray-700 border-gray-600 text-white',
                formButtonPrimary: 'bg-purple-600 hover:bg-purple-700',
                footerActionLink: 'text-purple-400 hover:text-purple-300',
              },
            }}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
