# Stripe Checkout & subscription upgrade — design spec

> **Repo note:** `docs/superpowers/` is gitignored in this project; the committed copy of this spec lives here under `docs/design/`.

**Date:** 2026-04-19  
**Status:** Approved for implementation planning  
**Scope:** Wire paid plans on `/upgrade`, recurring billing, cancel-at-period-end behavior, usage limits, sidebar plan label, and a **co-branded checkout experience** inspired by the provided two-column reference (Aladdin copy and logo, not Driply wording).

---

## 1. Goals

1. From `/upgrade`, **Upgrade to Co-Pilot** and **Take Full Command** start checkout for the correct **monthly subscription** Price.
2. After successful payment, the user’s **plan and usage limits** match **Copilot** or **Captain** per `TIER_LIMITS` in `src/lib/subscription/tier-config.ts`.
3. **Monthly renewals** continue until the user cancels; **cancellation** follows **Option A**: the user **keeps paid access through the end of the period they already paid for**; they are **not** charged again for the next cycle. Downgrade to **LITE** only when Stripe ends the subscription (e.g. `customer.subscription.deleted`).
4. Bottom-left account area: show **paid tier name** when subscribed; show **“Lite user”** (or equivalent approved copy) when not on a paid tier.
5. Checkout **presentation**: two-column, Aladdin-branded **order summary** (left) + **payment** (right), aligned with the shared mockup—**personalized** feature list and **logo** (`/aladdin-logo.png`).

---

## 2. Non-goals (this phase)

- Annual billing SKUs (can be added later with separate Price IDs and CTAs).
- Full custom PCI card form without Stripe (not required).
- Charging logic outside **Checkout Session** + **Billing** webhooks.

---

## 3. Architecture (unchanged core)

| Layer | Responsibility |
|--------|----------------|
| **Stripe** | Recurring **Prices** (monthly), **Checkout** (subscription mode), **Customer Portal**, **webhooks**. |
| **Next.js API** | `POST /api/stripe/create-checkout`, `POST /api/stripe/portal`, `POST /api/webhooks/stripe`. |
| **Prisma** | `Subscription` (plan, Stripe IDs, `cancelAtPeriodEnd`, `currentPeriodEnd`, `status`), `UserUsage`, `WebhookEvent` idempotency. |
| **Clerk** | Optional `publicMetadata.planType` synced from webhooks (already present). |
| **Client** | `useSubscription` → `GET /api/user/subscription` for limits and labels. |

**Source of truth for entitlements:** Prisma `Subscription.planType` (webhook-updated). Client reads via `/api/user/subscription`; server-side gates use `check-usage.ts`.

---

## 4. Checkout UX: hosted vs embedded

| Approach | Layout control | Fits mockup? |
|----------|----------------|--------------|
| **Stripe-hosted Checkout** (redirect to `checkout.stripe.com`) | Dashboard **branding** (logo, colors, business name) only; layout is Stripe’s. | **No** — cannot reproduce a custom two-column summary rail. |
| **Embedded Checkout** (`ui_mode: 'embedded'`) | Full-page **Next.js** shell: left column = Aladdin summary; right column = Stripe **Embedded Checkout** mount. | **Yes** — matches the reference structure. |

**Decision:** Use **Embedded Checkout** on a dedicated route (e.g. `/upgrade/checkout`) for the experience described in §1.5. Keep using **Checkout Sessions** in **subscription** mode ([Stripe Checkout](https://docs.stripe.com/payments/checkout.md)); only the **delivery** changes from redirect URL to **client_secret** + `@stripe/react-stripe-js` embedded component.

**Fallback:** If embedded integration is blocked (e.g. CSP, package constraints), fall back to **hosted Checkout** with strong **Dashboard branding** and document reduced layout parity—**not** equivalent to the mockup.

---

## 5. Flows

### 5.1 Upgrade (happy path)

1. User on `/upgrade` chooses Copilot or Captain → navigate to `/upgrade/checkout?plan=copilot` | `captain` (or POST then redirect with session id—implementation detail).
2. Client requests **create Checkout Session** with:
   - `mode: 'subscription'`
   - `ui_mode: 'embedded'`
   - `return_url` pointing back to app (e.g. `/upgrade?session_id={CHECKOUT_SESSION_ID}` per Stripe docs)
   - **Allowlisted** price for that plan (server maps `plan` → `STRIPE_PRICE_*`; **never** trust raw client-supplied Price IDs).
3. Page renders: **left** — logo, back link, plan title, monthly price, Aladdin-specific bullets (aligned with marketing copy on `/upgrade`, not copied from third-party screenshots), short renewal line; **right** — embedded Checkout.
4. On completion, Stripe fires **`checkout.session.completed`** → existing webhook sets `planType`, Stripe IDs, `status: active`.
5. User lands on `return_url`; client **refetches** subscription (or poll once) so limits and sidebar update.

### 5.2 Renewal

- **`invoice.paid`**: existing behavior—update `currentPeriodEnd`, **reset** `UserUsage` counters for the new period.

### 5.3 Cancel (Option A — approved)

- User opens **Customer Portal** from “Manage plan” (existing pattern).
- Stripe sets **cancel at period end**; **`customer.subscription.updated`** updates `cancelAtPeriodEnd` (and status fields as returned by Stripe) while **plan remains paid** until period end.
- **`customer.subscription.deleted`** at period end → set **LITE**, clear paid entitlement in DB, sync Clerk metadata to `LITE`.

### 5.4 Upgrade between paid tiers (Copilot → Captain)

- Prefer **Stripe Customer Portal** “switch plan” if configured with both prices; otherwise **new Checkout session** with `subscription` update flow or cancel + subscribe—**implementation plan** should pick one and document proration (default: Stripe proration behavior).

---

## 6. Security & configuration

1. **`create-checkout`**: Accept **`plan: 'copilot' | 'captain'`** (recommended) or validate `priceId` ∈ `{STRIPE_PRICE_COPILOT, STRIPE_PRICE_CAPTAIN}` only.
2. **Webhooks:** Verify signature; keep **idempotency** (`WebhookEvent`).
3. **Env (server):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_COPILOT`, `STRIPE_PRICE_CAPTAIN`, `NEXT_PUBLIC_APP_URL` (or origin derivation). **Publishable key** for embedded: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (if not already present).
4. **Webhook events** to enable in Stripe Dashboard / CLI: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`.

**Tax row in mockup:** Optional follow-up—enable **Stripe Tax** or **automatic_tax** on the Session when business is ready; left-column copy can state “Taxes calculated at payment” until then.

---

## 7. UI copy (sidebar)

- **`planType === 'LITE'`:** second line **“Lite user”** (replace generic “Lite plan” if present).
- **Paid:** display **“Co-Pilot”** / **“Captain”** (match existing `PLAN_LABELS` tone).

---

## 8. Aladdin checkout page (left column content)

Use **`/aladdin-logo.png`** at top of summary column.

**Copilot (example bullets — implementation may tune):**

- AI-tailored resumes (monthly quota)
- High-conversion cover letters (monthly quota)
- LinkedIn profile insights (monthly quota)
- Referral network access
- Apply Pilot auto-fill

**Captain (example bullets):**

- Higher resume + email retrieval quotas
- Unlimited AI cover letters and LinkedIn lead depth (per `TIER_LIMITS`)
- Priority job alerts
- Everything in Co-Pilot

**Footer line:** e.g. “Renews monthly until you cancel in account settings.”

**Back:** returns to `/upgrade` without completing checkout (discard session UX per Stripe guidance).

---

## 9. Testing

- Stripe CLI `stripe listen` + test Clock for cancel-at-period-end.
- Complete embedded checkout in test mode → DB + `GET /api/user/subscription` + one gated API route.
- Cancel via Portal → confirm **still paid** until simulated period end → then **LITE**.

---

## 10. Dependencies / packages

- **`@stripe/stripe-js`** and **`@stripe/react-stripe-js`** (or Stripe’s current embedded Checkout React pattern) for **Embedded Checkout**—exact imports to be confirmed against installed `stripe` SDK version during implementation.

---

## 11. Open items for implementation plan

1. Confirm `stripe` npm version and embedded Checkout API shape (`client_secret`, `Elements` / dedicated embedded component).
2. Portal configuration in Stripe Dashboard: ensure customers can **cancel** and **update payment method**.
3. Whether **Customer Portal** alone covers **Copilot ↔ Captain** switches; if not, specify Checkout **subscription_update** or explicit upgrade API.

---

## 12. References

- [Stripe Checkout](https://docs.stripe.com/payments/checkout.md) (subscription + embedded `ui_mode`)
- [Customer portal](https://docs.stripe.com/customer-management.md)
- [Go live checklist](https://docs.stripe.com/get-started/checklist/go-live.md)
