'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="h-full flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
        <p className="text-gray-400 mb-8">Sign in to access PanelPop Studio</p>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'bg-gray-800 border border-gray-700 shadow-2xl',
              headerTitle: 'text-white',
              headerSubtitle: 'text-gray-400',
              formFieldLabel: 'text-gray-300',
              formFieldInput: 'bg-gray-700 border-gray-600 text-white placeholder-gray-500',
              formButtonPrimary: 'bg-purple-600 hover:bg-purple-700 text-white',
              footerActionLink: 'text-purple-400 hover:text-purple-300',
              identityPreviewText: 'text-white',
              identityPreviewEditButton: 'text-purple-400',
              formFieldInputShowPasswordButton: 'text-gray-400',
              dividerLine: 'bg-gray-600',
              dividerText: 'text-gray-500',
              socialButtonsBlockButton: 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600',
              socialButtonsBlockButtonText: 'text-white',
            },
          }}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
        />
      </div>
    </div>
  );
}
