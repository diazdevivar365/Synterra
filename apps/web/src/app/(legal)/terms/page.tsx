export const metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed text-gray-700">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Terms of Service</h1>
      <p className="mb-8 text-xs text-gray-400">Last updated: April 2026</p>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">1. Acceptance</h2>
        <p>
          By accessing or using Forgentic, you agree to be bound by these Terms. If you do not
          agree, do not use the service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">2. Service description</h2>
        <p>
          Forgentic is a brand intelligence platform that monitors competitor activity, tracks brand
          changes, and generates marketing assets. We reserve the right to modify or discontinue
          features with reasonable notice.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">3. Accounts and workspaces</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and
          for all activity that occurs under your account. Notify us immediately of any unauthorized
          use at{' '}
          <a href="mailto:security@forgentic.io" className="underline">
            security@forgentic.io
          </a>
          .
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">4. Acceptable use</h2>
        <p>You may not use Forgentic to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Violate any applicable law or regulation</li>
          <li>Scrape or harvest data beyond your authorized quota</li>
          <li>Interfere with or disrupt the service infrastructure</li>
          <li>Circumvent rate limits, quotas, or access controls</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">5. Billing and refunds</h2>
        <p>
          Paid plans are billed monthly or annually in advance. Refunds are provided at our
          discretion for unused periods within 14 days of purchase. Downgrading removes access to
          plan-specific features immediately.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">6. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Forgentic is not liable for indirect, incidental,
          special, or consequential damages arising from your use of the service. Our total
          liability for any claim shall not exceed the amount you paid us in the 12 months preceding
          the claim.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">7. Termination</h2>
        <p>
          Either party may terminate at any time. We may suspend or terminate accounts that violate
          these Terms. Upon termination, your data is subject to our retention and deletion policy
          described in the Privacy Policy.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">8. Governing law</h2>
        <p>
          These Terms are governed by the laws of Argentina. Disputes shall be resolved in the
          courts of Buenos Aires, Argentina.
        </p>
      </section>
    </article>
  );
}
