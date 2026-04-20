'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, ReactNode } from 'react';

import { cn } from '@synterra/ui';

interface NavLinkProps {
  href: string;
  children: ReactNode;
  exact?: boolean;
  icon?: ComponentType<{ className?: string }>;
}

export function NavLink({ href, children, exact = false, icon: Icon }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-150',
        isActive
          ? 'border-l-[3px] border-accent bg-surface-elevated pl-[9px] text-fg font-medium'
          : 'text-muted-fg hover:bg-surface-elevated hover:text-fg',
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {children}
    </Link>
  );
}
