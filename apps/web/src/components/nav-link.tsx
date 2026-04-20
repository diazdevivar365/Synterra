'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@synterra/ui';

import type { ReactNode } from 'react';

interface NavLinkProps {
  href: string;
  children: ReactNode;
  exact?: boolean;
  icon?: ReactNode;
}

export function NavLink({ href, children, exact = false, icon }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-150',
        isActive
          ? 'border-accent bg-surface-elevated text-fg border-l-[3px] pl-[9px] font-medium'
          : 'text-muted-fg hover:bg-surface-elevated hover:text-fg',
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
