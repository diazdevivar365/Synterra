import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

import type { ReactElement } from 'react';

export interface QuotaWarningProps {
  workspaceName: string;
  creditsUsed: number;
  creditsGranted: number;
  pct: number;
  billingUrl: string;
}

export function QuotaWarning({
  workspaceName,
  creditsUsed,
  creditsGranted,
  pct,
  billingUrl,
}: QuotaWarningProps): ReactElement {
  const isHard = pct >= 100;

  return (
    <Html lang="en">
      <Head />
      <Preview>
        {isHard
          ? `${workspaceName} hit its credit limit — research runs paused.`
          : `${workspaceName} has used ${pct}% of its monthly credits.`}
      </Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ maxWidth: '560px', padding: '32px 24px' }}>
          <Heading as="h1" style={{ fontSize: '24px', margin: '0 0 16px' }}>
            {isHard ? 'Credit limit reached' : `${pct}% of credits used`}
          </Heading>
          <Text style={{ fontSize: '16px', lineHeight: '24px', color: '#111827' }}>
            <strong>{workspaceName}</strong> has consumed{' '}
            <strong>
              {creditsUsed.toLocaleString()} / {creditsGranted.toLocaleString()}
            </strong>{' '}
            monthly credits ({pct}%).{' '}
            {isHard
              ? 'New research runs are paused until next cycle or you upgrade.'
              : 'Upgrade now to avoid hitting the limit.'}
          </Text>
          <Section style={{ margin: '24px 0' }}>
            <Button
              href={billingUrl}
              style={{
                backgroundColor: '#111827',
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              {isHard ? 'Upgrade plan' : 'View billing →'}
            </Button>
          </Section>
          <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />
          <Text style={{ fontSize: '12px', color: '#6b7280' }}>
            Credits reset at the start of your next billing period.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default QuotaWarning;
