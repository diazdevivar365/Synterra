// @synterra/emails — transactional email templates + renderers.

import { render } from '@react-email/render';
import { createElement } from 'react';

import { ChangeAlert, type ChangeAlertProps } from './change-alert';
import { Invite, type InviteProps } from './invite';
import { MagicLink, type MagicLinkProps } from './magic-link';
import { PaymentFailed, type PaymentFailedProps } from './payment-failed';
import { QuotaWarning, type QuotaWarningProps } from './quota-warning';
import { WeeklyDigest, type WeeklyDigestProps } from './weekly-digest';
import { Welcome, type WelcomeProps } from './welcome';

export { Welcome, type WelcomeProps } from './welcome';
export { MagicLink, type MagicLinkProps } from './magic-link';
export { Invite, type InviteProps } from './invite';
export { ChangeAlert, type ChangeAlertProps } from './change-alert';
export { QuotaWarning, type QuotaWarningProps } from './quota-warning';
export { PaymentFailed, type PaymentFailedProps } from './payment-failed';
export { WeeklyDigest, type WeeklyDigestProps, type DigestChange } from './weekly-digest';

export async function renderWelcome(props: WelcomeProps): Promise<string> {
  return render(createElement(Welcome, props));
}

export async function renderMagicLink(props: MagicLinkProps): Promise<string> {
  return render(createElement(MagicLink, props));
}

export async function renderInvite(props: InviteProps): Promise<string> {
  return render(createElement(Invite, props));
}

export async function renderChangeAlert(props: ChangeAlertProps): Promise<string> {
  return render(createElement(ChangeAlert, props));
}

export async function renderQuotaWarning(props: QuotaWarningProps): Promise<string> {
  return render(createElement(QuotaWarning, props));
}

export async function renderPaymentFailed(props: PaymentFailedProps): Promise<string> {
  return render(createElement(PaymentFailed, props));
}

export async function renderWeeklyDigest(props: WeeklyDigestProps): Promise<string> {
  return render(createElement(WeeklyDigest, props));
}
