export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed text-gray-700">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="mb-8 text-xs text-gray-400">Last updated: April 2026</p>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">1. Information we collect</h2>
        <p>
          We collect information you provide when creating an account (name, email address) and
          information generated while using the service (workspace activity, brand monitoring
          results, usage metrics). We also collect standard server logs (IP address, user agent,
          request timestamps).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">2. How we use your information</h2>
        <p>We use collected data to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Provide, operate, and improve the Forgentic service</li>
          <li>Send transactional emails (magic links, alerts, billing receipts)</li>
          <li>Detect and prevent fraud or abuse</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">3. Data retention</h2>
        <p>
          We retain your data for as long as your account is active. If you request deletion, your
          workspace data is soft-deleted immediately and permanently purged within 30 days. You can
          request deletion from <strong>Settings → Data &amp; Privacy</strong>.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">4. Cookies</h2>
        <p>
          We use essential cookies required for authentication and session management. Analytics
          cookies are only set with your consent. You can withdraw consent at any time by clearing
          your browser cookies.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">5. Your rights (GDPR)</h2>
        <p>If you are in the European Economic Area, you have the right to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Access your personal data (data export via Settings)</li>
          <li>Rectify inaccurate data</li>
          <li>Erasure ("right to be forgotten") via workspace deletion</li>
          <li>Portability of your data in machine-readable JSON format</li>
          <li>Object to processing for direct marketing purposes</li>
        </ul>
        <p className="mt-2">
          To exercise these rights, contact us at{' '}
          <a href="mailto:privacy@forgentic.io" className="underline">
            privacy@forgentic.io
          </a>
          .
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">6. Sub-processors</h2>
        <p>We share data with the following sub-processors to operate the service:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Stripe — payment processing</li>
          <li>Resend — transactional email delivery</li>
          <li>Cloudflare — CDN, DDoS protection, and access control</li>
          <li>WorkOS — enterprise SSO / SAML</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">7. Contact</h2>
        <p>
          Forgentic SRL, Buenos Aires, Argentina.{' '}
          <a href="mailto:privacy@forgentic.io" className="underline">
            privacy@forgentic.io
          </a>
        </p>
      </section>
    </article>
  );
}
