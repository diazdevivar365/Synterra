import {
  Body,
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

export interface ChangeAlertProps {
  workspaceName: string;
  brandName: string;
  title: string;
  description: string | null;
  severity: 'info' | 'warning' | 'critical';
  changeUrl: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  info: '#3b82f6',
  warning: '#f59e0b',
  critical: '#ef4444',
};

export function ChangeAlert({
  workspaceName,
  brandName,
  title,
  description,
  severity,
  changeUrl,
}: ChangeAlertProps): ReactElement {
  const dot = SEVERITY_COLOR[severity] ?? '#6b7280';

  return (
    <Html lang="en">
      <Head />
      <Preview>
        Brand alert for {brandName}: {title}
      </Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ maxWidth: '560px', padding: '32px 24px' }}>
          <Text
            style={{
              fontSize: '11px',
              color: '#6b7280',
              margin: '0 0 8px',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {workspaceName}
          </Text>
          <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 4px' }}>
            {title}
          </Heading>
          <Text
            style={{
              fontSize: '11px',
              color: dot,
              fontFamily: 'monospace',
              margin: '0 0 20px',
              textTransform: 'uppercase',
            }}
          >
            ● {severity} · {brandName}
          </Text>
          {description && (
            <Text style={{ fontSize: '15px', lineHeight: '22px', color: '#374151' }}>
              {description}
            </Text>
          )}
          <Section style={{ margin: '24px 0' }}>
            <Link
              href={changeUrl}
              style={{
                backgroundColor: '#111827',
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              View change →
            </Link>
          </Section>
          <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />
          <Text style={{ fontSize: '12px', color: '#6b7280' }}>
            Manage notification preferences in workspace settings.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ChangeAlert;
