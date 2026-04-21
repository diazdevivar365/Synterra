import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

import type { ReactElement } from 'react';

export interface PaymentFailedProps {
  workspaceName: string;
  invoiceUrl: string;
  billingUrl: string;
}

export function PaymentFailed({
  workspaceName,
  invoiceUrl,
  billingUrl,
}: PaymentFailedProps): ReactElement {
  return (
    <Html lang="en">
      <Head />
      <Preview>Payment failed for {workspaceName} — update your card to keep access.</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ maxWidth: '560px', padding: '32px 24px' }}>
          <Heading as="h1" style={{ fontSize: '24px', margin: '0 0 16px' }}>
            Payment failed
          </Heading>
          <Text style={{ fontSize: '16px', lineHeight: '24px', color: '#111827' }}>
            We couldn&rsquo;t charge the payment method on file for <strong>{workspaceName}</strong>
            . Update your billing details to keep your subscription active. If payment isn&rsquo;t
            resolved within 7 days, your workspace will be downgraded to trial.
          </Text>
          <Section style={{ margin: '24px 0' }}>
            <Button
              href={billingUrl}
              style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Update payment method →
            </Button>
          </Section>
          <Text style={{ fontSize: '14px', color: '#374151' }}>
            <Link href={invoiceUrl} style={{ color: '#6b7280' }}>
              View failed invoice
            </Link>
          </Text>
          <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />
          <Text style={{ fontSize: '12px', color: '#6b7280' }}>
            This email was sent because a payment for your Forgentic subscription failed.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default PaymentFailed;
