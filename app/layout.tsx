'use client';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import Navigation from '@/components/Navigation';
import "./globals.css";

function AppContent({ children }: { children: React.ReactNode }) {
  const { user, loading, login } = useAuth();

  // 1. Wait for Firebase to check the login status
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-sm font-medium text-gray-400 animate-pulse">Initializing...</div>
      </div>
    );
  }

  // 2. If no user, show the clean Google-style Login Page
  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="mb-8">
            <span className="text-[#232E65] font-bold text-3xl tracking-tight">MEDE</span><span className="text-[#C41D26] font-bold text-3xl tracking-tight">ZIDE</span>
            <span className="font-bold text-black text-3xl ml-1">- Manager</span>
          </div>
          <h1 className="text-xl font-semibold text-black mb-2">Sign in</h1>
          <p className="text-gray-500 mb-8">Use your Medezide Google Account</p>
          <button 
            onClick={login}
            className="w-full bg-black text-white py-3 rounded-md font-medium hover:bg-gray-800 transition-all flex items-center justify-center gap-3"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  // 3. If logged in, show the Sidebar + Content
  return (
    <div className="flex min-h-screen bg-white text-black">
      <Navigation />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="mx-auto p-4">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <AppContent>{children}</AppContent>
        </AuthProvider>
      </body>
    </html>
  );
}