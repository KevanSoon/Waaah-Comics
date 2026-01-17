import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import Navigation from '@/components/shared/Navigation';
import { AssetProvider } from '@/context/AssetContext';
import { AuthProvider } from '@/context/AuthContext';
import { ProjectsProvider } from '@/context/ProjectsContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PanelPop Studio',
  description: 'Create comics with gesture-controlled drawing and AI-powered generation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#9333ea',
          colorBackground: '#1f2937',
        },
        elements: {
          card: 'bg-gray-800 border-gray-700',
          headerTitle: 'text-white',
          headerSubtitle: 'text-gray-400',
          formFieldLabel: 'text-gray-300',
          formFieldInput: 'bg-gray-700 border-gray-600 text-white',
          formButtonPrimary: 'bg-purple-600 hover:bg-purple-700',
          footerActionLink: 'text-purple-400 hover:text-purple-300',
        },
      }}
    >
      <html lang="en">
        <body className={`${inter.className} bg-gray-950 min-h-screen`}>
          <AuthProvider>
            <AssetProvider>
              <ProjectsProvider>
                <Navigation />
                <main className="h-[calc(100vh-64px)]">{children}</main>
              </ProjectsProvider>
            </AssetProvider>
          </AuthProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
