import { redirect } from 'next/navigation';

import { devLogin } from './_actions';

export default function DevLoginPage() {
  if (!process.env['DEV_AUTO_LOGIN_SECRET']) redirect('/sign-in');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold text-gray-900">Dev login</h1>
        <p className="mb-6 text-sm text-gray-500">Enter any email — no password required.</p>
        <form action={devLogin} className="flex flex-col gap-4">
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
