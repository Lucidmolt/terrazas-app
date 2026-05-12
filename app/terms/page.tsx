'use client';

import { useState } from 'react';

export default function TermsOfServicePage() {
  const [activeTab, setActiveTab] = useState<'customer' | 'provider'>('customer');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 50%, #f0fdf4 100%)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* Header */}
      <header style={{
        padding: '24px 32px',
        borderBottom: '1px solid #e2e8f0',
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-1px', color: '#166534', margin: 0 }}>TERRAZAS</h1>
          </a>
          <span style={{ fontSize: 14, color: '#64748b' }}>Terms of Service</span>
        </div>
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* Title */}
        <h2 style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Terms of Service</h2>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 32 }}>
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32, background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
          {(['customer', 'provider'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === tab ? '#166534' : 'transparent',
                color: activeTab === tab ? 'white' : '#64748b',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {tab === 'customer' ? '👤 Customer Terms' : '🏢 Service Provider Terms'}
            </button>
          ))}
        </div>

        {/* Terms Content */}
        <div style={{
          background: 'white',
          borderRadius: 16,
          padding: '32px 28px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          lineHeight: 1.7,
          color: '#334155',
          fontSize: 14,
        }}>
          {/* Shared intro */}
          <Section title="1. Agreement to Terms">
            <p>
              By accessing or using the Terrazas.app platform (&quot;Platform&quot;), operated by Terrazas (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), 
              you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the Platform.
            </p>
            <p>
              These Terms constitute a legally binding agreement between you and Terrazas. By creating an account, 
              posting a job, claiming a job, or otherwise using any feature of the Platform, you acknowledge that you 
              have read, understood, and agree to be bound by these Terms.
            </p>
          </Section>

          <Section title="2. Platform Description">
            <p>
              <strong>Terrazas.app is a technology platform that connects customers seeking lawn care and property 
              maintenance services with independent service providers.</strong>
            </p>
            <p>
              Terrazas acts solely as an intermediary marketplace — a &quot;middleman&quot; — that facilitates the discovery, 
              communication, and payment processing between customers and independent service providers. 
              <strong> Terrazas does not itself provide lawn care, landscaping, or any property maintenance services.</strong>
            </p>
            <p>
              All services are performed by independent third-party service providers (&quot;Providers&quot;) who are not 
              employees, agents, or contractors of Terrazas. The Platform simply provides the technology to connect 
              parties and process payments.
            </p>
          </Section>

          <Section title="3. Limitation of Liability">
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <p style={{ fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>⚠️ IMPORTANT — PLEASE READ CAREFULLY</p>
              <p>
                <strong>TERRAZAS SHALL NOT BE HELD LIABLE FOR ANY DAMAGES, INJURIES, LOSSES, CLAIMS, OR EXPENSES 
                ARISING FROM OR RELATED TO:</strong>
              </p>
              <ul style={{ paddingLeft: 20 }}>
                <li>The quality, safety, or legality of any services provided by Providers</li>
                <li>Any property damage caused during the performance of services</li>
                <li>Any personal injury to customers, providers, or third parties</li>
                <li>Any disputes between customers and providers</li>
                <li>The accuracy of any provider profile information, ratings, or reviews</li>
                <li>Any theft, trespassing, or criminal activity by any user of the Platform</li>
                <li>Any environmental damage resulting from services performed</li>
                <li>Any failure by a provider to complete a job or meet quality expectations</li>
              </ul>
            </div>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, TERRAZAS&apos;S TOTAL LIABILITY TO YOU FOR ANY AND ALL CLAIMS 
              ARISING FROM OR RELATED TO YOUR USE OF THE PLATFORM SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU TO 
              TERRAZAS IN THE SIX (6) MONTHS PRECEDING THE CLAIM.
            </p>
            <p>
              YOU ACKNOWLEDGE AND AGREE THAT TERRAZAS IS NOT RESPONSIBLE FOR THE ACTIONS, OMISSIONS, OR CONDUCT 
              OF ANY USER OF THE PLATFORM, WHETHER ONLINE OR OFFLINE.
            </p>
          </Section>

          {activeTab === 'customer' ? <CustomerTerms /> : <ProviderTerms />}

          <Section title={activeTab === 'customer' ? '8. Fees & Payments' : '9. Fees & Commissions'}>
            {activeTab === 'customer' ? (
              <>
                <p>By using the Platform, you agree to the following fee structure:</p>
                <ul style={{ paddingLeft: 20 }}>
                  <li><strong>Service Fee:</strong> A 13% platform service fee is added to the job price</li>
                  <li><strong>Processing Fee:</strong> A $2.50 payment processing fee per transaction</li>
                  <li><strong>Dynamic Pricing:</strong> Job prices may vary based on yard scope, condition, lot size, 
                    demand, and urgency. All pricing factors are displayed transparently before you confirm a job.</li>
                  <li><strong>Tips:</strong> Tips are optional and 100% of tips go directly to the service provider</li>
                </ul>
                <p>All prices are displayed in US Dollars. You authorize Terrazas to charge your payment method for the 
                  total amount shown at checkout.</p>
              </>
            ) : (
              <>
                <p>By using the Platform as a Provider, you agree to the following commission structure:</p>
                <ul style={{ paddingLeft: 20 }}>
                  <li><strong>Platform Commission:</strong> Terrazas retains 10% of the job price as a platform commission</li>
                  <li><strong>Tips:</strong> You receive 100% of all customer tips with no deductions</li>
                  <li><strong>Payouts:</strong> Earnings are paid out via Stripe Connect to your linked bank account</li>
                  <li><strong>Payout Schedule:</strong> Standard payout schedule is weekly, with same-day payouts 
                    available for a fee</li>
                </ul>
              </>
            )}
          </Section>

          <Section title={activeTab === 'customer' ? '9. Dispute Resolution' : '10. Dispute Resolution'}>
            <p>
              Any disputes between customers and providers should first be attempted to be resolved directly between 
              the parties. Terrazas may, at its sole discretion, assist in mediating disputes but is under no 
              obligation to do so.
            </p>
            <p>
              Any disputes arising from these Terms or your use of the Platform shall be resolved through binding 
              arbitration in accordance with the rules of the American Arbitration Association, conducted in 
              Liberal, Kansas. You waive any right to participate in a class action lawsuit or class-wide arbitration.
            </p>
          </Section>

          <Section title={activeTab === 'customer' ? '10. Privacy & Data' : '11. Privacy & Data'}>
            <p>
              Your use of the Platform is also governed by our Privacy Policy. By using the Platform, you consent to 
              the collection, use, and sharing of your information as described in the Privacy Policy.
            </p>
            <p>Key data practices:</p>
            <ul style={{ paddingLeft: 20 }}>
              <li>We collect and store your name, email, phone number, and address for account functionality</li>
              <li>Job addresses and photos are shared with providers who claim your job</li>
              <li>Payment information is processed and stored securely by Stripe — Terrazas never stores your 
                full card number</li>
              <li>We use Google Maps APIs for address verification and distance calculations</li>
              <li>AI-powered yard assessment may analyze photos you submit</li>
            </ul>
          </Section>

          <Section title={activeTab === 'customer' ? '11. Modification & Termination' : '12. Modification & Termination'}>
            <p>
              Terrazas reserves the right to modify these Terms at any time. We will notify you of material changes 
              via email or in-app notification. Your continued use of the Platform after such changes constitutes 
              acceptance of the modified Terms.
            </p>
            <p>
              Terrazas may suspend or terminate your account at any time, for any reason, with or without notice. 
              You may delete your account at any time by contacting support.
            </p>
          </Section>

          <Section title={activeTab === 'customer' ? '12. Governing Law' : '13. Governing Law'}>
            <p>
              These Terms are governed by and construed in accordance with the laws of the State of Kansas, 
              without regard to its conflict of law provisions. Any legal action or proceeding shall be brought 
              exclusively in the courts located in Seward County, Kansas.
            </p>
          </Section>

          <Section title={activeTab === 'customer' ? '13. Contact' : '14. Contact'}>
            <p>For questions about these Terms, contact us at:</p>
            <p>
              <strong>Terrazas</strong><br />
              Liberal, KS 67901<br />
              Email: support@terrazas.app
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}

// ── Customer-specific sections ─────────────────────────────────────
function CustomerTerms() {
  return (
    <>
      <Section title="4. Customer Responsibilities">
        <p>As a customer using the Platform, you agree to:</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>Provide accurate address and property information</li>
          <li>Submit truthful photos of your yard for AI-powered condition assessment and pricing</li>
          <li>Ensure safe access to your property for the service provider</li>
          <li>Disclose any known hazards on your property (animals, chemicals, uneven terrain, etc.)</li>
          <li>Be available or provide clear access instructions for the service provider</li>
          <li>Pay the agreed-upon price, including all fees, promptly and in full</li>
          <li>Treat service providers with respect and professionalism</li>
        </ul>
      </Section>

      <Section title="5. Job Posting & Pricing">
        <p>
          When you post a job, the price is calculated dynamically based on multiple factors including yard scope, 
          condition (assessed via AI from your submitted photos), lot size, current demand, and urgency. You will 
          see a full breakdown of all pricing factors before confirming your job.
        </p>
        <p>
          <strong>You understand that submitting inaccurate photos or information may result in pricing that does 
          not reflect the actual work required.</strong> If a provider arrives and the job significantly differs from 
          what was described, the provider may cancel the job or request a price adjustment.
        </p>
      </Section>

      <Section title="6. Provider Claims & Veto Rights">
        <p>
          When a service provider claims your job, you will receive their profile information including their 
          business name, rating, and portfolio. You have a <strong>10-minute window</strong> to review and either 
          approve or veto the provider.
        </p>
        <ul style={{ paddingLeft: 20 }}>
          <li>If you approve, the provider is confirmed and will proceed to your property</li>
          <li>If you veto, the job is rebroadcasted to other available providers (the vetoed provider will not 
            be able to re-claim your job)</li>
          <li>If you take no action within 10 minutes, the provider is <strong>automatically approved</strong></li>
          <li>You may veto up to 3 providers per job. After 3 vetos, the job will require manual matching 
            assistance from our team</li>
        </ul>
      </Section>

      <Section title="7. Assumption of Risk">
        <p>
          You acknowledge that by allowing a third-party service provider access to your property, you assume 
          certain risks. These include but are not limited to:
        </p>
        <ul style={{ paddingLeft: 20 }}>
          <li>Potential property damage during service performance</li>
          <li>Variations in service quality between different providers</li>
          <li>Interactions with individuals you may not have previously met</li>
        </ul>
        <p>
          Terrazas encourages you to review provider profiles, ratings, and reviews before approving a claim. 
          However, <strong>Terrazas does not guarantee the quality, safety, or reliability of any service provider 
          on the Platform</strong>.
        </p>
      </Section>
    </>
  );
}

// ── Provider-specific sections ─────────────────────────────────────
function ProviderTerms() {
  return (
    <>
      <Section title="4. Provider Status — Independent Contractor">
        <p>
          <strong>You are an independent contractor, not an employee of Terrazas.</strong> Nothing in these Terms 
          creates an employment, partnership, joint venture, or agency relationship between you and Terrazas.
        </p>
        <p>As an independent contractor, you are solely responsible for:</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>Your own taxes, insurance, and business licenses</li>
          <li>Your own equipment, fuel, and supplies</li>
          <li>Compliance with all local, state, and federal laws and regulations</li>
          <li>Your own workers&apos; compensation and liability insurance</li>
          <li>The quality and safety of the services you provide</li>
        </ul>
      </Section>

      <Section title="5. Provider Profile Requirements">
        <p>To operate on the Platform, you must:</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>Maintain an accurate and up-to-date business profile</li>
          <li>Provide a valid business name and logo</li>
          <li>Upload at least 3 portfolio photos of your past work</li>
          <li>Provide truthful information about your services, experience, and coverage area</li>
          <li>Maintain appropriate insurance coverage (general liability recommended)</li>
          <li>Respond to jobs promptly and professionally</li>
        </ul>
        <p>
          <strong>Falsifying profile information, reviews, or qualifications is grounds for immediate account 
          termination.</strong>
        </p>
      </Section>

      <Section title="6. Job Claims & Customer Veto Rights">
        <p>When you claim a job:</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>The customer has a <strong>10-minute window</strong> to review your profile and approve or 
            reassign the job</li>
          <li>If the customer chooses to reassign, you will be notified that the job has been reassigned 
            to another provider. You may not re-claim that specific job</li>
          <li>Frequent reassignments may trigger a profile review by our team</li>
          <li>You must provide an accurate ETA when claiming a job</li>
          <li>Once approved, you are expected to complete the job as described</li>
        </ul>
      </Section>

      <Section title="7. Service Standards & Liability">
        <p>As a service provider, you agree to:</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>Perform services professionally and to a reasonable standard of quality</li>
          <li>Arrive within your stated ETA or notify the customer of delays</li>
          <li>Take before and after photos of completed work</li>
          <li>Respect customer property and privacy</li>
          <li>Carry appropriate insurance coverage</li>
          <li>Comply with all safety regulations and best practices</li>
        </ul>
        <p>
          <strong>YOU ARE SOLELY LIABLE for any damages, injuries, or losses that occur during or as a result 
          of the services you perform.</strong> Terrazas bears no responsibility for your actions, negligence, 
          or the quality of your work.
        </p>
      </Section>

      <Section title="8. Account Suspension & Termination">
        <p>Terrazas may suspend or terminate your provider account for:</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>Consistently low ratings (below 3.0 stars)</li>
          <li>Frequent customer complaints or vetos</li>
          <li>Failure to complete claimed jobs</li>
          <li>Falsified profile information or reviews</li>
          <li>Unsafe or illegal conduct</li>
          <li>Any violation of these Terms</li>
        </ul>
      </Section>
    </>
  );
}

// ── Shared Section Component ───────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>{title}</h3>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: '#475569' }}>{children}</div>
    </div>
  );
}
