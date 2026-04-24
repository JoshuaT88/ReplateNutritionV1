import { useState, type FormEvent, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Loader2, User, Heart, ShieldAlert, Camera, AlertTriangle, PawPrint } from 'lucide-react';
import { api } from '@/lib/api';
import type { ProfileFormData, ProfileType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TagInput } from '@/components/shared/TagInput';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const COMMON_DOG_BREEDS = ['Labrador Retriever','Golden Retriever','German Shepherd','French Bulldog','Bulldog','Poodle','Beagle','Rottweiler','Yorkshire Terrier','Boxer','Dachshund','Siberian Husky','Great Dane','Shih Tzu','Doberman','Chihuahua','Pomeranian','Border Collie','Maltese','Mixed Breed'];
const COMMON_CAT_BREEDS = ['Domestic Shorthair','Domestic Longhair','Maine Coon','Siamese','Persian','Ragdoll','Bengal','Sphynx','Abyssinian','Scottish Fold','Birman','British Shorthair','Mixed Breed'];
const ALLERGIES = ['Peanuts', 'Tree Nuts', 'Shellfish', 'Dairy', 'Eggs', 'Wheat', 'Soy', 'Fish', 'Sesame', 'Corn', 'Lupin', 'Mustard', 'Celery', 'Sulfites', 'Molluscs'];
const INTOLERANCES = ['Lactose', 'Gluten', 'Fructose', 'Histamine', 'Sulfite', 'Caffeine', 'Sorbitol', 'Salicylates', 'Nightshades'];
const RESTRICTIONS = ['Vegan', 'Vegetarian', 'Kosher', 'Halal', 'Keto', 'Paleo', 'Low-FODMAP', 'Mediterranean', 'Whole30', 'Low-Sodium', 'Low-Fat', 'Low-Purine', 'Anti-Inflammatory', 'AIP (Autoimmune Protocol)'];
const HUMAN_CONDITIONS = [
  // Neurological / Behavioral
  'Autism/ARFID', 'ADHD', 'Sensory Processing Disorder', 'Food Neophobia',
  // Gastrointestinal
  'Celiac Disease', 'IBS', "Crohn's Disease", 'Ulcerative Colitis', 'GERD/Acid Reflux',
  'Eosinophilic Esophagitis (EoE)', 'FPIES', 'Short Bowel Syndrome',
  // Metabolic
  'Diabetes Type 1', 'Diabetes Type 2', 'Phenylketonuria (PKU)',
  'MSPI (Milk-Soy Protein Intolerance)', 'Galactosemia',
  // Hormonal / Immune
  'PCOS', 'Hypothyroidism', 'Mast Cell Activation Syndrome',
  // Other
  'Gout', 'Kidney Disease', 'Cancer (dietary support)', 'Osteoporosis',
  'Eating Disorder Recovery', 'Pregnancy / Prenatal',
];
const PET_CONDITIONS = [
  'Kidney Disease', 'Liver Disease', 'Pancreatitis', 'IBD (Inflammatory Bowel Disease)',
  'Skin Allergies', 'Food Allergies', 'Joint Issues / Arthritis',
  'Weight Management (Overweight)', 'Weight Management (Underweight)',
  'Senior Diet', 'Sensitive Stomach', 'Dental Issues',
  'Diabetes', 'Hypothyroidism', 'Hyperthyroidism',
  'Megaesophagus', 'Cancer (dietary support)', 'Urinary Issues / Crystals',
  'Heart Disease', 'Cognitive Decline (Senior)',
];

export default function ProfileFormPage() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState<ProfileFormData>({
    name: '', type: 'HUMAN', allergies: [], intolerances: [],
    dietaryRestrictions: [], specialConditions: [], foodPreferences: [], foodDislikes: [],
    criticalAllergies: [],
  });
  const [feedingTimes, setFeedingTimes] = useState<string[]>(['']);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useQuery({
    queryKey: ['profile', id],
    queryFn: () => api.getProfile(id!),
    enabled: isEditing,
    // @ts-ignore
    onSuccess: (data: any) => {
      setForm({
        name: data.name, type: data.type, petType: data.petType,
        breed: data.breed, dietType: data.dietType,
        age: data.age, weight: data.weight,
        allergies: data.allergies, intolerances: data.intolerances,
        dietaryRestrictions: data.dietaryRestrictions, specialConditions: data.specialConditions,
        foodPreferences: data.foodPreferences, foodDislikes: data.foodDislikes, notes: data.notes,
        criticalAllergies: data.criticalAllergies || [],
        feedingSchedule: data.feedingSchedule || null,
      });
      if (data.feedingSchedule?.times) {
        setFeedingTimes(data.feedingSchedule.times);
      }
      setAvatarUrl(data.avatarUrl || null);
    },
  });

  const avatarMutation = useMutation({
    mutationFn: ({ profileId, file }: { profileId: string; file: File }) =>
      api.uploadProfileAvatar(profileId, file),
    onSuccess: (data) => {
      setAvatarUrl(data.avatarUrl);
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast('success', 'Photo updated');
    },
    onError: (e: any) => toast('error', e.message),
  });

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    if (isEditing) {
      avatarMutation.mutate({ profileId: id!, file });
    }
  }

  const mutation = useMutation({
    mutationFn: (data: ProfileFormData) =>
      isEditing ? api.updateProfile(id!, data) : api.createProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast('success', isEditing ? 'Profile updated' : 'Profile created');
      navigate('/profiles');
    },
    onError: (err: Error) => toast('error', 'Failed to save profile', err.message),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const update = (patch: Partial<ProfileFormData>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-semibold mb-6">{isEditing ? 'Edit Profile' : 'New Profile'}</h1>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="identity">
            <TabsList className="mb-6">
              <TabsTrigger value="identity" className="gap-1.5"><User className="h-3.5 w-3.5" /> Identity</TabsTrigger>
              <TabsTrigger value="dietary" className="gap-1.5"><Heart className="h-3.5 w-3.5" /> Dietary</TabsTrigger>
              <TabsTrigger value="conditions" className="gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Conditions</TabsTrigger>
            </TabsList>
            <TabsContent value="identity">
              <div className="bg-white rounded-2xl border border-card-border p-6 space-y-4">
                {/* Avatar upload */}
                {isEditing && (
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {(avatarPreview || avatarUrl) ? (
                        <img
                          src={avatarPreview || (avatarUrl?.startsWith('/') ? `http://localhost:3001${avatarUrl}` : avatarUrl) || ''}
                          alt="Avatar"
                          className="w-16 h-16 rounded-2xl object-cover border border-card-border"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                          {form.name?.[0] || '?'}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center shadow-md"
                      >
                        <Camera className="h-3.5 w-3.5" />
                      </button>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                    </div>
                    <p className="text-sm text-text-secondary">
                      {avatarMutation.isPending ? 'Uploading...' : 'Tap the camera to update photo'}
                    </p>
                  </div>
                )}
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Sarah, Buddy" required className="mt-1.5" />
                </div>
                <div>
                  <Label>Type</Label>
                  <div className="flex gap-3 mt-1.5">
                    {(['HUMAN', 'PET'] as ProfileType[]).map((t) => (
                      <button key={t} type="button" onClick={() => update({ type: t })}
                        className={cn('flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
                          form.type === t ? 'border-primary bg-primary/5 text-primary' : 'border-card-border text-muted hover:border-slate-300'
                        )}>
                        {t === 'HUMAN' ? '🧑 Human' : '🐾 Pet'}
                      </button>
                    ))}
                  </div>
                </div>
                {form.type === 'PET' && (
                  <>
                    <div>
                      <Label>Pet type</Label>
                      <Input value={form.petType || ''} onChange={(e) => update({ petType: e.target.value })} placeholder="Dog, Cat, Bird..." className="mt-1.5" />
                    </div>
                    <div>
                      <Label>Breed <span className="text-muted font-normal text-xs">(optional)</span></Label>
                      <BreedAutocomplete
                        value={form.breed || ''}
                        onChange={(v) => update({ breed: v })}
                        petType={form.petType || ''}
                      />
                    </div>
                    <div>
                      <Label>Diet Type</Label>
                      <div className="flex gap-2 mt-1.5">
                        {(['Kibble', 'Raw/Fresh', 'Mixed'] as const).map((dt) => (
                          <button key={dt} type="button"
                            onClick={() => update({ dietType: form.dietType === dt ? null : dt })}
                            className={cn('flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all',
                              form.dietType === dt
                                ? 'border-primary bg-primary/5 text-primary'
                                : 'border-card-border text-muted hover:border-slate-300'
                            )}
                          >
                            {dt === 'Kibble' ? '🥣' : dt === 'Raw/Fresh' ? '🥩' : '🍽️'} {dt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-card-border p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <PawPrint className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-semibold">Feeding Schedule</Label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted">Meals per day</Label>
                          <Input
                            type="number" min={1} max={10}
                            value={form.feedingSchedule?.mealsPerDay ?? ''}
                            onChange={(e) => update({ feedingSchedule: { ...form.feedingSchedule, mealsPerDay: e.target.value ? parseInt(e.target.value) : undefined } })}
                            placeholder="2"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted">Amount per feeding</Label>
                          <Input
                            value={form.feedingSchedule?.amountPerFeeding ?? ''}
                            onChange={(e) => update({ feedingSchedule: { ...form.feedingSchedule, amountPerFeeding: e.target.value || undefined } })}
                            placeholder="1 cup"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted">Feeding times</Label>
                        <div className="space-y-1.5 mt-1">
                          {feedingTimes.map((time, i) => (
                            <div key={i} className="flex gap-2">
                              <Input
                                type="time"
                                value={time}
                                onChange={(e) => {
                                  const updated = [...feedingTimes];
                                  updated[i] = e.target.value;
                                  setFeedingTimes(updated);
                                  update({ feedingSchedule: { ...form.feedingSchedule, times: updated.filter(Boolean) } });
                                }}
                                className="flex-1"
                              />
                              {feedingTimes.length > 1 && (
                                <button type="button" onClick={() => {
                                  const updated = feedingTimes.filter((_, j) => j !== i);
                                  setFeedingTimes(updated);
                                  update({ feedingSchedule: { ...form.feedingSchedule, times: updated.filter(Boolean) } });
                                }} className="text-muted hover:text-red-500 text-xs px-2">×</button>
                              )}
                            </div>
                          ))}
                          {feedingTimes.length < 6 && (
                            <button type="button" onClick={() => setFeedingTimes([...feedingTimes, ''])}
                              className="text-xs text-primary hover:underline">+ Add time</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Age</Label>
                    <Input type="number" value={form.age ?? ''} onChange={(e) => update({ age: e.target.value ? Number(e.target.value) : null })} placeholder="Years" className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Weight (lbs)</Label>
                    <Input type="number" value={form.weight ?? ''} onChange={(e) => update({ weight: e.target.value ? Number(e.target.value) : null })} placeholder="lbs" className="mt-1.5" />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="dietary">
              <div className="bg-white rounded-2xl border border-card-border p-6 space-y-5">
                {/* Critical Allergens — highest prominence */}
                <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <Label className="text-red-700 font-semibold text-sm">Life-Threatening / Critical Allergens</Label>
                      <p className="text-xs text-red-600 mt-0.5">
                        These trigger maximum safety checks. Items containing these allergens will be <strong>completely blocked</strong> from all recommendations, meal plans, and recipes for this profile.
                      </p>
                    </div>
                  </div>
                  <TagInput
                    value={form.criticalAllergies ?? []}
                    onChange={(v) => update({ criticalAllergies: v })}
                    suggestions={ALLERGIES}
                    placeholder="e.g. Peanuts, Tree Nuts, Shellfish..."
                  />
                </div>

                <div>
                  <Label className="mb-2 block">Additional Allergies</Label>
                  <p className="text-xs text-muted mb-2">Serious but not classified as life-threatening. Will be flagged with a warning.</p>
                  <TagInput value={form.allergies} onChange={(v) => update({ allergies: v })} suggestions={ALLERGIES} placeholder="Add allergies..." />
                </div>
                <div>
                  <Label className="mb-2 block">Intolerances</Label>
                  <TagInput value={form.intolerances} onChange={(v) => update({ intolerances: v })} suggestions={INTOLERANCES} placeholder="Add intolerances..." />
                </div>
                <div>
                  <Label className="mb-2 block">Dietary Restrictions</Label>
                  <TagInput value={form.dietaryRestrictions} onChange={(v) => update({ dietaryRestrictions: v })} suggestions={RESTRICTIONS} placeholder="Add restrictions..." />
                </div>
                <div>
                  <Label className="mb-2 block">Food Preferences</Label>
                  <TagInput value={form.foodPreferences} onChange={(v) => update({ foodPreferences: v })} placeholder="Foods you love..." />
                </div>
                <div>
                  <Label className="mb-2 block">Food Dislikes</Label>
                  <TagInput value={form.foodDislikes} onChange={(v) => update({ foodDislikes: v })} placeholder="Foods to avoid..." />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="conditions">
              <div className="bg-white rounded-2xl border border-card-border p-6 space-y-5">
                <div>
                  <Label className="mb-2 block">Special Conditions</Label>
                  <TagInput
                    value={form.specialConditions}
                    onChange={(v) => update({ specialConditions: v })}
                    suggestions={form.type === 'HUMAN' ? HUMAN_CONDITIONS : PET_CONDITIONS}
                    placeholder="Add conditions..."
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes || ''}
                    onChange={(e) => update({ notes: e.target.value })}
                    placeholder="Any additional dietary notes or context..."
                    className="mt-1.5"
                    rows={4}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> {isEditing ? 'Save Changes' : 'Create Profile'}</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function BreedAutocomplete({ value, onChange, petType }: { value: string; onChange: (v: string) => void; petType: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);

  const isdog = petType.toLowerCase().includes('dog');
  const iscat = petType.toLowerCase().includes('cat');
  const suggestions = isdog ? COMMON_DOG_BREEDS : iscat ? COMMON_CAT_BREEDS : [...COMMON_DOG_BREEDS, ...COMMON_CAT_BREEDS];
  const filtered = suggestions.filter((b) => b.toLowerCase().includes(query.toLowerCase())).slice(0, 8);

  return (
    <div className="relative mt-1.5">
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="e.g. Labrador Retriever"
      />
      {open && filtered.length > 0 && query.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 bg-white border border-card-border rounded-xl shadow-lg mt-1 overflow-hidden">
          {filtered.map((breed) => (
            <button
              key={breed}
              type="button"
              onMouseDown={() => { onChange(breed); setQuery(breed); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
            >
              {breed}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
