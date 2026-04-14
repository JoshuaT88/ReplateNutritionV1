import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Loader2, User, Heart, ShieldAlert } from 'lucide-react';
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

const ALLERGIES = ['Peanuts', 'Tree Nuts', 'Shellfish', 'Dairy', 'Eggs', 'Wheat', 'Soy', 'Fish', 'Sesame'];
const INTOLERANCES = ['Lactose', 'Gluten', 'Fructose', 'Histamine', 'Sulfite', 'Caffeine'];
const RESTRICTIONS = ['Vegan', 'Vegetarian', 'Kosher', 'Halal', 'Keto', 'Paleo', 'Low-FODMAP', 'Mediterranean', 'Whole30'];
const HUMAN_CONDITIONS = ['Autism/ARFID', 'Celiac Disease', 'IBS', "Crohn's Disease", 'Diabetes Type 1', 'Diabetes Type 2', 'PCOS', 'Phenylketonuria', 'Gout'];
const PET_CONDITIONS = ['Kidney Disease', 'Skin Allergies', 'Joint Issues', 'Weight Management', 'Senior Diet', 'Sensitive Stomach', 'Dental Issues'];

export default function ProfileFormPage() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState<ProfileFormData>({
    name: '', type: 'HUMAN', allergies: [], intolerances: [],
    dietaryRestrictions: [], specialConditions: [], foodPreferences: [], foodDislikes: [],
  });

  useQuery({
    queryKey: ['profile', id],
    queryFn: () => api.getProfile(id!),
    enabled: isEditing,
    // @ts-ignore
    onSuccess: (data: any) => {
      setForm({
        name: data.name, type: data.type, petType: data.petType, age: data.age,
        weight: data.weight, allergies: data.allergies, intolerances: data.intolerances,
        dietaryRestrictions: data.dietaryRestrictions, specialConditions: data.specialConditions,
        foodPreferences: data.foodPreferences, foodDislikes: data.foodDislikes, notes: data.notes,
      });
    },
  });

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
                  <div>
                    <Label>Pet type</Label>
                    <Input value={form.petType || ''} onChange={(e) => update({ petType: e.target.value })} placeholder="Dog, Cat, Bird..." className="mt-1.5" />
                  </div>
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
                <div>
                  <Label className="mb-2 block">Allergies</Label>
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
