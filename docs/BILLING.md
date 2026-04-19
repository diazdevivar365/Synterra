# Billing

Pricing, metering, and payments are specified in [`PLAN.md §F`](../PLAN.md). The five-plan
structure (Explorer, Pro, Team, Business, Enterprise) is billed through **Stripe** for
subscriptions + card capture, while **Lago** (self-hosted) owns usage metering — research-run
counts, node-hours, and data-volume ingest — emitting invoice-ready events back to Stripe at
period close. The `@synterra/billing` package will host the plan matrix and Stripe/Lago adapters
once W3 lands.
