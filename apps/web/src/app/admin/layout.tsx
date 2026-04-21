import { headers } from 'next/headers';

import { verifyCloudflareAccess } from '@/lib/cloudflare-access';

import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/workspaces', label: 'Workspaces' },
  { href: '/admin/billing', label: 'Billing ops' },
  { href: '/admin/flags', label: 'Feature flags' },
  { href: '/admin/aquila', label: 'Aquila health' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const h = await headers();
  const identity = await verifyCloudflareAccess(h);

  if (!identity) {
    return (
      <html lang="en">
        <body>
          <div className="flex min-h-screen items-center justify-center">
            <p className="text-sm text-gray-500">Access denied.</p>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <div className="flex min-h-screen">
          <aside className="w-52 shrink-0 border-r border-gray-200 bg-white p-4">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Forgentic Admin
            </p>
            <p className="mb-4 truncate px-3 text-xs text-gray-500">{identity.email}</p>
            <nav className="space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
