import type { Metadata } from 'next';
import { LegalPage, LegalSection, P, UL, LI, SubHeading, Placeholder, type TocSection } from '../LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy — Aladdin',
  description: 'How Aladdin collects, uses, and protects your personal data.',
};

const TOC: TocSection[] = [
  { id: 'who-we-are', label: 'Who We Are' },
  { id: 'data-collected', label: 'What Data We Collect' },
  { id: 'cookies', label: 'Cookies & Tracking' },
  { id: 'legal-basis', label: 'Why We Collect It' },
  { id: 'third-parties', label: 'Third-Party Services' },
  { id: 'retention', label: 'Data Retention' },
  { id: 'your-rights', label: 'Your Rights' },
  { id: 'security', label: 'Data Security' },
  { id: 'breach', label: 'Data Breach Notification' },
  { id: 'children', label: 'Children' },
  { id: 'changes', label: 'Changes to This Policy' },
  { id: 'contact', label: 'Contact Us' },
];

const SUMMARY = [
  'We collect your name, email, and profile photo when you sign in.',
  'Resumes and LinkedIn profiles you upload are yours — delete them anytime; deleting your account deletes your files.',
  'We use AI to help match you with jobs, which requires reading your resume content.',
  'We track job clicks and searches to improve your recommendations. You can disable personalization in account settings.',
  'We use Vercel Analytics — no cookies, no ad tracking.',
  'We never sell your data.',
  'You can request a copy or deletion of your data at any time.',
  'If there is ever a data breach affecting your account, we will notify you promptly.',
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="Last Updated: March 19, 2026"
      summaryItems={SUMMARY}
      tocSections={TOC}
    >

      <LegalSection id="who-we-are" number="01" heading="Who We Are">
        <P>
          Aladdin is an AI-powered job application workflow platform operated by{' '}
          <Placeholder>[YOUR LEGAL ENTITY NAME]</Placeholder>
          {', '}
          <Placeholder>[ADDRESS]</Placeholder>. We help job seekers discover opportunities, tailor their application materials, track their pipeline, and learn from community interview experiences.
        </P>
        <P>
          This Privacy Policy explains what personal data we collect, why we collect it, how we use and protect it, and what rights you have over your data. If you have questions, contact us at{' '}
          <Placeholder>[privacy@yourdomain.com]</Placeholder>.
        </P>
      </LegalSection>

      <LegalSection id="data-collected" number="02" heading="What Data We Collect">
        <SubHeading>Account Information</SubHeading>
        <P>
          When you sign up or sign in, your identity is managed by Clerk. We receive from Clerk: your name, email address, and profile photo. This data is necessary to create and maintain your account.
        </P>

        <SubHeading>Uploaded Files</SubHeading>
        <P>
          You may upload resumes (PDF) and LinkedIn profile exports (PDF) to Aladdin. These are stored in AWS S3. You can delete individual files at any time from your profile settings. Deleting your account permanently deletes all associated uploaded files.
        </P>

        <SubHeading>Application Tracking Data</SubHeading>
        <P>
          When you track job applications, we store the data you enter: job status, personal notes, and any external links you add. External links point to third-party sites we do not control.
        </P>

        <SubHeading>AI-Generated Documents</SubHeading>
        <P>
          When you generate a cover letter or tailored resume, the AI output is stored so you can access it later. This feature activates when cover letter generation is live; data collection details will be updated at that time.
        </P>

        <SubHeading>Behavioral Data</SubHeading>
        <P>
          We collect information about how you use the platform: which jobs you click, view, or save; your search queries; and interaction events. This data is used to improve job matching and recommendation quality. Lawful basis: legitimate interest. You can opt out by disabling personalization in your account settings.
        </P>
        <UL>
          <LI>Job clicks and views</LI>
          <LI>Search queries and search history</LI>
          <LI>Session identifiers (for linking interactions in a single visit)</LI>
          <LI>Result clicks from search results</LI>
        </UL>
        <P>Behavioral data is retained for <Placeholder>[X months — to be specified]</Placeholder> from the date of collection.</P>

        <SubHeading>Interview Experience Posts</SubHeading>
        <P>
          If you submit an interview experience, we store the content you provide: company name, role, location, work arrangement, offer status, salary range (if disclosed), process steps, and any additional comments. This content is visible to all users with active registered accounts. You are solely responsible for the accuracy of the information you share, including any salary or compensation figures. Posts are deleted when you delete your account or upon your request.
        </P>

        <SubHeading>AI Preference Embeddings</SubHeading>
        <P>
          Based on your usage patterns (jobs viewed, searches, interactions), we generate a behavioral embedding — a numerical representation of your job preferences — to improve personalized recommendations. Lawful basis: legitimate interest. You can opt out by navigating to Account Settings → Privacy → Disable Personalization. Upon opting out, your embedding will be deleted within 30 days. Your embedding is also deleted when you close your account.
        </P>
      </LegalSection>

      <LegalSection id="cookies" number="03" heading="Cookies & Tracking Technologies">
        <P>
          Aladdin does not use advertising cookies or cross-site tracking. Here is what is used:
        </P>
        <UL>
          <LI><strong>Clerk (authentication cookies):</strong> Clerk sets session cookies required to keep you signed in. These are strictly necessary for the service to function and cannot be opted out of while using the platform.</LI>
          <LI><strong>Vercel Analytics (cookieless):</strong> We use Vercel Analytics to understand how the app is used. Vercel Analytics is configured in cookieless mode — no tracking cookies are set. It collects aggregated, anonymized page view and performance data.</LI>
          <LI><strong>Mapbox (IP address):</strong> When you use the Jobs Map feature, Mapbox loads map tiles and receives your IP address and map interaction data in order to serve the map. Lawful basis: legitimate interest for providing map functionality.</LI>
        </UL>
      </LegalSection>

      <LegalSection id="legal-basis" number="04" heading="Why We Collect It & Legal Basis">
        <P>We process your personal data on the following legal bases:</P>
        <UL>
          <LI><strong>Contract performance:</strong> Account data, uploaded files, and application tracking are necessary to provide the core service you signed up for.</LI>
          <LI><strong>Legitimate interest:</strong> Behavioral data, search analytics, AI embeddings, and Mapbox IP data are processed to improve job matching, recommendation quality, and platform performance. You have the right to object to this processing (see Your Rights).</LI>
          <LI><strong>Your own choice:</strong> Interview experience posts and salary disclosures are published entirely at your discretion. You choose what to share.</LI>
        </UL>
      </LegalSection>

      <LegalSection id="third-parties" number="05" heading="Third-Party Services">
        <P>
          Aladdin uses the following third-party services. Each receives only the data necessary for its function.
        </P>
        <UL>
          <LI><strong>Clerk</strong> — Authentication and identity management. Manages your login, session, and account credentials.</LI>
          <LI><strong>AWS S3</strong> — File storage for uploaded resumes, LinkedIn profiles, and generated documents.</LI>
          <LI><strong>Supabase / PostgreSQL</strong> — Primary database for application data, search history, interview posts, and embeddings.</LI>
          <LI><strong>Vercel Analytics + Speed Insights</strong> — Cookieless usage analytics and performance monitoring.</LI>
          <LI><strong>Mapbox</strong> — Map tile rendering for the Jobs Map feature.</LI>
        </UL>
        <P>
          <strong>Planned future processors:</strong> Stripe (payment processing), Google Gemini / OpenRouter (AI generation). This policy will be updated when these services become active.
        </P>
        <P>
          Data processing with each provider is governed by their respective data processing terms. Links to each provider's terms are available on their websites.
        </P>
      </LegalSection>

      <LegalSection id="retention" number="06" heading="Data Retention">
        <UL>
          <LI><strong>Uploaded files (resumes, LinkedIn profiles):</strong> Retained until you delete them or close your account. Account deletion permanently removes all associated files from AWS S3.</LI>
          <LI><strong>Application tracking data and notes:</strong> Deleted on account closure.</LI>
          <LI><strong>Behavioral data (interactions, search history):</strong> Retained for <Placeholder>[X months — to be specified]</Placeholder> from collection date.</LI>
          <LI><strong>Search analytics:</strong> Retained for <Placeholder>[X months — to be specified]</Placeholder> from collection date.</LI>
          <LI><strong>Vercel Analytics data:</strong> Retained per Vercel's configuration — <Placeholder>[verify and state period]</Placeholder>.</LI>
          <LI><strong>AI preference embeddings:</strong> Deleted within 30 days of opting out, or immediately on account closure.</LI>
          <LI><strong>Interview experience posts:</strong> Deleted on account closure or upon your written request to <Placeholder>[privacy@yourdomain.com]</Placeholder>.</LI>
        </UL>
      </LegalSection>

      <LegalSection id="your-rights" number="07" heading="Your Rights">
        <SubHeading>All Users</SubHeading>
        <UL>
          <LI><strong>Access:</strong> Request a copy of the personal data we hold about you.</LI>
          <LI><strong>Correction:</strong> Request that inaccurate data be corrected.</LI>
          <LI><strong>Deletion:</strong> Request that your personal data be deleted (right to erasure).</LI>
          <LI><strong>Portability:</strong> Request your data in a machine-readable format.</LI>
        </UL>

        <SubHeading>California Residents (CCPA)</SubHeading>
        <UL>
          <LI>Right to know what personal information is collected, used, shared, or sold.</LI>
          <LI>Right to delete personal information we have collected.</LI>
          <LI>Right to opt out of the sale of personal information. We do not sell your data.</LI>
          <LI>Right to non-discrimination for exercising your CCPA rights.</LI>
        </UL>

        <SubHeading>EU / EEA Residents (GDPR)</SubHeading>
        <UL>
          <LI>Right to object to processing based on legitimate interest.</LI>
          <LI>Right to restrict processing.</LI>
          <LI>Right to withdraw consent (where consent is the legal basis).</LI>
          <LI>Right to lodge a complaint with your local supervisory authority.</LI>
        </UL>
        <P>
          To exercise any of these rights, contact us at <Placeholder>[privacy@yourdomain.com]</Placeholder>. We will respond within 30 days.
        </P>
      </LegalSection>

      <LegalSection id="security" number="08" heading="Data Security">
        <P>
          We implement appropriate technical and organizational safeguards to protect your personal data:
        </P>
        <UL>
          <LI>All data transmitted between your browser and our servers is encrypted in transit using TLS.</LI>
          <LI>Files stored in AWS S3 are encrypted at rest using server-side encryption.</LI>
          <LI>Authentication is managed by Clerk, which handles credential storage and session security.</LI>
          <LI>Database access is restricted to authorized services and personnel only.</LI>
        </UL>
        <P>
          No method of transmission or storage is 100% secure. While we use best practices, we cannot guarantee absolute security. If you discover a security vulnerability, please report it to <Placeholder>[privacy@yourdomain.com]</Placeholder>.
        </P>
      </LegalSection>

      <LegalSection id="breach" number="09" heading="Data Breach Notification">
        <P>
          In the event of a security incident that affects your personal data, we will notify affected users without undue delay and no later than 72 hours after becoming aware of the breach, in accordance with GDPR Article 33. Where legally required, we will also notify the relevant supervisory authority.
        </P>
        <P>
          Notification will be sent to the email address associated with your account. We will describe the nature of the breach, the data involved, and the steps we are taking to address it.
        </P>
      </LegalSection>

      <LegalSection id="children" number="10" heading="Children">
        <P>
          Aladdin is intended for users who are 13 years of age or older. We do not knowingly collect personal data from children under 13. If you believe we have inadvertently collected data from a child under 13, please contact us at <Placeholder>[privacy@yourdomain.com]</Placeholder> and we will delete it promptly.
        </P>
      </LegalSection>

      <LegalSection id="changes" number="11" heading="Changes to This Policy">
        <P>
          We may update this Privacy Policy from time to time. When we do, we will update the "Last Updated" date at the top of this page. Material changes will be communicated via email or a notice within the app. Continued use of Aladdin after changes are posted constitutes acceptance of the updated policy.
        </P>
      </LegalSection>

      <LegalSection id="contact" number="12" heading="Contact Us">
        <P>
          For privacy-related questions, data requests, or concerns, contact us at:
        </P>
        <UL>
          <LI>Email: <Placeholder>[privacy@yourdomain.com]</Placeholder></LI>
          <LI>Address: <Placeholder>[YOUR LEGAL ENTITY NAME, ADDRESS]</Placeholder></LI>
        </UL>
        <P>
          We aim to respond to all inquiries within 30 days.
        </P>
      </LegalSection>

    </LegalPage>
  );
}
