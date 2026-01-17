'use client';

import { Sparkles, User } from 'lucide-react';
import { useAuth, SignInButton } from '@clerk/nextjs';
import BalloonBackground from '@/components/ui/balloons-pop-background';
import { ContainerScroll } from '@/components/ui/container-scroll-animation';
import Image from 'next/image';

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <>
      <BalloonBackground />
      <div className="flex flex-col overflow-hidden">
        <ContainerScroll
          titleComponent={
            <>
              <h1 className="text-4xl font-semibold text-white">
                Create stunning comics with <br />
                <span className="text-4xl md:text-[6rem] font-bold mt-1 leading-none bg-gradient-to-r from-purple-400 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                  Waaah-Comics
                </span>
              </h1>
              <p className="text-gray-400 text-xl max-w-2xl mx-auto mt-4">
                Gesture-controlled drawing and AI-powered image generation
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
            </>
          }
        >
          <Image
            src="/comic-hero.png"
            alt="Comic panel showcase"
            height={720}
            width={1400}
            className="mx-auto rounded-2xl object-contain w-full h-auto"
            draggable={false}
          />
        </ContainerScroll>

        <div className="flex items-center justify-center gap-2 text-gray-500 pb-8">
          <Sparkles className="w-5 h-5" />
          <span>Powered by Google Gemini AI</span>
        </div>
      </div>
    </>
  );
}
