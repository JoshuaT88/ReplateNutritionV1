import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Utensils, ArrowRight, Users, Heart, DollarSign, PartyPopper } from 'lucide-react';
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

interface OnboardingProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingProps) {
  const { refreshPreferences } = useAuth();
  const [step, setStep] = useState(0);
  const [household, setHousehold] = useState<string[]>([]);
  const [profileName, setProfileName] = useState('');
  const [profileType, setProfileType] = useState<'HUMAN' | 'PET'>('HUMAN');
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [budget, setBudget] = useState(400);
  const [zipCode, setZipCode] = useState('');

  const next = () => setStep((s) => s + 1);
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const finish = async () => {
    try {
      // Save preferences
      await api.updatePreferences({
        budget,
        zipCode,
        householdType: household.join(','),
        firstVisitCompleted: true,
      });

      // Create first profile
      if (profileName.trim()) {
        await api.createProfile({
          name: profileName,
          type: profileType,
          allergies: [],
          intolerances: [],
          dietaryRestrictions: restrictions,
          specialConditions: [],
          foodPreferences: [],
          foodDislikes: [],
        });
      }

      await refreshPreferences();

      // Confetti!
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5 } }), 300);

      setStep(4);
    } catch {
      // Still complete onboarding even if API fails
      await api.updatePreferences({ firstVisitCompleted: true }).catch(() => {});
      await refreshPreferences();
      setStep(4);
    }
  };

  const steps = [
    // Step 0: Welcome
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
      <p className="text-muted max-w-md leading-relaxed">
        Your personal AI-powered nutrition assistant for the whole household — people and pets alike.
        Let's set things up in under a minute.
      </p>
      <Button onClick={next} size="lg" className="mt-8">
        Let's get started <ArrowRight className="h-5 w-5" />
      </Button>
    </div>,

    // Step 1: Household
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
        <Button variant="outline" onClick={prev}>Back</Button>
        <Button onClick={next} className="flex-1" disabled={household.length === 0}>
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>,

    // Step 2: First Profile
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

    // Step 3: Budget & Location
    <div key="budget" className="px-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50">
          <DollarSign className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Budget & location</h2>
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

    // Step 4: Complete
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
      <p className="text-muted max-w-md">
        Your household is configured and your first profile is ready.
        Head to the dashboard to start exploring.
      </p>
      <Button onClick={onComplete} size="lg" className="mt-8">
        Take me to my dashboard <ArrowRight className="h-5 w-5" />
      </Button>
    </div>,
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-background flex items-center justify-center">
      {/* Progress dots */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
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
