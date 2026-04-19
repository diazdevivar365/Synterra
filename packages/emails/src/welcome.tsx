// Forgentic welcome email — sent on workspace creation (PLAN.md §D.1).

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

export interface WelcomeProps {
  workspaceName: string;
  signInUrl: string;
}

export function Welcome({ workspaceName, signInUrl }: WelcomeProps): ReactElement {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your Forgentic workspace is ready — sign in to get started.</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ maxWidth: '560px', padding: '32px 24px' }}>
          <Heading as="h1" style={{ fontSize: '24px', margin: '0 0 16px' }}>
            Welcome to Forgentic
          </Heading>
          <Text style={{ fontSize: '16px', lineHeight: '24px', color: '#111827' }}>
            Your workspace <strong>{workspaceName}</strong> is live. Sign in to kick off your first
            brand-intelligence run.
          </Text>
          <Section style={{ margin: '24px 0' }}>
            <Button
              href={signInUrl}
              style={{
                backgroundColor: '#111827',
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Sign in to {workspaceName}
            </Button>
          </Section>
          <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />
          <Text style={{ fontSize: '12px', color: '#6b7280' }}>
            You&rsquo;re receiving this because a Forgentic workspace was created with this address.
            If that wasn&rsquo;t you, reply to this email and we&rsquo;ll sort it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default Welcome;
