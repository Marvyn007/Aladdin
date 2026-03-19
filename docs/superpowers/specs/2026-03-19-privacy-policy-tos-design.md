# Privacy Policy & Terms of Service — Design Spec

**Date:** 2026-03-19
**Product:** Aladdin (job hunting platform)
**Status:** Approved

---

## Overview

Two static Next.js pages providing legal coverage for Aladdin. Each document uses a layered approach: a plain-English summary up top for users, followed by full legal text below.

---

## Product Context

- **Name:** Aladdin
- **Type:** AI-powered job hunting platform
- **Users:** Job seekers, primarily US-based, open worldwide
- **Pricing:** Freemium or fully premium (Stripe integration planned, not yet live)
- **Age requirement:** 13+

### Data Collected
- Account info (name, email, profile photo) via Clerk
- Uploaded resumes (PDF) stored in AWS S3
- Uploaded LinkedIn profiles (PDF) stored in AWS S3
- Application tracking data (statuses, notes, external links)
- AI-generated cover letters stored in AWS S3 and database
- Search queries and search history
- User interaction events (job clicks, views)
- Search analytics (queries, session IDs, result clicks)
- Interview experience posts (company, role, salary range, process details) — visible to all registered users
- AI-inferred preference embeddings (behavioral profile derived from usage)

### Third-Party Services (currently active)
- **Clerk** — authentication and identity
- **AWS S3** — file storage
- **Supabase / PostgreSQL** — database
- **Vercel Analytics + Speed Insights** — usage and performance analytics
- **Mapbox / Leaflet** — jobs map

### Third-Party Services (planned)
- **Stripe** — payment processing (freemium/premium billing)
- **Google Gemini / OpenRouter** — AI features (not yet active)

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
- We store resumes and LinkedIn profiles you upload — you can delete them anytime
- We use AI to match you with jobs and tailor your resume — this requires reading your resume content
- We track which jobs you click and search for to improve your recommendations
- We use Vercel Analytics to understand how the app is used (no ad tracking)
- We never sell your data
- You can request a copy or deletion of your data at any time

### Full Legal Sections
1. **Who We Are** — Aladdin, operated by [operator name/entity], contact info
2. **What Data We Collect**
   - Account data (from Clerk: name, email, profile image)
   - Uploaded files (resumes, LinkedIn profiles stored in AWS S3)
   - Application tracking data (job statuses, notes, links)
   - AI-generated documents (cover letters, tailored resumes)
   - Behavioral data (job interactions, search history, clicks)
   - Search analytics (query text, session ID, result clicks)
   - Interview experience posts (user-authored, visible to registered users)
   - AI preference embeddings (derived behavioral profile)
3. **Why We Collect It & Legal Basis**
   - Contract performance: to provide core app features
   - Legitimate interest: to improve job matching and recommendations
   - GDPR legal bases stated for each data category
4. **Third-Party Services** — Clerk, AWS S3, Supabase, Vercel Analytics, Mapbox; note Stripe/AI services coming
5. **Data Retention** — files kept until deleted by user; analytics retained for [X] months; account data deleted on account closure
6. **Your Rights**
   - Access, correction, deletion, portability (GDPR + CCPA)
   - California residents: right to know, right to delete, right to opt-out of sale (we don't sell data)
   - How to submit a request (email/contact form)
7. **Data Security** — encryption in transit and at rest, AWS S3 security, Clerk-managed auth
8. **Children** — service is intended for users 13 and older; we do not knowingly collect data from under-13s
9. **Changes to This Policy** — notice via updated date; continued use = acceptance
10. **Contact Us** — email address for privacy requests

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
1. **Acceptance of Terms** — by using Aladdin you agree to these terms
2. **Eligibility** — you must be at least 13 years old to use this service
3. **Your Account** — managed via Clerk; you're responsible for keeping your credentials secure
4. **Acceptable Use**
   - No automated scraping of job listings or user data
   - No posting false or misleading interview experiences
   - No harassment of other users
   - No attempts to circumvent auth or access other users' data
5. **User-Generated Content** (interview experiences)
   - You own content you post
   - You grant Aladdin a non-exclusive license to display it to other registered users
   - You represent that your posts are accurate to your experience
   - We reserve the right to moderate, edit, or remove content that violates these terms
   - Content is visible to all registered users (not the open web)
6. **AI-Generated Content**
   - Cover letters and tailored resumes are AI-assisted
   - Review all AI output before submitting to employers
   - Aladdin makes no guarantees about AI output accuracy or fitness for purpose
7. **Intellectual Property** — Aladdin's brand, UI, and code are our IP; your uploaded files and posts remain yours
8. **Paid Plans & Billing** — placeholder: subscription plans and billing terms will be published when paid features launch; Stripe will process payments
9. **Disclaimers & Limitation of Liability** — platform provided as-is; not liable for job outcomes, missed opportunities, or AI output errors; liability capped at fees paid in last 12 months
10. **Termination** — we may suspend or terminate accounts for ToS violations; you may close your account at any time
11. **Governing Law** — laws of [state/jurisdiction]; disputes resolved in [jurisdiction]
12. **Changes to Terms** — updated date shown; continued use = acceptance
13. **Contact Us** — email address for legal/ToS questions

---

## Open Items (to fill before publishing)
- [ ] Legal entity name and address for "Who We Are" section
- [ ] Contact/privacy email address
- [ ] Governing law jurisdiction (state)
- [ ] Data retention periods (analytics, embeddings)
- [ ] Stripe billing terms section content (when payments go live)
