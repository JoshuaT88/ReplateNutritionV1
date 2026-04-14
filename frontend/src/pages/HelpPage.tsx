import {
  HelpCircle, Users, Sparkles, CalendarDays, ShoppingCart, History,
  Utensils, Brain, TrendingDown, MapPin, DollarSign,
  ShieldCheck, Smartphone, ChevronDown
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const sections = [
  {
    icon: Users,
    title: 'Profiles',
    description: 'Create profiles for every member of your household — humans and pets alike. Each profile stores allergies, intolerances, dietary restrictions, special conditions (e.g., Autism/ARFID, Celiac), food preferences, and dislikes. The AI uses these profiles to generate safe, personalized recommendations.',
  },
  {
    icon: Sparkles,
    title: 'Recommendations',
    description: 'Generate AI-powered food, brand, and recipe recommendations tailored to each profile. Every recommendation includes nutritional info, ingredients, texture descriptions, price range, and alternatives. You can add recommendations directly to your shopping list or meal plan with one tap.',
  },
  {
    icon: CalendarDays,
    title: 'Meal Planning',
    description: 'Plan meals for each profile by day and meal type. The AI avoids repeating recent meals and respects all dietary constraints. Each meal includes ingredients, preparation notes, and calorie counts. Generate a shopping list directly from your meal plan.',
  },
  {
    icon: ShoppingCart,
    title: 'Smart Shopping List',
    description: 'Your shopping list organizes items by category (Produce, Dairy, Pantry, etc.) and priority (High / Medium / Low). Items can be added manually, from recommendations, or auto-generated from your meal plan. Every item is editable — change the name, quantity, priority, or notes anytime.',
  },
  {
    icon: MapPin,
    title: 'Store Finder & Pricing',
    description: 'Enter your ZIP code to find nearby grocery stores with estimated total costs for your list. Pricing combines crowd-sourced data (submitted by users during shopping) with AI estimates. The more you shop, the more accurate prices become for your area.',
  },
  {
    icon: ShoppingCart,
    title: 'Shopping Sessions',
    description: 'Start a shopping session tied to a specific store. Items are grouped by predicted aisle location for efficient navigation. For each item, mark it as Picked Up, Out of Stock, Too Expensive, or Skip. Optionally log the actual price — this feeds the crowd-sourced price database. When you finish, a shopping history entry is created automatically.',
  },
  {
    icon: History,
    title: 'Shopping History',
    description: 'Every completed session is saved with the store name, date, items picked up, items that were out of stock or too expensive, and total spend. Use this to track spending over time and identify patterns.',
  },
  {
    icon: DollarSign,
    title: 'Budget Tracking',
    description: 'Set a weekly budget in Settings. The shopping session shows a running total as you pick up items. Over time, the system learns which stores are cheapest for your usual items and can suggest the best store for your list. High-priority items are highlighted so you never miss essentials even on a tight budget.',
  },
  {
    icon: Brain,
    title: 'How the System Learns',
    description: 'Every shopping session teaches the system: actual prices are crowd-sourced to improve estimates for your ZIP region, aisle locations are remembered and verified, and out-of-stock patterns help future recommendations. The more you use Replate, the more accurate pricing, navigation, and suggestions become.',
  },
];

const faqs = [
  {
    q: 'Is my data private?',
    a: 'Yes. Your profile and dietary data are stored securely and never shared. Only anonymized price data (item + store + ZIP region) is aggregated to improve estimates for all users.',
  },
  {
    q: 'How accurate are AI-generated prices?',
    a: 'AI estimates are a starting point. As you and other users log actual prices, the system switches to crowd-sourced data which is significantly more accurate. Stores with more user submissions show a "crowd_sourced" confidence badge.',
  },
  {
    q: 'How does aisle navigation work?',
    a: 'The AI predicts likely aisle locations based on the store name and item type. When you or others confirm or correct aisle locations during sessions, those are saved and reused — making navigation more accurate over time.',
  },
  {
    q: 'Can I use this for pets?',
    a: 'Absolutely. Create a PET profile with species type, weight, allergies, and dietary needs. The AI will only recommend species-appropriate foods and flag any dangerous ingredients.',
  },
  {
    q: 'How do I adjust my budget?',
    a: 'Go to Settings → Account → Weekly Budget. During a shopping session, the running total updates in real-time so you can stay within budget. High-priority items are visually flagged so you can focus on essentials first.',
  },
  {
    q: 'What happens when items are out of stock?',
    a: 'Mark them "Out of Stock" during your session. The system remembers this pattern and can suggest alternative stores where those items are typically available. Skipped items stay on your list for next time.',
  },
];

export default function HelpPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mx-auto mb-3">
          <Utensils className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Replate Nutrition</h1>
        <p className="text-sm text-muted max-w-md mx-auto">
          AI-powered dietary management and smart shopping for your entire household — humans and pets.
        </p>
        <Badge variant="secondary">v1.0.0</Badge>
      </div>

      {/* How It Works */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" /> How It Works
        </h2>
        <div className="space-y-3">
          {sections.map((section) => (
            <Card key={section.title}>
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">{section.title}</h3>
                    <p className="text-xs text-muted leading-relaxed">{section.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Workflow */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-primary" /> Typical Workflow
        </h2>
        <Card>
          <CardContent className="p-5">
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <Badge className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs">1</Badge>
                <span><strong>Create Profiles</strong> for each household member with their dietary needs.</span>
              </li>
              <li className="flex gap-3">
                <Badge className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs">2</Badge>
                <span><strong>Generate Recommendations</strong> — AI creates personalized food, brand, and recipe suggestions.</span>
              </li>
              <li className="flex gap-3">
                <Badge className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs">3</Badge>
                <span><strong>Plan Meals</strong> or add recommendations directly to your meal plan.</span>
              </li>
              <li className="flex gap-3">
                <Badge className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs">4</Badge>
                <span><strong>Build Shopping List</strong> — add items manually, from recommendations, or generate from meal plan.</span>
              </li>
              <li className="flex gap-3">
                <Badge className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs">5</Badge>
                <span><strong>Find Stores</strong> — compare prices at nearby stores for your list.</span>
              </li>
              <li className="flex gap-3">
                <Badge className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs">6</Badge>
                <span><strong>Start Shopping Session</strong> — items grouped by aisle, tap to mark picked up, log prices.</span>
              </li>
              <li className="flex gap-3">
                <Badge className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs">7</Badge>
                <span><strong>End Session</strong> — history saved, prices contributed, list cleaned up.</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> FAQ
        </h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <Card key={i}>
              <button
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                className="w-full text-left p-4 flex items-center justify-between"
              >
                <span className="text-sm font-medium pr-4">{faq.q}</span>
                <ChevronDown className={cn('h-4 w-4 text-muted shrink-0 transition-transform', expandedFaq === i && 'rotate-180')} />
              </button>
              {expandedFaq === i && (
                <div className="px-4 pb-4">
                  <p className="text-xs text-muted leading-relaxed">{faq.a}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Mobile / PWA note */}
      <Card>
        <CardContent className="p-5 flex gap-4">
          <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">Mobile Access</h3>
            <p className="text-xs text-muted leading-relaxed">
              Replate is a Progressive Web App (PWA). On your phone, open the app in your browser and tap
              "Add to Home Screen" for a native app-like experience — works offline for viewing your list
              and during in-store shopping sessions.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-[10px] text-muted pb-8">
        Built with React, Express, PostgreSQL, Prisma, and OpenAI. &copy; {new Date().getFullYear()} Replate Nutrition.
      </p>
    </div>
  );
}
