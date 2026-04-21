import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Changelog' };

const ENTRIES = [
  {
    date: 'April 2026',
    version: '0.9',
    title: 'GDPR compliance, audit logs, and cookie consent',
    items: [
      'Data export endpoint — download all workspace data as JSON from Settings → Data & Privacy',
      'Workspace deletion with 30-day grace period',
      'Audit log surface for Scale and Enterprise plans',
      'Cookie consent banner with accept/decline',
      'Privacy Policy and Terms of Service pages',
    ],
  },
  {
    date: 'April 2026',
    version: '0.8',
    title: 'Admin console and feature flags',
    items: [
      'Admin app secured via Cloudflare Access JWT verification',
      'Workspace explorer with impersonation capability',
      'Plan and billing operations panel',
      'Feature flag toggles per workspace',
    ],
  },
  {
    date: 'April 2026',
    version: '0.7',
    title: 'Public API and outbound webhooks',
    items: [
      'API key issuance and management UI',
      'v1 REST endpoints: brands, changes, export',
      'Outbound webhook endpoints with HMAC-SHA256 signing',
      'Webhook delivery log with failure count tracking',
    ],
  },
  {
    date: 'April 2026',
    version: '0.6',
    title: 'Notifications, Slack, and email templates',
    items: [
      'In-app notification inbox with SSE streaming',
      'Slack workspace integration (Growth+ plans)',
      'Weekly Brand Pulse digest email',
      'React Email templates: magic link, invite, quota warning, payment failed',
    ],
  },
  {
    date: 'April 2026',
    version: '0.5',
    title: 'Brand dashboard, research, and AI generation',
    items: [
      'Brand DNA viewer and competitor change feed',
      'Research run UI with live progress streaming',
      'AI generation surface: brand voice and battlecard',
      'Usage aggregation and quota enforcement',
    ],
  },
] as const;

export default function ChangelogPage() {
  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="text-fg mb-2 text-3xl font-bold tracking-tight">Changelog</h1>
        <p className="text-muted-fg mb-16 text-sm">
          Product updates and improvements to Forgentic.
        </p>

        <div className="space-y-16">
          {ENTRIES.map((entry) => (
            <article key={`${entry.version}-${entry.date}`}>
              <div className="mb-4 flex items-center gap-3">
                <span className="text-muted-fg text-xs">{entry.date}</span>
                <span className="bg-surface border-border text-muted-fg rounded border px-1.5 py-0.5 font-mono text-xs">
                  v{entry.version}
                </span>
              </div>
              <h2 className="text-fg mb-4 text-lg font-semibold">{entry.title}</h2>
              <ul className="space-y-2">
                {entry.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-brand-400 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                    <span className="text-muted-fg text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
