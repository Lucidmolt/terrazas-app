// LEGACY FILE — not used by Next.js app. Kept for reference only.
// Supabase credentials removed for security. Use .env.local instead.
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
const _supabase = typeof supabase !== 'undefined' ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const views = ['view-zip', 'view-provider-choice', 'view-preferred', 'view-tiers', 'view-success'];
let activeZip = '';
let selectedTier = 'Premium';

// Utility: Show View
function showView(id) {
    views.forEach(v => document.getElementById(v).classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// Utility: Global Loader
function triggerLoader(duration, next) {
    const loader = document.getElementById('loader');
    if (!loader) return next();
    loader.classList.remove('hidden');
    setTimeout(() => {
        loader.classList.add('hidden');
        next();
    }, duration);
}

// Check Zip Code & Fetch Providers
async function checkZip() {
    const val = document.getElementById('zip-input').value;
    if (val.length < 5) return;
    activeZip = val;
    
    triggerLoader(1000, async () => {
        // Query Supabase for providers in this zip WHO ARE ACTIVE
        const { data, error } = await _supabase
            .from('providers')
            .select('*')
            .eq('is_active', true) // Readiness Protocol: Filter only active/ready pros
            .filter('zip_codes', 'cs', `{"${activeZip}"}`);

        if (error) {
            console.error('Error checking zip:', error);
        }

        // Logic for Broadcast: First-to-claim for 15 minutes
        if (data && data.length > 0) {
            console.log(`[Terrazas] Found ${data.length} active pros in ${activeZip}.`);
        } else {
            console.warn('[Terrazas] No pros found. Fallback to broadcast logic.');
            // Implementation: Insert into 'jobs' as status='broadcast_pending'
        }

        showView('view-provider-choice');
        document.querySelectorAll('.active-zip-label').forEach(el => el.innerText = activeZip);
        document.getElementById('active-zip-text').innerText = activeZip;
        document.getElementById('header-loc').classList.remove('md:hidden');
        document.getElementById('header-zip').innerText = activeZip;
        
        // Map Animation
        const mapHub = document.getElementById('map-hub');
        const activePin = document.getElementById('active-pin');
        if (mapHub) mapHub.style.transform = 'scale(1.2) translateY(-20px)';
        if (activePin) {
            activePin.classList.remove('hidden');
            setTimeout(() => activePin.classList.remove('scale-0'), 100);
        }
    });
}

function showProviderChoice() { showView('view-provider-choice'); }
function showPreferred() { showView('view-preferred'); }
function showTiers() { showView('view-tiers'); }

function selectTier(tier, price, emoji) {
    selectedTier = tier;
    document.querySelectorAll('[id^="t-"]').forEach(el => {
        el.classList.remove('border-emerald-500', 'bg-emerald-50');
        el.classList.add('border-slate-100', 'bg-white');
    });
    const selected = document.getElementById(`t-${tier.toLowerCase()}`);
    if (selected) {
        selected.classList.add('border-emerald-500', 'bg-emerald-50');
        selected.classList.remove('border-slate-100', 'bg-white');
    }
}

async function selectSpecificPro(name, rating, status) {
    // Stage booking for specific provider
    triggerLoader(600, () => {
        showView('view-success');
    });
}

async function confirmTierBtn() {
    triggerLoader(2000, async () => {
        // 1. Insert Job into Supabase to trigger Edge Function
        const { data, error } = await _supabase
            .from('jobs')
            .insert([
                { 
                    zip_code: activeZip, 
                    tier: selectedTier, 
                    status: 'broadcast_active' 
                }
            ])
            .select();

        if (error) {
            console.error('[Terrazas] Job Insert Error:', error);
            alert("Booking failed. Please try again.");
            return;
        }

        // 2. Show Premium "Broadcast" Animation
        showView('view-searching');
        startBroadcastCountdown(15 * 60); // 15 Minute Window
    });
}

function startBroadcastCountdown(seconds) {
    const el = document.getElementById('broadcast-timer');
    const interval = setInterval(() => {
        seconds--;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (el) el.innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
        if (seconds <= 0) {
            clearInterval(interval);
            if (el) el.innerText = "Expanding Search...";
        }
    }, 1000);
}

function goHome() {
    triggerLoader(400, () => {
        showView('view-zip');
        const headerLoc = document.getElementById('header-loc');
        const mapHub = document.getElementById('map-hub');
        const activePin = document.getElementById('active-pin');
        const zipInput = document.getElementById('zip-input');
        
        if (headerLoc) headerLoc.classList.add('md:hidden');
        if (mapHub) mapHub.style.transform = 'scale(1)';
        if (activePin) activePin.classList.add('scale-0');
        if (zipInput) zipInput.value = '';
    });
}

// Yard Vision Pricing Guard Integration
document.addEventListener('DOMContentLoaded', () => {
    const aiBtn = document.getElementById('ai-vision-btn');
    if (aiBtn) {
        aiBtn.addEventListener('click', () => {
            alert("📸 Yard Verification Staged.\n\n- Detected Overgrowth? We'll suggest a higher tier.\n- Still want 'Basic'? No problem. We'll broadcast your job, but we'll include a 'Condition Warning' so our Pros know exactly what to expect before they arrive.");
        });
    }
});
