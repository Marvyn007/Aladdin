# Privacy Policy & Terms of Service — Design Spec

**Date:** 2026-03-19
**Product:** Aladdin (job hunting platform)
**Status:** Draft (open items must be resolved before publishing)

---

## Overview

Two static Next.js pages providing legal coverage for Aladdin. Each document uses a layered approach: a plain-English summary up top for users, followed by full legal text below.

---

## Product Context

- **Name:** Aladdin
- **Type:** AI-powered job hunting platform (AI matching/tailoring features are currently active for job matching; cover letter generation is planned)
- **Users:** Job seekers, primarily US-based, open worldwide
- **Pricing:** Freemium or fully premium (Stripe integration planned, not yet live)
- **Age requirement:** 13+

### Data Collected
- Account info (name, email, profile photo) via Clerk
- Uploaded resumes (PDF) stored in AWS S3
- Uploaded LinkedIn profiles (PDF) stored in AWS S3
- Application tracking data (statuses, notes, external job links)
- AI-generated cover letters stored in AWS S3 and database (planned)
- Search queries and search history
- User interaction events (job clicks, views)
- Search analytics (queries, session IDs, result clicks)
- Interview experience posts (company, role, salary range, process details) — visible to all users with active registered accounts
- AI-inferred preference embeddings (behavioral profile derived from usage) — lawful basis: legitimate interest; users can opt out via a "Disable Personalization" toggle in account settings (must be implemented); opting out stops new embedding updates and queues existing embedding for deletion within 30 days

### Third-Party Services (currently active)
- **Clerk** — authentication and identity
- **AWS S3** — file storage (resumes, LinkedIn profiles, cover letters)
- **Supabase / PostgreSQL** — database
- **Vercel Analytics + Speed Insights** — usage and performance analytics (cookieless; collects aggregated page view and performance data; no ad targeting)
- **Mapbox / Leaflet** — jobs map (Mapbox receives IP address and map interaction data when map tiles load; lawful basis: legitimate interest for providing map functionality; constitutes a data transfer to Mapbox Inc.)

### Third-Party Services (planned)
- **Stripe** — payment processing
- **Google Gemini / OpenRouter** — AI features (cover letter generation, enhanced resume tailoring)

### Cookies & Tracking
Aladdin does not use advertising cookies. Vercel Analytics is configured in cookieless mode. Session management is handled by Clerk (which may set authentication cookies). The Privacy Policy must explicitly disclose: what cookies/storage are set, by whom, and for what purpose.

---

## Page Structure

### Routes
- `/privacy` — Privacy Policy (publicly accessible, no auth required)
- `/terms` — Terms of Service (publicly accessible, no auth required)

### Layout (both pages)
1. **Last Updated** date stamp
2. **Plain English Summary** — short bullet list, conversational tone
3. **Table of Contents** with anchor links
4. **Full Legal Text** — numbered sections

### Implementation
- Static Next.js pages (no database, no dynamic content)
- Styled with existing Tailwind CSS classes
- No new shared components required
- Publicly accessible regardless of auth state

---

## Privacy Policy

### Plain English Summary (bullets)
- We collect your name, email, and profile photo when you sign in
- We store resumes and LinkedIn profiles you upload — you can delete them anytime; deleting your account also deletes your uploaded files
- We use AI to help match you with jobs — this requires reading your resume content
- We track which jobs you click and search for to improve your recommendations; you can stop this by deleting your account
- We use Vercel Analytics to understand how the app is used — no cookies, no ad tracking
- We never sell your data
- You can request a copy or deletion of your data at any time
- If there is ever a data breach affecting your account, we will notify you promptly

### Full Legal Sections
1. **Who We Are** — Aladdin, operated by [legal entity name and address], contact email: [privacy@domain.com]
2. **What Data We Collect**
   - Account data (from Clerk: name, email, profile image)
   - Uploaded files (resumes, LinkedIn profiles stored in AWS S3; deleted when you delete the file or your account)
   - Application tracking data (job statuses, notes, external links — links point to third-party sites we do not control)
   - AI-generated documents (cover letters, tailored resumes — not yet live; section will activate when feature ships)
   - Behavioral data (job interactions, search history, clicks) — lawful basis: legitimate interest; retained for [X months — specify separately from Vercel]
   - Search analytics (query text, session ID, result clicks) — lawful basis: legitimate interest; retained for [X months — specify separately from Vercel]
   - Interview experience posts (company, role, salary range, process details) — user-authored; visible to all active registered users; salary data is included in posts at the user's own choice; deleted on account closure or upon request
   - AI preference embeddings (derived behavioral profile) — lawful basis: legitimate interest; users can opt out via account settings "Disable Personalization" toggle; deleted within 30 days of opt-out or account closure
3. **Cookies & Tracking Technologies**
   - Clerk sets authentication cookies required to keep you signed in
   - Vercel Analytics operates in cookieless mode; no tracking cookies are set by Aladdin
   - Mapbox loads map tiles and receives your IP address and map interaction data
   - No advertising cookies or cross-site tracking are used
4. **Why We Collect It & Legal Basis**
   - Contract performance: to provide core app features (account, file storage, application tracking)
   - Legitimate interest: to improve job matching, search relevance, and platform quality
   - GDPR legal bases stated for each data category in Section 2
5. **Third-Party Services**
   - Clerk (identity), AWS S3 (storage), Supabase (database), Vercel (analytics), Mapbox (maps)
   - Each receives only the data necessary for their function
   - **Launch gate:** Do not publish until DPAs are confirmed signed with each processor. Until confirmed, do not state DPAs are in place — state instead that data processing is governed by each provider's standard data processing terms (link to each).
   - Planned future processors: Stripe (billing), Google Gemini / OpenRouter (AI)
6. **Data Retention**
   - Uploaded files: retained until you delete them or close your account; account deletion cascades to file deletion
   - Application tracking and notes: deleted on account closure
   - Behavioral data (interactions, search history collected by Aladdin directly): retained for [X months — must specify, independent of Vercel]
   - Search analytics (collected by Aladdin directly): retained for [X months — must specify, independent of Vercel]
   - Vercel Analytics data: retained per Vercel's configuration — verify and state the actual period
   - AI embeddings: deleted on account closure
   - Interview posts: deleted on account closure or upon user request
7. **Your Rights**
   - **All users:** access, correction, deletion, data portability
   - **California residents (CCPA):** right to know what data is collected, right to delete, right to opt out of sale (we do not sell data)
   - **EU/EEA residents (GDPR):** right to object to legitimate interest processing, right to restrict processing, right to lodge a complaint with your supervisory authority
   - To exercise any right, contact: [privacy@domain.com]
8. **Data Security** — encryption in transit (TLS) and at rest; AWS S3 server-side encryption; Clerk-managed auth; access controls on database
9. **Data Breach Notification** — In the event of a security incident affecting your personal data, we will notify affected users without undue delay and no later than 72 hours after becoming aware, as required by GDPR. We will also notify relevant supervisory authorities as required by law.
10. **Children** — Aladdin is intended for users who are 13 years of age or older. We do not knowingly collect personal data from children under 13. If you believe we have inadvertently collected such data, please contact us and we will delete it.
11. **Changes to This Policy** — We will update the "Last Updated" date when changes are made. Continued use after changes constitutes acceptance.
12. **Contact Us** — [privacy@domain.com] | [legal entity address]

---

## Terms of Service

### Plain English Summary (bullets)
- You need to be at least 13 years old to use Aladdin
- Your uploaded resumes and files stay yours — we don't claim ownership
- Interview experiences you post are visible to other registered users — keep them accurate and respectful
- We can remove content that violates these terms
- Aladdin is a job hunting tool, not a recruiter — we're not responsible for job outcomes
- Paid plans are coming soon and will have their own billing terms
- We can suspend accounts that abuse the platform

### Full Legal Sections
1. **Acceptance of Terms** — By accessing or using Aladdin, you agree to these terms. If you do not agree, do not use the service.
2. **Eligibility** — You must be at least 13 years old to use Aladdin. By using the service, you represent that you meet this requirement.
3. **Your Account** — Accounts are managed via Clerk. You are responsible for maintaining the security of your credentials and for all activity that occurs under your account.
4. **Acceptable Use** — You agree not to:
   - Scrape, crawl, or systematically extract job listings or user data
   - Post false, misleading, or fabricated interview experiences
   - Harass, threaten, or impersonate other users
   - Attempt to access other users' accounts or data
   - Use the service in violation of any applicable law
5. **User-Generated Content** (interview experiences)
   - You retain ownership of content you post
   - By posting, you grant Aladdin a non-exclusive, royalty-free license to display your content to other active registered users of the platform
   - You represent that your posts reflect your genuine personal experience
   - You are solely responsible for the accuracy of salary and compensation information you disclose
   - Aladdin reserves the right to moderate, edit, or remove content that violates these terms, without prior notice
   - Content is visible only to users with active registered accounts, not to the open web
6. **AI-Generated Content**
   - Cover letters, tailored resumes, and other AI-assisted outputs are generated by automated systems
   - You are responsible for reviewing all AI output before submitting it to employers or third parties
   - Aladdin makes no representations about the accuracy, completeness, or fitness for purpose of AI-generated content
7. **Third-Party Links** — The platform may contain links to external job postings and third-party websites. Aladdin is not responsible for the content, privacy practices, or availability of those sites.
8. **Intellectual Property** — Aladdin's brand, interface, code, and proprietary data are our intellectual property. Your uploaded files and authored content remain yours.
9. **Paid Plans & Billing** — Aladdin will offer paid subscription plans in the future. When paid plans launch, billing terms, refund policies, and plan details will be published and incorporated by reference into these terms. Payments will be processed by Stripe.
10. **Disclaimers & Limitation of Liability**
    - Aladdin is provided "as is" without warranties of any kind
    - We are not liable for job outcomes, missed opportunities, employer decisions, or errors in AI-generated content
    - Our total liability to you for any claim arising from use of the service shall not exceed the greater of: (a) the total fees you paid to Aladdin in the 12 months preceding the claim, or (b) $50 USD
11. **Indemnification** — You agree to indemnify and hold harmless Aladdin and its operators from any claims, damages, or expenses (including reasonable legal fees) arising from: your use of the service, your user-generated content, or your violation of these terms.
12. **Termination** — Aladdin may suspend or terminate your account for material violations of these terms. You may close your account at any time. Upon termination, your data is deleted per the Privacy Policy.
13. **Dispute Resolution** — Any dispute arising from these terms or your use of Aladdin shall first be subject to informal negotiation. If unresolved within 30 days, disputes shall be resolved by binding arbitration under [arbitration body, e.g., AAA] rules, on an individual basis. You waive the right to participate in class action lawsuits. Small claims court remains available for qualifying claims.
14. **Governing Law** — These terms are governed by the laws of [state], without regard to conflict of law principles.
15. **Changes to Terms** — We will update the "Last Updated" date when changes are made. Continued use after changes constitutes acceptance.
16. **Contact Us** — [legal@domain.com] | [legal entity address]

---

## Open Items (must resolve before publishing)
- [ ] Legal entity name and address
- [ ] Privacy contact email (privacy@domain.com)
- [ ] Legal/ToS contact email (legal@domain.com)
- [ ] Governing law jurisdiction (state)
- [ ] Data retention periods for analytics and embeddings (verify Vercel's actual retention config)
- [ ] Arbitration body name (e.g., AAA — American Arbitration Association)
- [ ] Stripe billing terms section content (when payments go live)
- [ ] Confirm DPAs are in place with Clerk, AWS, Supabase, and Vercel
- [ ] COPPA posture: confirm no known under-13 users; add mechanism to handle reports of under-13 accounts
- [ ] **GDPR Article 8 decision (launch blocker):** Choose one of:
  - Option A: Raise minimum age to 16 globally (simplest GDPR compliance; lose 13–15 user segment)
  - Option B: Add jurisdiction-based age gate — 16+ for EU users, 13+ for all others (requires geo-detection and separate consent flow)
  - Option C: Accept GDPR Article 8 risk for 13–15 EU users; document that platform does not actively target EU minors and relies on user self-representation (pragmatic for early-stage; revisit before EU expansion)
  This decision directly determines whether the eligibility section in the ToS and the children section in the Privacy Policy are legally valid for EU users.
