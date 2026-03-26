import type { Metadata } from 'next';
import { LegalPage, LegalSection, P, UL, LI, SubHeading, Placeholder, type TocSection } from '../LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service — Aladdin',
  description: 'The terms that govern your use of Aladdin.',
};

const TOC: TocSection[] = [
  { id: 'acceptance', label: 'Acceptance of Terms' },
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'account', label: 'Your Account' },
  { id: 'acceptable-use', label: 'Acceptable Use' },
  { id: 'ugc', label: 'User-Generated Content' },
  { id: 'ai-content', label: 'AI-Generated Content' },
  { id: 'third-party-links', label: 'Third-Party Links' },
  { id: 'ip', label: 'Intellectual Property' },
  { id: 'billing', label: 'Paid Plans & Billing' },
  { id: 'liability', label: 'Disclaimers & Liability' },
  { id: 'indemnification', label: 'Indemnification' },
  { id: 'termination', label: 'Termination' },
  { id: 'disputes', label: 'Dispute Resolution' },
  { id: 'governing-law', label: 'Governing Law' },
  { id: 'changes', label: 'Changes to Terms' },
  { id: 'contact', label: 'Contact Us' },
];

const SUMMARY = [
  'You need to be at least 13 years old to use Aladdin.',
  'Your uploaded resumes and files stay yours — we don\'t claim ownership.',
  'Interview experiences you post are visible to other registered users — keep them accurate and respectful.',
  'We can remove content that violates these terms.',
  'Aladdin is a job hunting tool, not a recruiter — we\'re not responsible for job outcomes.',
  'Paid plans are coming soon and will have their own billing terms when they launch.',
  'We can suspend accounts that abuse the platform.',
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="Last Updated: March 19, 2026"
      summaryItems={SUMMARY}
      tocSections={TOC}
    >

      <LegalSection id="acceptance" number="01" heading="Acceptance of Terms">
        <P>
          By accessing or using Aladdin (the "Service"), you agree to be bound by these Terms of Service ("Terms") and our Privacy Policy. If you do not agree to these Terms, please do not use the Service.
        </P>
        <P>
          These Terms constitute a legally binding agreement between you and <Placeholder>[YOUR LEGAL ENTITY NAME]</Placeholder> ("Aladdin," "we," "us," or "our"). We may update these Terms from time to time; continued use of the Service after changes are posted constitutes acceptance.
        </P>
      </LegalSection>

      <LegalSection id="eligibility" number="02" heading="Eligibility">
        <P>
          Aladdin is available to anyone who is at least 13 years of age. By using the Service, you represent that you meet this requirement. If you are under 18, you represent that you have your parent or legal guardian's permission to use the Service.
        </P>
      </LegalSection>

      <LegalSection id="account" number="03" heading="Your Account">
        <P>
          Account creation and authentication is handled by Clerk. You are responsible for:
        </P>
        <UL>
          <LI>Maintaining the confidentiality of your login credentials.</LI>
          <LI>All activity that occurs under your account.</LI>
          <LI>Notifying us immediately if you suspect unauthorized access to your account at <Placeholder>[legal@yourdomain.com]</Placeholder>.</LI>
        </UL>
        <P>
          We are not liable for any loss or damage arising from your failure to keep your credentials secure.
        </P>
      </LegalSection>

      <LegalSection id="acceptable-use" number="04" heading="Acceptable Use">
        <P>
          You agree to use Aladdin only for lawful purposes and in accordance with these Terms. You agree not to:
        </P>
        <UL>
          <LI>Scrape, crawl, or systematically extract job listings, user data, or any content from the platform by automated means without our express written permission.</LI>
          <LI>Post false, misleading, fabricated, or defamatory interview experiences or any other content.</LI>
          <LI>Harass, threaten, impersonate, or intimidate other users.</LI>
          <LI>Attempt to access another user's account, private data, or any part of the Service you are not authorized to access.</LI>
          <LI>Use the Service in any manner that violates applicable local, national, or international law.</LI>
          <LI>Upload malicious code, viruses, or any software designed to disrupt, damage, or interfere with the Service.</LI>
          <LI>Use the Service to send unsolicited communications (spam).</LI>
        </UL>
      </LegalSection>

      <LegalSection id="ugc" number="05" heading="User-Generated Content">
        <P>
          Aladdin allows you to post interview experiences (collectively, "User Content"). The following terms apply to all User Content:
        </P>

        <SubHeading>Ownership</SubHeading>
        <P>
          You retain ownership of content you create and post on Aladdin. We do not claim intellectual property rights over your User Content.
        </P>

        <SubHeading>License to Display</SubHeading>
        <P>
          By posting User Content, you grant Aladdin a non-exclusive, royalty-free, worldwide license to display, reproduce, and distribute your content to other users with active registered accounts on the platform. This license is limited to operating the Service and does not extend to commercial use, advertising, or distribution outside the platform.
        </P>

        <SubHeading>Accuracy & Responsibility</SubHeading>
        <P>
          You represent that your User Content reflects your genuine personal experience. You are solely responsible for the accuracy of any information you share, including salary figures, company process details, and offer information. Aladdin does not verify the accuracy of interview experience posts.
        </P>

        <SubHeading>Visibility</SubHeading>
        <P>
          Interview experience posts are visible to all users with active registered accounts on Aladdin. They are not accessible to the open web or to unauthenticated visitors.
        </P>

        <SubHeading>Moderation</SubHeading>
        <P>
          Aladdin reserves the right to review, moderate, edit, or remove any User Content at any time and without prior notice, for any reason including — but not limited to — content that violates these Terms, is flagged by other users, or is determined to be inaccurate, harmful, or inappropriate.
        </P>
      </LegalSection>

      <LegalSection id="ai-content" number="06" heading="AI-Generated Content">
        <P>
          Aladdin uses AI to provide features such as tailored resume generation and cover letter drafting. The following applies to all AI-generated outputs:
        </P>
        <UL>
          <LI>AI-generated content is produced by automated systems and may contain errors, inaccuracies, or content that does not reflect your actual experience or qualifications.</LI>
          <LI>You are solely responsible for reviewing all AI output before submitting it to employers, recruiters, or any third party.</LI>
          <LI>Aladdin makes no representations or warranties about the accuracy, completeness, or fitness for purpose of any AI-generated content.</LI>
          <LI>Submitting AI-generated content as your own work may be subject to third-party terms (e.g., employer application policies) that you are responsible for understanding.</LI>
        </UL>
      </LegalSection>

      <LegalSection id="third-party-links" number="07" heading="Third-Party Links">
        <P>
          The Service contains links to external job postings and third-party websites. These links are provided for your convenience only. Aladdin has no control over, and assumes no responsibility for, the content, privacy practices, accuracy, or availability of any third-party sites or resources. Accessing third-party sites is at your own risk.
        </P>
      </LegalSection>

      <LegalSection id="ip" number="08" heading="Intellectual Property">
        <P>
          The Aladdin name, logo, brand, user interface design, code, and all proprietary data and algorithms are the intellectual property of <Placeholder>[YOUR LEGAL ENTITY NAME]</Placeholder> and are protected by applicable intellectual property laws.
        </P>
        <P>
          Your uploaded files (resumes, LinkedIn profiles) and authored content (interview posts, notes) remain your property. Nothing in these Terms transfers ownership of your content to Aladdin beyond the limited license described in Section 05.
        </P>
      </LegalSection>

      <LegalSection id="billing" number="09" heading="Paid Plans & Billing">
        <P>
          Aladdin currently offers free access to its core features. Paid subscription plans are planned for a future release. When paid plans are introduced:
        </P>
        <UL>
          <LI>Billing terms, pricing, refund policies, and plan details will be published and incorporated into these Terms by reference.</LI>
          <LI>Payments will be processed by Stripe, Inc., subject to Stripe's terms of service.</LI>
          <LI>You will be notified in advance of any transition from free to paid access for features you currently use for free.</LI>
        </UL>
      </LegalSection>

      <LegalSection id="liability" number="10" heading="Disclaimers & Limitation of Liability">
        <SubHeading>As-Is Service</SubHeading>
        <P>
          Aladdin is provided "as is" and "as available" without warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement.
        </P>

        <SubHeading>No Guarantee of Outcomes</SubHeading>
        <P>
          Aladdin is a job search and application tool. We are not an employment agency, recruiter, or staffing firm. We make no representations or guarantees regarding job outcomes, interview results, employer decisions, hiring timelines, or the accuracy of third-party job listings.
        </P>

        <SubHeading>Liability Cap</SubHeading>
        <P>
          To the maximum extent permitted by applicable law, Aladdin's total liability to you for any claim arising from or related to your use of the Service shall not exceed the greater of: (a) the total fees you paid to Aladdin in the twelve (12) months preceding the claim, or (b) $50 USD. This limitation applies regardless of the theory of liability (contract, tort, strict liability, or otherwise).
        </P>
        <P>
          In no event shall Aladdin be liable for indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill.
        </P>
      </LegalSection>

      <LegalSection id="indemnification" number="11" heading="Indemnification">
        <P>
          You agree to indemnify, defend, and hold harmless Aladdin and its operators, officers, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or related to:
        </P>
        <UL>
          <LI>Your use of or access to the Service.</LI>
          <LI>Your User Content, including any claim that it is inaccurate, defamatory, or infringes a third party's rights.</LI>
          <LI>Your violation of these Terms or any applicable law.</LI>
        </UL>
      </LegalSection>

      <LegalSection id="termination" number="12" heading="Termination">
        <P>
          You may close your account at any time from your account settings. Upon account closure, your personal data is deleted in accordance with our Privacy Policy.
        </P>
        <P>
          Aladdin may suspend or terminate your access to the Service, with or without notice, for conduct that we determine in our sole discretion to be a material violation of these Terms, harmful to other users, or otherwise inappropriate.
        </P>
        <P>
          Sections 05 (User-Generated Content), 10 (Disclaimers & Liability), 11 (Indemnification), and 13 (Dispute Resolution) survive termination.
        </P>
      </LegalSection>

      <LegalSection id="disputes" number="13" heading="Dispute Resolution">
        <SubHeading>Informal Resolution First</SubHeading>
        <P>
          Before initiating any formal dispute, you agree to contact us at <Placeholder>[legal@yourdomain.com]</Placeholder> and give us 30 days to resolve the issue informally. Most concerns can be resolved this way.
        </P>

        <SubHeading>Binding Arbitration</SubHeading>
        <P>
          If informal resolution fails, any dispute, claim, or controversy arising from or relating to these Terms or your use of the Service shall be resolved by binding individual arbitration administered by <Placeholder>[AAA — American Arbitration Association]</Placeholder> under its applicable rules. The arbitration will take place in <Placeholder>[JURISDICTION]</Placeholder> or virtually. The arbitrator's decision is final and binding.
        </P>

        <SubHeading>No Class Actions</SubHeading>
        <P>
          You waive your right to participate in class action lawsuits or class-wide arbitration. All disputes must be brought on an individual basis only.
        </P>

        <SubHeading>Small Claims Carve-Out</SubHeading>
        <P>
          Either party may bring qualifying claims in small claims court instead of arbitration, provided the claim remains in that court.
        </P>
      </LegalSection>

      <LegalSection id="governing-law" number="14" heading="Governing Law">
        <P>
          These Terms are governed by and construed in accordance with the laws of <Placeholder>[STATE]</Placeholder>, without regard to its conflict of law principles. Subject to the arbitration clause above, you consent to the exclusive jurisdiction of the courts located in <Placeholder>[JURISDICTION]</Placeholder> for any disputes not subject to arbitration.
        </P>
      </LegalSection>

      <LegalSection id="changes" number="15" heading="Changes to Terms">
        <P>
          We may modify these Terms at any time. When we make material changes, we will update the "Last Updated" date at the top of this page and notify you via email or an in-app notice. Your continued use of the Service after changes take effect constitutes your acceptance of the updated Terms.
        </P>
        <P>
          If you do not agree to any revised Terms, you may close your account at any time.
        </P>
      </LegalSection>

      <LegalSection id="contact" number="16" heading="Contact Us">
        <P>
          For questions about these Terms or legal matters, contact us at:
        </P>
        <UL>
          <LI>Email: <Placeholder>[legal@yourdomain.com]</Placeholder></LI>
          <LI>Address: <Placeholder>[YOUR LEGAL ENTITY NAME, ADDRESS]</Placeholder></LI>
        </UL>
      </LegalSection>

    </LegalPage>
  );
}
