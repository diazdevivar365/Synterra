import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="bg-background flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
