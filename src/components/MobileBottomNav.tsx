import React from 'react';
import { Bookmark, Library, Search, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface MobileBottomNavProps {
  hidden: boolean;
  onProfileClick: () => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ hidden, onProfileClick }) => {
  const location = useLocation();
  if (hidden) return null;

  const navItems = [
    {
      label: 'Library',
      href: '/library',
      icon: Library,
      active: /^\/(?:library|books|browse|curriculum)(?:\/|$)/.test(location.pathname),
    },
    {
      label: 'Search',
      href: '/search',
      icon: Search,
      active: location.pathname === '/search',
    },
    {
      label: 'Saved',
      href: '/mylibrary',
      icon: Bookmark,
      active: location.pathname === '/mylibrary' && location.hash !== '#profile',
    },
    {
      label: 'Profile',
      href: '/mylibrary',
      icon: User,
      active: false,
      action: onProfileClick,
    },
  ];

  return (
    <nav className="fixed inset-x-3 bottom-3 z-[850] md:hidden" aria-label="Mobile primary navigation">
      <div className="grid grid-cols-4 gap-1 rounded-xl border border-bit-border bg-bit-bg p-1 shadow-2xl shadow-black/30">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            item.action ? (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg bg-bit-panel/35 px-1.5 py-2 text-[9px] font-bold text-bit-muted transition-all hover:bg-bit-panel hover:text-bit-text"
              >
                <Icon size={17} />
                <span className="truncate">{item.label}</span>
              </button>
            ) : (
              <Link
                key={item.label}
                to={item.href}
                className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-2 text-[9px] font-bold transition-all ${item.active ? 'bg-bit-accent text-white shadow-md shadow-bit-accent/20' : 'bg-bit-panel/35 text-bit-muted hover:bg-bit-panel hover:text-bit-text'}`}
                aria-current={item.active ? 'page' : undefined}
              >
                <Icon size={17} />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
