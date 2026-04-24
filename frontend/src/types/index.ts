// ============ Auth ============
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'MEMBER';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

// ============ Preferences ============
export interface UserPreferences {
  id: string;
  userId: string;
  zipCode: string | null;
  budget: number | null;
  currency: string;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  firstVisitCompleted: boolean;
  profilePictureUrl: string | null;
  householdType: string | null;
  mealReminders: boolean;
  shoppingAlerts: boolean;
  priceDropAlerts: boolean;
  emailNotificationsEnabled: boolean;
  emailNotificationsDisclosureAccepted: boolean;
  emailNotificationsDisclosureAcceptedAt: string | null;
  budgetLastResetAt: string | null;
  gpsAppPreference: string | null;
  preferredStoreIds: string[] | null;
  pinnedNavItems: string[] | null;
  shoppingFrequency: string | null;
  shoppingDay: string | null;
  perTripBudgetAllocation: number | null;
  organizerRole: string | null;
}

// ============ Data Export ============
export interface DataExportStatus {
  dataExportUrl: string | null;
  dataExportExpiresAt: string | null;
  dataExportRequestedAt: string | null;
}

// ============ Profiles ============
export type ProfileType = 'HUMAN' | 'PET';

export interface Profile {
  id: string;
  userId: string;
  name: string;
  type: ProfileType;
  petType: string | null;
  breed: string | null;
  dietType: string | null;
  feedingSchedule: { mealsPerDay?: number; amountPerFeeding?: string; times?: string[] } | null;
  age: number | null;
  weight: number | null;
  avatarUrl: string | null;
  allergies: string[];
  intolerances: string[];
  dietaryRestrictions: string[];
  specialConditions: string[];
  foodPreferences: string[];
  foodDislikes: string[];
  criticalAllergies: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileFormData {
  name: string;
  type: ProfileType;
  petType?: string | null;
  breed?: string | null;
  dietType?: string | null;
  feedingSchedule?: { mealsPerDay?: number; amountPerFeeding?: string; times?: string[] } | null;
  age?: number | null;
  weight?: number | null;
  allergies: string[];
  intolerances: string[];
  dietaryRestrictions: string[];
  specialConditions: string[];
  foodPreferences: string[];
  foodDislikes: string[];
  criticalAllergies: string[];
  notes?: string | null;
}

// ============ Recommendations ============
export interface Recommendation {
  id: string;
  profileId: string;
  itemName: string;
  itemType: 'food' | 'brand' | 'recipe';
  category: string;
  reason: string;
  ingredients: string[];
  alternatives: string[];
  priceRange: string | null;
  isFavorite: boolean;
  rating: number | null;
  nutrition: {
    calories?: number;
    protein?: string;
    fiber?: string;
    keyNutrients?: string[];
  } | null;
  texture: string | null;
  safetyFlag: string | null;
  createdAt: string;
  profile?: { name: string; type: string };
}

// ============ Meal Plan ============
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'beverage' | 'dessert' | 'morning_feed' | 'evening_feed' | 'treat_time';

export interface MealPlan {
  id: string;
  profileId: string;
  date: string;
  mealType: MealType;
  mealName: string;
  ingredients: string[];
  preparationNotes: string | null;
  calories: number | null;
  servings: number | null;
  prepTime: number | null;
  completed: boolean;
  safetyFlag: string | null;
  createdAt: string;
  profile?: { name: string; type: string };
}

export interface CustomMeal {
  id: string;
  name: string;
  mealType: string;
  ingredients: string[];
  preparationNotes: string | null;
  calories: number | null;
  servings: number | null;
  prepTime: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ============ Shopping ============
export type ItemPriority = 'LOW' | 'MEDIUM' | 'HIGH';export type ShoppingItemStatus = 'PENDING' | 'PICKED_UP' | 'OUT_OF_STOCK' | 'TOO_EXPENSIVE';

export interface ShoppingItem {
  id: string;
  itemName: string;
  category: string | null;
  quantity: string | null;
  estimatedPrice: number | null;
  assignedStore: string | null;
  profileIds: string[];
  checked: boolean;
  priority: ItemPriority;
  notes: string | null;
  sourceRef: string | null;
  createdAt: string;
}

export interface StoreResult {
  name: string;
  address: string;
  phone: string;
  hours: string;
  distance: string;
  estimatedTotal: number;
  itemPrices: StoreItemPrice[];
}

export interface StoreItemPrice {
  itemName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  confidence: 'crowd_sourced' | 'ai_estimate';
}

// ============ Shopping History ============
export interface ShoppingHistory {
  id: string;
  storeName: string;
  storeLocation: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  shoppingDate: string;
  itemsPickedUp: any[];
  itemsOutOfStock: any[];
  itemsTooExpensive: any[];
  receiptUrls: string[];
  notes: string | null;
  createdAt: string;
}

export interface ReceiptOcrResult {
  storeName: string | null;
  storeAddress: string | null;
  date: string | null;
  items: { itemName: string; price: number; quantity: number }[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  receiptUrl: string;
  pricesSubmitted: number;
}

// ============ Shopping Session ============
export interface ShoppingSession {
  id: string;
  selectedStore: StoreResult | null;
  storeResults: StoreResult[];
  itemStatuses: Record<string, ShoppingItemStatus>;
  itemPrices: Record<string, number>;
  sessionDate: string;
  completed: boolean;
}

// ============ Pricing ============
export interface PriceEstimate {
  price: number | null;
  confidence: 'high' | 'medium' | 'low' | 'ai_estimate';
  submissionCount: number;
  source: 'crowd_sourced' | 'ai_estimate';
}

// ============ Pantry ============
export interface PantryItem {
  id: string;
  userId: string;
  itemName: string;
  category: string | null;
  quantity: string | null;
  unit: string | null;
  expiresAt: string | null;
  purchasedAt: string | null;
  notes: string | null;
  lowStockAlert: boolean;
  createdAt: string;
  updatedAt: string;
  isExpiringSoon?: boolean;
  isExpired?: boolean;
}

// ============ Recipes ============
export interface RecipeIngredient {
  name: string;
  measure: string;
}

export interface Recipe {
  id?: string;
  externalId: string | null;
  source: string;
  name: string;
  category: string | null;
  cuisine: string | null;
  instructions: string | null;
  thumbnail: string | null;
  ingredients: RecipeIngredient[];
  tags: string[];
  createdAt?: string;
}

// ============ Shopping List Groups ============
export interface ShoppingListGroup {
  id: string;
  userId: string;
  name: string;
  storeName: string | null;
  storeAddress: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
}

// ============ Store Recommendation ============
export interface StoreRecommendation {
  storeName: string;
  estimatedTotal: number;
  itemsCovered: number;
  coveragePct: number;
  avgConfidence: number | null;
  dataPoints: number;
}

// ============ Reorder Suggestion ============
export interface ReorderSuggestion {
  itemName: string;
  category: string | null;
  purchaseCount: number;
  lastPurchased: string;
  daysSinceLastPurchase: number;
}

// ============ Activity Log ============
export interface ActivityLogEntry {
  id: string;
  entityType: string;
  entityId: string | null;
  action: string;
  performedBy: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  profileId: string | null;
  profile: { id: string; name: string; petType: string | null } | null;
}

// ============ Household ============
export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string | null;
  inviteEmail: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  inviteStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  permissions: Record<string, boolean> | null;
  createdAt: string;
  user: { id: string; email: string; fullName: string } | null;
}

export interface Household {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  members: HouseholdMember[];
}

export interface HouseholdPermissions {
  dashboard: boolean;
  profiles: boolean;
  mealPlan: boolean;
  shopping: boolean;
  budget: boolean;
  recommendations: boolean;
  pantry: boolean;
  settings: boolean;
}

