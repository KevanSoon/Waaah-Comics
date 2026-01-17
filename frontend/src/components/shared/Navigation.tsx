'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Hand, LayoutGrid, Home, FolderOpen } from 'lucide-react';
import UserButton from './UserButton';

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/gesture', label: 'Gesture Canvas', icon: Hand },
    { href: '/comic', label: 'Comic Studio', icon: LayoutGrid },
    { href: '/projects', label: 'Projects', icon: FolderOpen },
  ];

  return (
    <nav className="bg-gray-900 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              PanelPop Studio
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="border-l border-gray-700 pl-4">
              <UserButton />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
