// @synterra/emails — transactional email templates + renderers.

import { render } from '@react-email/render';
import { createElement } from 'react';

import { Welcome, type WelcomeProps } from './welcome.js';

export { Welcome, type WelcomeProps } from './welcome.js';

/**
 * Render the <Welcome> template to an HTML string. Used by the worker that
 * hands the final payload to the SMTP/SES driver.
 */
export async function renderWelcome(props: WelcomeProps): Promise<string> {
  return render(createElement(Welcome, props));
}
