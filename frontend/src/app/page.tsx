'use client';

import Link from 'next/link';
import { Hand, LayoutGrid, Sparkles, ArrowRight, User } from 'lucide-react';
import { useAuth, SignInButton } from '@clerk/nextjs';

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-8">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-500 to-orange-400 bg-clip-text text-transparent">
          PanelPop Studio
        </h1>
        <p className="text-gray-400 text-xl max-w-2xl">
          Create stunning comics with gesture-controlled drawing and AI-powered image generation
        </p>
        
        {isLoaded && !isSignedIn && (
          <div className="mt-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700 max-w-md mx-auto">
            <p className="text-gray-300 mb-3">
              Sign in to save your work and sync across devices
            </p>
            <SignInButton mode="modal">
              <button className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors mx-auto">
                <User size={18} />
                Sign In to Get Started
              </button>
            </SignInButton>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full">
        <Link
          href="/gesture"
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-900/50 to-purple-800/30 border border-purple-700/50 p-8 hover:border-purple-500 transition-all hover:scale-[1.02]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/30 transition-all" />
          <Hand className="w-12 h-12 text-purple-400 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Gesture Canvas</h2>
          <p className="text-gray-400 mb-4">
            Draw touch-free using hand gestures. Transform your sketches into polished artwork with AI.
          </p>
          <div className="flex items-center gap-2 text-purple-400 font-medium">
            Start Drawing <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          href="/comic"
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-900/50 to-pink-800/30 border border-pink-700/50 p-8 hover:border-pink-500 transition-all hover:scale-[1.02]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl group-hover:bg-pink-500/30 transition-all" />
          <LayoutGrid className="w-12 h-12 text-pink-400 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Comic Studio</h2>
          <p className="text-gray-400 mb-4">
            Arrange images into comic panel layouts. Generate assets with AI or upload your own.
          </p>
          <div className="flex items-center gap-2 text-pink-400 font-medium">
            Create Comics <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      <div className="mt-12 flex items-center gap-2 text-gray-500">
        <Sparkles className="w-5 h-5" />
        <span>Powered by Google Gemini AI</span>
      </div>
    </div>
  );
}
