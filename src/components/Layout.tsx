import React from 'react';
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Globe, Settings, LogOut, Menu, HandCoins, ShieldCheck, Waypoints, Rocket } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { cn } from '../lib/utils';
import { Spinner } from './ui/Spinner';

export default function Layout() {
  const { user, loading, signOut } = useAuth();
  const { profile } = useUserProfile();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Spinner className="w-8 h-8 text-zinc-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isAdmin = profile?.role === 'admin';

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    ...(isAdmin ? [{ name: 'Owner Admin', href: '/admin', icon: ShieldCheck }] : [{ name: 'My Sites', href: '/sites', icon: Globe }]),
    { name: 'Deployments', href: '/deployments', icon: Rocket },
    { name: 'Domains', href: '/domains', icon: Waypoints },
    { name: 'Commissions', href: '/commissions', icon: HandCoins },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col md:flex-row selection:bg-zinc-800">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <div className="w-6 h-6 bg-white rounded-md"></div>
          TradeSaaS
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-zinc-400 hover:text-zinc-50">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar */}
      <div className={cn(
        "md:w-64 border-r border-zinc-800 bg-zinc-950 flex-col transition-all duration-300 z-50",
        "fixed md:sticky top-0 h-screen w-full md:flex",
        mobileMenuOpen ? "flex" : "hidden"
      )}>
        <div className="h-16 hidden md:flex items-center px-6 border-b border-zinc-800">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <div className="w-6 h-6 bg-white rounded-md"></div>
            TradeSaaS
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
                            (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all',
                  isActive
                    ? 'bg-zinc-800 text-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium border border-zinc-700">
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-zinc-300">{user.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

