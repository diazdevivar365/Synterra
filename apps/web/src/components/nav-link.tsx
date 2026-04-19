'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@synterra/ui';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
}

export function NavLink({ href, children, exact = false }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-surface-elevated text-fg font-medium'
          : 'text-muted-fg hover:bg-surface hover:text-fg',
      )}
    >
      {children}
    </Link>
  );
}
