import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { readonly children: ReactNode }) {
  return <div className="min-h-dvh bg-[#000000] text-[#ffffff]">{children}</div>;
}
