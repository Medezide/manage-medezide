'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Navigation() {
  const { logout } = useAuth();
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/' },
    { name: 'News Process', href: '/news' },
  ];

  return (
    <aside className="w-64 border-r border-gray-200 bg-white flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-gray-100">
        <span className="text-[#232E65] font-bold text-xl tracking-tight">Medezide</span>
        <span className="text-[#C41D26] font-bold text-xl ml-1">Internal</span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-gray-100 text-black border-l-4 border-[#C41D26]' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-black'
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <button
          onClick={logout}
          className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:text-[#C41D26] font-medium transition-colors"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}