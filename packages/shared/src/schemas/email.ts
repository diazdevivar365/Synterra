// Email schema — canonical validator. Normalises to lowercase on parse so
// uniqueness checks downstream don't have to worry about case.

import { z } from 'zod';

export const EmailSchema = z.string().email().toLowerCase();

export type Email = z.infer<typeof EmailSchema>;
