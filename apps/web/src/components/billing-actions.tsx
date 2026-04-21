'use client';

import { CreditCard, Loader2, Zap } from 'lucide-react';
import { useActionState } from 'react';

import { Button } from '@synterra/ui';

import { checkoutAction, portalAction, type BillingErrorResult } from '@/actions/billing';

interface PlanData {
  slug: string;
  name: string;
  priceCents: number;
  features: readonly string[];
}

interface Props {
  currentPlanSlug: string;
  subscriptionStatus: string | null;
  creditsGranted: number;
  creditsConsumed: number;
  plans: readonly PlanData[];
}

export function BillingActions({
  currentPlanSlug,
  subscriptionStatus,
  creditsGranted,
  creditsConsumed,
  plans,
}: Props) {
  const isActive = subscriptionStatus === 'active';
  const usagePct =
    creditsGranted > 0 ? Math.min(100, Math.round((creditsConsumed / creditsGranted) * 100)) : 0;

  const [checkoutState, checkoutActionFn, checkoutPending] = useActionState<
    BillingErrorResult | null,
    FormData
  >(async (_prev, fd) => checkoutAction(fd), null);

  const [portalState, portalActionFn, portalPending] = useActionState<
    BillingErrorResult | null,
    FormData
  >(async (_prev, _fd) => portalAction(), null);

  return (
    <div className="space-y-8">
      {/* Current plan + usage */}
      <div className="border-border bg-surface rounded-[8px] border p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-fg font-mono text-xs uppercase tracking-wider">Current plan</p>
            <p className="text-fg mt-1 text-xl font-bold capitalize">{currentPlanSlug}</p>
            {subscriptionStatus && (
              <span
                className={`mt-1 inline-block font-mono text-[10px] uppercase tracking-wider ${
                  subscriptionStatus === 'active' ? 'text-success' : 'text-warning'
                }`}
              >
                {subscriptionStatus}
              </span>
            )}
          </div>
          {isActive && (
            <form action={portalActionFn}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={portalPending}
                className="gap-1.5"
              >
                {portalPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <CreditCard className="h-3.5 w-3.5" />
                Manage billing
              </Button>
            </form>
          )}
        </div>

        {creditsGranted > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="text-muted-fg flex items-center justify-between font-mono text-xs">
              <span>Credits used</span>
              <span>
                {creditsConsumed.toLocaleString()} / {creditsGranted.toLocaleString()}
              </span>
            </div>
            <div className="bg-surface-elevated h-1.5 w-full overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full transition-all ${usagePct >= 80 ? 'bg-warning' : 'bg-accent'}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          </div>
        )}

        {portalState && <p className="text-danger mt-3 font-mono text-xs">{portalState.message}</p>}
      </div>

      {/* Plan picker */}
      <div>
        <p className="text-muted-fg mb-4 font-mono text-xs uppercase tracking-wider">
          Available plans
        </p>
        {checkoutState && (
          <p className="border-danger/30 bg-danger/10 text-danger mb-4 rounded-[6px] border px-3 py-2 font-mono text-xs">
            {checkoutState.message}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.slug === currentPlanSlug;
            return (
              <div
                key={plan.slug}
                className={`flex flex-col rounded-[8px] border p-5 ${
                  isCurrent ? 'border-accent bg-surface-elevated' : 'border-border bg-surface'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-fg font-semibold">{plan.name}</p>
                  {isCurrent && (
                    <span className="bg-accent/20 text-accent rounded-full px-2 py-0.5 font-mono text-[10px]">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-fg mt-1 font-mono text-lg font-bold">
                  ${(plan.priceCents / 100).toFixed(0)}
                  <span className="text-muted-fg ml-1 text-xs font-normal">/mo</span>
                </p>
                <ul className="mt-4 flex-1 space-y-1.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="text-muted-fg flex items-center gap-1.5 font-mono text-xs"
                    >
                      <Zap className="text-accent h-3 w-3 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  <form action={checkoutActionFn} className="mt-4">
                    <input type="hidden" name="planSlug" value={plan.slug} />
                    <Button
                      type="submit"
                      size="sm"
                      className="w-full gap-1.5"
                      disabled={checkoutPending}
                    >
                      {checkoutPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {checkoutPending ? 'Loading…' : 'Upgrade'}
                    </Button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
