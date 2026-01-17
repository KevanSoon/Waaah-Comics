'use client';

import { UserButton as ClerkUserButton, SignInButton, useAuth } from '@clerk/nextjs';
import { LogIn } from 'lucide-react';

export default function UserButton() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-700 animate-pulse" />
    );
  }

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium">
          <LogIn size={16} />
          Sign In
        </button>
      </SignInButton>
    );
  }

  return (
    <ClerkUserButton
      afterSignOutUrl="/"
      appearance={{
        elements: {
          avatarBox: 'w-9 h-9',
          userButtonPopoverCard: 'bg-gray-800 border border-gray-700',
          userButtonPopoverActionButton: 'text-white hover:bg-gray-700',
          userButtonPopoverActionButtonText: 'text-white',
          userButtonPopoverFooter: 'hidden',
        },
      }}
    />
  );
}
