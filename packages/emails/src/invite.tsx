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

export interface InviteProps {
  inviterName: string;
  workspaceName: string;
  inviteUrl: string;
}

export function Invite({ inviterName, workspaceName, inviteUrl }: InviteProps): ReactElement {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {inviterName} invited you to {workspaceName} on Forgentic.
      </Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ maxWidth: '560px', padding: '32px 24px' }}>
          <Heading as="h1" style={{ fontSize: '24px', margin: '0 0 16px' }}>
            You&rsquo;ve been invited
          </Heading>
          <Text style={{ fontSize: '16px', lineHeight: '24px', color: '#111827' }}>
            <strong>{inviterName}</strong> invited you to join the <strong>{workspaceName}</strong>{' '}
            workspace on Forgentic.
          </Text>
          <Section style={{ margin: '24px 0' }}>
            <Button
              href={inviteUrl}
              style={{
                backgroundColor: '#111827',
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Accept invitation →
            </Button>
          </Section>
          <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />
          <Text style={{ fontSize: '12px', color: '#6b7280' }}>
            This invitation expires in 48 hours. If you weren&rsquo;t expecting it, ignore this
            email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default Invite;
