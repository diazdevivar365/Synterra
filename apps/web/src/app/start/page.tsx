import { StartForm } from './_components/StartForm.js';

export const metadata = { title: 'Analyze your brand — Forgentic' };

export default function StartPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-xl space-y-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          See your brand&apos;s DNA in 90 seconds
        </h1>
        <p className="text-neutral-400">
          Paste any website URL. No sign-up required to see your preview.
        </p>
        <StartForm siteKey={process.env['CLOUDFLARE_TURNSTILE_SITE_KEY'] ?? ''} />
      </div>
    </main>
  );
}
