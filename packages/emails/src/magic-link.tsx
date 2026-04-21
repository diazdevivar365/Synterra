import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components';

import type { ReactElement } from 'react';

export interface MagicLinkProps {
  email: string;
  magicLink: string;
}

export function MagicLink({ email, magicLink }: MagicLinkProps): ReactElement {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your Forgentic sign-in link — valid for 10 minutes.</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ maxWidth: '560px', padding: '32px 24px' }}>
          <Heading as="h1" style={{ fontSize: '24px', margin: '0 0 16px' }}>
            Sign in to Forgentic
          </Heading>
          <Text style={{ fontSize: '16px', lineHeight: '24px', color: '#111827' }}>
            Click the button below to sign in as <strong>{email}</strong>. This link expires in 10
            minutes and can only be used once.
          </Text>
          <Button
            href={magicLink}
            style={{
              backgroundColor: '#111827',
              color: '#ffffff',
              padding: '12px 20px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 600,
              display: 'inline-block',
              margin: '24px 0',
            }}
          >
            Sign in →
          </Button>
          <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />
          <Text style={{ fontSize: '12px', color: '#6b7280' }}>
            If you didn&rsquo;t request this, ignore this email. The link expires automatically.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default MagicLink;
