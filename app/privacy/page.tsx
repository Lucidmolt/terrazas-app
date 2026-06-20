'use client';

import { ArrowLeft, Shield, Lock, Eye, Trash2 } from 'lucide-react';

export default function PrivacyPolicy() {
  const goBack = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-6 md:p-12">
      <div className="max-w-4xl mx-auto bg-white rounded-5xl border border-slate-100 shadow-xl overflow-hidden">
        {/* Header Banner */}
        <div className="bg-brand-600 px-8 py-10 text-white relative">
          <button 
            onClick={goBack} 
            className="absolute top-6 left-6 flex items-center space-x-1.5 text-xs font-bold text-white/80 hover:text-white transition-colors cursor-pointer bg-brand-700/50 hover:bg-brand-700/80 px-3 py-1.5 rounded-full"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go Back</span>
          </button>
          
          <div className="mt-4 flex items-center space-x-3">
            <Shield className="w-8 h-8 text-white" />
            <h1 className="text-3xl font-black tracking-tight uppercase">Privacy Policy</h1>
          </div>
          <p className="text-brand-100 text-sm font-semibold mt-1 max-w-xl">
            How Terrazas collects, secures, and handles your property, photo, and geolocation dispatch data.
          </p>
        </div>

        {/* Content */}
        <div className="p-8 md:p-12 space-y-10">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">
            Last Updated: June 20, 2026
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 text-brand-700 font-extrabold text-sm uppercase tracking-wider">
              <Eye className="w-4 h-4" />
              <span>1. Information We Collect</span>
            </div>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              To power immediate lawn dispatch services, Terrazas collects:
            </p>
            <ul className="list-disc list-inside text-sm text-slate-500 font-medium leading-relaxed pl-4 space-y-1">
              <li><strong className="text-slate-800">Account Credentials:</strong> Phone number, email address, name, and role configuration (Customer or Pro).</li>
              <li><strong className="text-slate-800">Property Details & Address:</strong> Street address, postal ZIP code, and property boundaries/yard characteristics.</li>
              <li><strong className="text-slate-800">Job Documentation:</strong> Service request parameters, instruction notes, and pre/post-mow verification photos.</li>
              <li><strong className="text-slate-800">Real-Time Geolocation:</strong> Provider real-time route tracking coordinates during an active claimed dispatch run, allowing live map tracking.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 text-brand-700 font-extrabold text-sm uppercase tracking-wider">
              <Lock className="w-4 h-4" />
              <span>2. How We Secure & Use Your Data</span>
            </div>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              We process your data exclusively to deliver dispatch and payment capabilities:
            </p>
            <ul className="list-disc list-inside text-sm text-slate-500 font-medium leading-relaxed pl-4 space-y-1">
              <li><strong className="text-slate-800">Dispatch Routing:</strong> Showing your active service address and yard specs to certified Partner Pros within a 20-mile radius.</li>
              <li><strong className="text-slate-800">Secure Escrow Processing:</strong> Payment processing is handled via Stripe. No raw card credentials touch our servers. Escrow funds are held securely until photo-verification approval.</li>
              <li><strong className="text-slate-800">Progress Updates:</strong> Automated SMS and web-push notifications regarding dispatch confirmation, arrival, and completion.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 text-brand-700 font-extrabold text-sm uppercase tracking-wider">
              <Shield className="w-4 h-4" />
              <span>3. Sharing & Disclosing Data</span>
            </div>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              Your information is never sold. It is shared only under strict operational scopes:
            </p>
            <ul className="list-disc list-inside text-sm text-slate-500 font-medium leading-relaxed pl-4 space-y-1">
              <li><strong className="text-slate-800">Active Pros:</strong> Claiming Pros receive the job location coordinates and description text to fulfill the service.</li>
              <li><strong className="text-slate-800">Financial Partners:</strong> Stripe processes payments and handles customer and partner bank transfers.</li>
              <li><strong className="text-slate-800">Compliance & Safety:</strong> We release account details only when requested by regulatory authorities or to enforce mutual safety terms.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 text-brand-700 font-extrabold text-sm uppercase tracking-wider">
              <Trash2 className="w-4 h-4" />
              <span>4. Data Retention & Deletion</span>
            </div>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              You retain full control over your digital footprint. You can initiate complete account, data, and property mapping deletion at any time via your Profile Settings tab or by contacting support at <span className="text-brand-600 font-bold hover:underline">lucidmolt@icloud.com</span>. Once requested, your profile records are wiped clean from active databases within 48 hours.
            </p>
          </section>

          {/* Section 5 */}
          <section className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-2">
            <h4 className="text-slate-800 font-bold text-sm">Do you have questions or concerns?</h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              If you have any inquiries regarding data protection, escrow handling, or platform mechanics, reach out directly to the Terrazas administration team at:
              <br />
              <strong className="text-slate-700">lucidmolt@icloud.com</strong>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
