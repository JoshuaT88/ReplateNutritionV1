import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Utensils, ArrowRight, Users, Heart, DollarSign, PartyPopper, ShieldCheck, AlertTriangle, Home, User as UserIcon, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TagInput } from '@/components/shared/TagInput';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const HOUSEHOLD_OPTIONS = [
  { id: 'just-me', label: 'Just me', icon: '🧑' },
  { id: 'family', label: 'My family', icon: '👨‍👩‍👧‍👦' },
  { id: 'pets', label: 'My pet(s)', icon: '🐾' },
  { id: 'both', label: 'People and pets', icon: '🏠' },
];

const COMMON_RESTRICTIONS = [
  'Gluten-Free', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Nut Allergy', 'Keto',
  'Paleo', 'Kosher', 'Halal', 'Low-Sodium', 'Egg-Free', 'Soy-Free',
];

const COMMON_ALLERGENS = [
  'Peanuts', 'Tree Nuts', 'Shellfish', 'Dairy', 'Eggs', 'Wheat', 'Soy', 'Fish', 'Sesame',
];

interface OnboardingProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingProps) {
  const { refreshPreferences } = useAuth();
  const [step, setStep] = useState(0);
  // T57: household mode
  const [householdMode, setHouseholdMode] = useState<'solo' | 'household' | ''>('');
  // T53: organizer role
  const [organizerRole, setOrganizerRole] = useState('');
  const [household, setHousehold] = useState<string[]>([]);
  const [profileName, setProfileName] = useState('');
  const [profileType, setProfileType] = useState<'HUMAN' | 'PET'>('HUMAN');
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [criticalAllergies, setCriticalAllergies] = useState<string[]>([]);
  const [budget, setBudget] = useState(400);
  const [zipCode, setZipCode] = useState('');
  const [shoppingFrequency, setShoppingFrequency] = useState<string>('weekly');
  const [shoppingDay, setShoppingDay] = useState<string>('saturday');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSent, setInviteSent] = useState(false);

  const next = () => setStep((s) => s + 1);
  const prev = () => setStep((s) => Math.max(0, s - 1));

  // From Step 1 (mode select): skip organizer step if solo
  const nextFromModeStep = () => {
    if (householdMode === 'solo') setStep(3); // skip organizer step (index 2)
    else setStep(2);
  };
  // Back from Step 3 (household type): if solo, go back to step 1
  const prevFromHouseholdStep = () => {
    setStep(householdMode === 'solo' ? 1 : 2);
  };

  const finish = async () => {
    const tripsPerMonth = shoppingFrequency === 'weekly' ? 4 : shoppingFrequency === 'biweekly' ? 2 : 1;
    const perTripBudgetAllocation = shoppingFrequency === 'monthly' ? budget : budget / tripsPerMonth;
    try {
      await api.updatePreferences({
        budget,
        zipCode,
        householdType: household.join(','),
        firstVisitCompleted: true,
        shoppingFrequency,
        shoppingDay,
        perTripBudgetAllocation,
        ...(organizerRole ? { organizerRole } : {}),
      });

      if (profileName.trim()) {
        await api.createProfile({
          name: profileName,
          type: profileType,
          criticalAllergies,
          allergies: [],
          intolerances: [],
          dietaryRestrictions: restrictions,
          specialConditions: [],
          foodPreferences: [],
          foodDislikes: [],
        });
      }

      await refreshPreferences();
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5 } }), 300);
      setStep(7);
    } catch {
      await api.updatePreferences({ firstVisitCompleted: true, shoppingFrequency, shoppingDay, perTripBudgetAllocation }).catch(() => {});
      await refreshPreferences();
      setStep(7);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await api.createHousehold();
      await api.inviteHouseholdMember(inviteEmail.trim(), 'MEMBER');
      setInviteSent(true);
    } catch { /* non-critical */ }
  };

  const steps = [
    // Step 0: Mission Welcome (unchanged)
    <div key="welcome" className="flex flex-col items-center text-center px-6">
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.8 }}
        className="flex items-center justify-center w-20 h-20 rounded-3xl bg-primary mb-6"
      >
        <Utensils className="h-10 w-10 text-white" />
      </motion.div>
      <h1 className="font-display text-3xl font-bold text-foreground mb-3">Welcome to Replate Nutrition</h1>
      <p className="text-muted max-w-md leading-relaxed mb-6">
        Replate was built for <strong>every</strong> family — especially families with medical dietary needs,
        disabilities, conditions, severe allergies, picky eaters, and special-needs pets.
      </p>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-6 text-left">
        {[
          { icon: '⚠️', label: 'Life-threatening allergies' },
          { icon: '🧠', label: 'Autism, ADHD, ARFID' },
          { icon: '🩺', label: 'Celiac, PKU, Diabetes' },
          { icon: '🐾', label: 'Special needs pets' },
          { icon: '🌿', label: 'Deep dietary restrictions' },
          { icon: '👶', label: 'Super picky eaters' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm text-foreground">
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted max-w-sm mb-6">
        Your safety information filters <strong>every single recommendation, meal, and shopping list.</strong> Nothing gets through that conflicts with your profile.
      </p>
      <Button onClick={next} size="lg" className="mt-2">
        Let's get started <ArrowRight className="h-5 w-5" />
      </Button>
    </div>,

    // Step 1 (T57): Solo vs Household split
    <div key="mode" className="px-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50">
          <Home className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Who are you setting this up for?</h2>
          <p className="text-sm text-muted">You can always change this later.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {[
          { id: 'solo', icon: <UserIcon className="h-7 w-7 text-primary" />, label: 'Just myself', description: 'Solo planning — one account, your profiles.' },
          { id: 'household', icon: <Users className="h-7 w-7 text-primary" />, label: 'Managing a household', description: 'Invite family members, set roles and permissions.' },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => setHouseholdMode(opt.id as 'solo' | 'household')}
            className={cn(
              'flex flex-col items-start gap-2 p-5 rounded-2xl border-2 text-left transition-all',
              householdMode === opt.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-card-border hover:border-slate-300'
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-white border border-card-border flex items-center justify-center">{opt.icon}</div>
            <p className="font-semibold text-sm">{opt.label}</p>
            <p className="text-xs text-muted">{opt.description}</p>
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={prev}>Back</Button>
        <Button onClick={nextFromModeStep} className="flex-1" disabled={!householdMode}>
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>,

    // Step 2 (T53): Organizer role (household path only; solo skips to step 3)
    <div key="organizer" className="px-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-50">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">What's your role?</h2>
          <p className="text-sm text-muted">This helps us set default permissions for household members.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 mb-8">
        {[
          { id: 'Parent', label: 'Parent', description: 'Managing meals, budgets, and dietary safety for your children.' },
          { id: 'Caregiver', label: 'Caregiver', description: 'Supporting someone with medical, dietary, or special needs.' },
          { id: 'Spouse/Partner', label: 'Spouse / Partner', description: 'Shared household management with your partner.' },
          { id: 'Other', label: 'Other / Custom', description: 'Set up permissions however works for your household.' },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => setOrganizerRole(opt.id)}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
              organizerRole === opt.id ? 'border-primary bg-primary/5' : 'border-card-border hover:border-slate-300'
            )}
          >
            <div className="flex-1">
              <p className="text-sm font-semibold">{opt.label}</p>
              <p className="text-xs text-muted">{opt.description}</p>
            </div>
            {organizerRole === opt.id && <div className="w-3 h-3 rounded-full bg-primary shrink-0" />}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
        <Button onClick={next} className="flex-1" disabled={!organizerRole}>
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>,

    // Step 3: Household (who are we planning for) — was Step 1
    <div key="household" className="px-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Who are we planning for?</h2>
          <p className="text-sm text-muted">Select all that apply.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {HOUSEHOLD_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setHousehold((h) => h.includes(opt.id) ? h.filter((x) => x !== opt.id) : [...h, opt.id])}
            className={cn(
              'flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all duration-200',
              household.includes(opt.id)
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-card-border hover:border-slate-300 hover:-translate-y-0.5'
            )}
          >
            <span className="text-3xl">{opt.icon}</span>
            <span className="text-sm font-medium">{opt.label}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-3 mt-8">
        <Button variant="outline" onClick={prevFromHouseholdStep}>Back</Button>
        <Button onClick={next} className="flex-1" disabled={household.length === 0}>
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>,

    // Step 4: First Profile — was Step 2
    <div key="profile" className="px-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-50">
          <Heart className="h-5 w-5 text-rose-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Create your first profile</h2>
          <p className="text-sm text-muted">Who should we start with?</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="e.g. Sarah, Max (dog)" className="mt-1.5" />
        </div>

        <div>
          <Label>Type</Label>
          <div className="flex gap-3 mt-1.5">
            {(['HUMAN', 'PET'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setProfileType(t)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
                  profileType === t ? 'border-primary bg-primary/5 text-primary' : 'border-card-border text-muted hover:border-slate-300'
                )}
              >
                {t === 'HUMAN' ? '🧑 Human' : '🐾 Pet'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Dietary restrictions</Label>
          <p className="text-xs text-muted mb-2">Tap to add, or type your own.</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {COMMON_RESTRICTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRestrictions((p) => p.includes(r) ? p.filter((x) => x !== r) : [...p, r])}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                  restrictions.includes(r) ? 'border-primary bg-primary/10 text-primary' : 'border-card-border text-muted hover:border-slate-300'
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <TagInput value={restrictions} onChange={setRestrictions} placeholder="Add custom restriction..." />
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <Button variant="outline" onClick={prev}>Back</Button>
        <Button onClick={next} className="flex-1">Continue <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </div>,

    // Step 5: Safety / Critical Allergens — was Step 3
    <div key="safety" className="px-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50">
          <ShieldCheck className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Safety information</h2>
          <p className="text-sm text-muted">This is the most important step.</p>
        </div>
      </div>

      <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 mb-5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-700 leading-relaxed">
            <strong>Does {profileName || 'this person'} have any life-threatening or severe allergies?</strong><br />
            These will trigger our maximum safety level — items containing these allergens will be completely blocked from <em>all</em> AI recommendations, meal plans, and recipes for this profile. You can always add more later in the profile settings.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Critical / Life-Threatening Allergens</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {COMMON_ALLERGENS.map((a) => (
            <button
              key={a}
              onClick={() => setCriticalAllergies((p) => p.includes(a) ? p.filter((x) => x !== a) : [...p, a])}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium border-2 transition-colors',
                criticalAllergies.includes(a)
                  ? 'border-red-500 bg-red-100 text-red-700'
                  : 'border-card-border text-muted hover:border-red-300'
              )}
            >
              {a}
            </button>
          ))}
        </div>
        <TagInput
          value={criticalAllergies}
          onChange={setCriticalAllergies}
          placeholder="Add allergen (e.g. specific nut, medication dye...)..."
        />
      </div>

      <p className="text-xs text-muted mt-4">
        No critical allergens? That's fine — tap Continue. You can add detailed conditions, intolerances, and preferences from the profile page after setup.
      </p>

      <div className="flex gap-3 mt-6">
        <Button variant="outline" onClick={prev}>Back</Button>
        <Button onClick={next} className="flex-1">Continue <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </div>,

    // Step 6: Budget & Location — was Step 4
    <div key="budget" className="px-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50">
          <DollarSign className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Budget & shopping schedule</h2>
          <p className="text-sm text-muted">Helps us find relevant stores and plan wisely.</p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <Label>Monthly shopping budget</Label>
          <div className="flex items-center gap-4 mt-2">
            <input
              type="range"
              min={50}
              max={2000}
              step={25}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="font-mono text-lg font-semibold text-foreground w-20 text-right">
              ${budget}
            </span>
          </div>
          <div className="flex justify-between text-xs text-muted mt-1">
            <span>$50</span>
            <span>$2,000</span>
          </div>
          {/* Per-trip allocation hint */}
          <div className="mt-2 text-xs text-muted bg-amber-50 rounded-lg px-3 py-2">
            {shoppingFrequency === 'weekly' && <span>≈ <strong>${(budget / 4).toFixed(0)}</strong> per trip (weekly)</span>}
            {shoppingFrequency === 'biweekly' && <span>≈ <strong>${(budget / 2).toFixed(0)}</strong> per trip (every 2 weeks)</span>}
            {shoppingFrequency === 'monthly' && <span>≈ <strong>${budget.toFixed(0)}</strong> per trip (monthly)</span>}
            {shoppingFrequency === 'custom' && <span>You can fine-tune your per-trip budget in Settings.</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>How often do you shop?</Label>
            <select
              value={shoppingFrequency}
              onChange={(e) => setShoppingFrequency(e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-xl border border-card-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <Label>Preferred shopping day</Label>
            <select
              value={shoppingDay}
              onChange={(e) => setShoppingDay(e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-xl border border-card-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              {['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map((d) => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label>ZIP code</Label>
          <Input
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g. 33156"
            maxLength={5}
            className="mt-1.5"
          />
          <p className="text-xs text-muted mt-1">Used to find nearby grocery stores.</p>
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <Button variant="outline" onClick={prev}>Back</Button>
        <Button onClick={finish} className="flex-1">Finish setup <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </div>,

    // Step 7: Complete — was Step 5
    <div key="complete" className="flex flex-col items-center text-center px-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
        className="flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-50 mb-6"
      >
        <PartyPopper className="h-10 w-10 text-accent-success" />
      </motion.div>
      <h1 className="font-display text-3xl font-bold text-foreground mb-3">You're all set!</h1>
      <p className="text-muted max-w-md mb-2">
        Your household is configured and your first profile is ready.
      </p>
      {criticalAllergies.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 mb-4">
          <ShieldCheck className="h-4 w-4 text-red-600 flex-shrink-0" />
          <span>Critical allergen protection active: <strong>{criticalAllergies.join(', ')}</strong></span>
        </div>
      )}
      <p className="text-sm text-muted max-w-sm">
        Head to your profile to add more detail — conditions, intolerances, and specific texture or sensory needs.
      </p>

      {/* T57: Invite CTA for household mode */}
      {householdMode === 'household' && (
        <div className="mt-6 w-full max-w-sm bg-indigo-50 rounded-2xl p-4 text-left">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Invite household members</p>
          </div>
          {inviteSent ? (
            <p className="text-xs text-green-700">✓ Invite sent to {inviteEmail}</p>
          ) : (
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="family@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 h-8 rounded-lg border border-card-border px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <button
                onClick={sendInvite}
                disabled={!inviteEmail.trim()}
                className="px-3 h-8 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50"
              >
                Send
              </button>
            </div>
          )}
          <p className="text-[10px] text-muted mt-1.5">You can manage members anytime in Settings → Household.</p>
        </div>
      )}

      <Button onClick={onComplete} size="lg" className="mt-8">
        Take me to my dashboard <ArrowRight className="h-5 w-5" />
      </Button>
    </div>,
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-background flex items-center justify-center">
      {/* Progress dots */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === step ? 'w-8 bg-primary' : i < step ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-slate-200'
            )}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ x: 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -80, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-xl"
        >
          {steps[step]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
