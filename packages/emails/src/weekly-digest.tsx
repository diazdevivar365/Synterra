import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';

import type { ReactElement } from 'react';

export interface DigestChange {
  brandName: string;
  title: string;
  severity: 'info' | 'warning' | 'critical';
  occurredAt: string;
}

export interface WeeklyDigestProps {
  workspaceName: string;
  weekStart: string;
  weekEnd: string;
  changes: DigestChange[];
  brandsMonitored: number;
  runsCompleted: number;
  creditsUsed: number;
  dashboardUrl: string;
}

const SEV_DOT: Record<string, string> = {
  info: '#3b82f6',
  warning: '#f59e0b',
  critical: '#ef4444',
};

export function WeeklyDigest({
  workspaceName,
  weekStart,
  weekEnd,
  changes,
  brandsMonitored,
  runsCompleted,
  creditsUsed,
  dashboardUrl,
}: WeeklyDigestProps): ReactElement {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        Brand Pulse for {workspaceName} — {weekStart} to {weekEnd}
      </Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ maxWidth: '560px', padding: '32px 24px' }}>
          <Text
            style={{
              fontSize: '11px',
              color: '#6b7280',
              margin: '0 0 4px',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Weekly Brand Pulse · {workspaceName}
          </Text>
          <Heading as="h1" style={{ fontSize: '22px', margin: '0 0 20px' }}>
            {weekStart} – {weekEnd}
          </Heading>

          <Section
            style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '16px',
              margin: '0 0 24px',
            }}
          >
            <Row>
              <Column style={{ textAlign: 'center' }}>
                <Text style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 }}>
                  {brandsMonitored}
                </Text>
                <Text
                  style={{ fontSize: '11px', color: '#6b7280', margin: 0, fontFamily: 'monospace' }}
                >
                  BRANDS
                </Text>
              </Column>
              <Column style={{ textAlign: 'center' }}>
                <Text style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 }}>
                  {runsCompleted}
                </Text>
                <Text
                  style={{ fontSize: '11px', color: '#6b7280', margin: 0, fontFamily: 'monospace' }}
                >
                  RUNS
                </Text>
              </Column>
              <Column style={{ textAlign: 'center' }}>
                <Text style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 }}>
                  {creditsUsed.toLocaleString()}
                </Text>
                <Text
                  style={{ fontSize: '11px', color: '#6b7280', margin: 0, fontFamily: 'monospace' }}
                >
                  CREDITS
                </Text>
              </Column>
            </Row>
          </Section>

          {changes.length > 0 ? (
            <>
              <Text
                style={{
                  fontSize: '11px',
                  color: '#6b7280',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  margin: '0 0 8px',
                }}
              >
                Notable changes ({changes.length})
              </Text>
              {changes.slice(0, 8).map((c, i) => (
                <Row key={i} style={{ borderBottom: '1px solid #f3f4f6', padding: '10px 0' }}>
                  <Column style={{ width: '10px', verticalAlign: 'top', paddingTop: '4px' }}>
                    <Text
                      style={{
                        color: SEV_DOT[c.severity] ?? '#6b7280',
                        fontSize: '10px',
                        margin: 0,
                      }}
                    >
                      ●
                    </Text>
                  </Column>
                  <Column style={{ paddingLeft: '8px' }}>
                    <Text
                      style={{
                        fontSize: '13px',
                        color: '#111827',
                        margin: '0 0 2px',
                        fontWeight: 600,
                      }}
                    >
                      {c.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: '11px',
                        color: '#6b7280',
                        margin: 0,
                        fontFamily: 'monospace',
                      }}
                    >
                      {c.brandName} · {c.occurredAt}
                    </Text>
                  </Column>
                </Row>
              ))}
            </>
          ) : (
            <Text style={{ fontSize: '14px', color: '#6b7280', fontStyle: 'italic' }}>
              No significant brand changes detected this week.
            </Text>
          )}

          <Section style={{ margin: '28px 0 0' }}>
            <Button
              href={dashboardUrl}
              style={{
                backgroundColor: '#111827',
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Open dashboard →
            </Button>
          </Section>
          <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />
          <Text style={{ fontSize: '12px', color: '#6b7280' }}>
            Weekly digest for {workspaceName}. Manage preferences in workspace settings.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WeeklyDigest;
