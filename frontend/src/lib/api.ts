import type { AuthResponse, User, UserPreferences, Profile, ProfileFormData, Recommendation, MealPlan, CustomMeal, ShoppingItem, ShoppingHistory, ShoppingSession, StoreResult, ReceiptOcrResult, ActivityLogEntry, Household, HouseholdMember, DataExportStatus } from '@/types';

const API_BASE = '/api';

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onUnauthorized?: () => void;

  setTokens(access: string, refresh: string) {
    this.accessToken = access;
    this.refreshToken = refresh;
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }

  loadTokens() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  onAuthFailure(callback: () => void) {
    this.onUnauthorized = callback;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401 && this.refreshToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        res = await fetch(`${API_BASE}${path}`, { ...options, headers });
      }
    }

    if (res.status === 401) {
      this.clearTokens();
      this.onUnauthorized?.();
      throw new Error('Session expired');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(body.error || body.message || `Request failed (${res.status})`);
    }

    return res.json();
  }

  private async requestFormData<T>(path: string, form: FormData): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    let res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: form });
    if (res.status === 401 && this.refreshToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: form });
      }
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(body.error || `Upload failed (${res.status})`);
    }
    return res.json();
  }

  private async tryRefresh(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  // === Auth ===
  register(email: string, password: string, fullName: string) {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password, fullName }),
    });
  }
  login(email: string, password: string) {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
  }
  logout() {
    return this.request('/auth/logout', {
      method: 'POST', body: JSON.stringify({ refreshToken: this.refreshToken }),
    });
  }
  forgotPassword(email: string) {
    return this.request('/auth/forgot-password', {
      method: 'POST', body: JSON.stringify({ email }),
    });
  }
  resetPassword(token: string, password: string) {
    return this.request('/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ token, password }),
    });
  }

  // === Users ===
  getMe() { return this.request<User>('/users/me'); }
  updateMe(data: Partial<User>) {
    return this.request<User>('/users/me', { method: 'PUT', body: JSON.stringify(data) });
  }
  getPreferences() { return this.request<UserPreferences>('/users/me/preferences'); }
  updatePreferences(data: Partial<UserPreferences>) {
    return this.request<UserPreferences>('/users/me/preferences', {
      method: 'PUT', body: JSON.stringify(data),
    });
  }
  sendTestNotificationEmail() {
    return this.request<{ success: boolean }>('/users/me/preferences/test-email', {
      method: 'POST',
    });
  }
  requestEmailVerification() {
    return this.request<{ sent: boolean }>('/users/me/preferences/request-email-verification', {
      method: 'POST',
    });
  }
  verifyEmailCode(code: string) {
    return this.request<{ success: boolean; preferences: UserPreferences }>('/users/me/preferences/verify-email-code', {
      method: 'POST', body: JSON.stringify({ code }),
    });
  }

  // === Profiles ===
  getProfiles() { return this.request<Profile[]>('/profiles'); }
  getProfile(id: string) { return this.request<Profile>(`/profiles/${id}`); }
  createProfile(data: ProfileFormData) {
    return this.request<Profile>('/profiles', { method: 'POST', body: JSON.stringify(data) });
  }
  updateProfile(id: string, data: Partial<ProfileFormData>) {
    return this.request<Profile>(`/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  deleteProfile(id: string) {
    return this.request(`/profiles/${id}`, { method: 'DELETE' });
  }

  // === Recommendations ===
  getRecommendations(profileId?: string) {
    const query = profileId ? `?profileId=${profileId}` : '';
    return this.request<Recommendation[]>(`/recommendations${query}`);
  }
  generateRecommendations(profileIds: string[], categories: string[]) {
    return this.request<Recommendation[]>('/recommendations/generate', {
      method: 'POST', body: JSON.stringify({ profileIds, categories }),
    });
  }
  updateRecommendation(id: string, data: Partial<Recommendation>) {
    return this.request<Recommendation>(`/recommendations/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    });
  }
  deleteRecommendation(id: string) {
    return this.request(`/recommendations/${id}`, { method: 'DELETE' });
  }

  // === Meal Plans ===
  getMealPlans(params?: { profileId?: string; startDate?: string; endDate?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<MealPlan[]>(`/meal-plan${query ? `?${query}` : ''}`);
  }
  createMealPlan(data: Partial<MealPlan>) {
    return this.request<MealPlan>('/meal-plan', { method: 'POST', body: JSON.stringify(data) });
  }
  generateMealPlan(profileIds: string[], date: string, mealTypes: string[], days: number = 7, dietaryGoals?: string) {
    return this.request<MealPlan[]>('/meal-plan/generate', {
      method: 'POST', body: JSON.stringify({ profileIds, date, mealTypes, days, dietaryGoals }),
    });
  }
  // T67: SSE streaming meal plan generation
  async *generateMealPlanStream(profileIds: string[], date: string, mealTypes: string[], days: number = 7, dietaryGoals?: string): AsyncGenerator<{ meal?: MealPlan; done: boolean; error?: string; total?: number }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    const res = await fetch(`${API_BASE}/meal-plan/generate-stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ profileIds, date, mealTypes, days, dietaryGoals }),
    });
    if (!res.ok || !res.body) throw new Error('Stream failed');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const line = part.trim();
        if (line.startsWith('data: ')) {
          try { yield JSON.parse(line.slice(6)); } catch { /* skip malformed */ }
        }
      }
    }
  }
  updateMealPlan(id: string, data: Partial<MealPlan>) {
    return this.request<MealPlan>(`/meal-plan/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  deleteMealPlan(id: string) {
    return this.request(`/meal-plan/${id}`, { method: 'DELETE' });
  }
  regenerateMealPlan(id: string, dietaryGoals?: string) {
    return this.request<MealPlan>(`/meal-plan/${id}/regenerate`, {
      method: 'POST', body: JSON.stringify({ dietaryGoals }),
    });
  }
  getCustomMeals() {
    return this.request<CustomMeal[]>('/meal-plan/custom-meals');
  }
  createCustomMeal(data: Partial<CustomMeal> & { skipDuplicateCheck?: boolean }) {
    return this.request<CustomMeal>('/meal-plan/custom-meals', { method: 'POST', body: JSON.stringify(data) });
  }
  updateCustomMeal(id: string, data: Partial<CustomMeal>) {
    return this.request<CustomMeal>(`/meal-plan/custom-meals/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  deleteCustomMeal(id: string) {
    return this.request(`/meal-plan/custom-meals/${id}`, { method: 'DELETE' });
  }
  syncMealsToLibrary(meals: Array<{ name: string; mealType: string; ingredients: string[]; preparationNotes?: string | null; calories?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null; fiber?: number | null; servings?: number | null }>) {
    return this.request<{ synced: number; skipped: number }>('/meal-plan/custom-meals/sync-from-plan', {
      method: 'POST',
      body: JSON.stringify({ meals }),
    });
  }
  annotateIngredientScaling(id: string) {
    return this.request<{ ingredientScaling: Record<string, 'proportional' | 'moderate' | 'fixed'> }>(`/meal-plan/custom-meals/${id}/annotate-scaling`, { method: 'POST' });
  }
  estimateMealCalories(ingredients: string[], servings: number) {
    return this.request<{ calories: number | null }>('/meal-plan/estimate-calories', {
      method: 'POST',
      body: JSON.stringify({ ingredients, servings }),
    });
  }
  estimateMealMacros(mealName: string) {
    return this.request<{ calories: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null }>('/meal-plan/estimate-macros', {
      method: 'POST',
      body: JSON.stringify({ mealName }),
    });
  }

  // === Shopping ===
  getShoppingList() { return this.request<ShoppingItem[]>('/shopping/list'); }
  addShoppingItem(data: Partial<ShoppingItem>) {
    return this.request<ShoppingItem>('/shopping/list', { method: 'POST', body: JSON.stringify(data) });
  }
  updateShoppingItem(id: string, data: Partial<ShoppingItem>) {
    return this.request<ShoppingItem>(`/shopping/list/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    });
  }
  deleteShoppingItem(id: string) {
    return this.request(`/shopping/list/${id}`, { method: 'DELETE' });
  }
  generateShoppingFromMeals(profileIds: string[], days: number) {
    return this.request<ShoppingItem[]>('/shopping/generate-from-meals', {
      method: 'POST', body: JSON.stringify({ profileIds, days }),
    });
  }
  findStores(zipCode: string) {
    return this.request<StoreResult[]>('/shopping/find-stores', {
      method: 'POST', body: JSON.stringify({ zipCode }),
    });
  }  findStoresByZip(zip: string) {
    return this.request<{ name: string; address: string }[]>(`/shopping/stores-by-zip?zip=${encodeURIComponent(zip)}`);
  }  searchPreferredStores(q: string) {
    return this.request<{ name: string; address: string }[]>(`/shopping/search-stores?q=${encodeURIComponent(q)}`);
  }

  // === Shopping Sessions ===
  startShoppingSession(storeName?: string) {
    return this.request<ShoppingSession & { items: any[]; storeName: string }>('/shopping/session', {
      method: 'POST', body: JSON.stringify({ storeName }),
    });
  }
  getShoppingSession(sessionId: string) {
    return this.request<ShoppingSession & { items: any[]; storeName: string }>(`/shopping/session/${sessionId}`);
  }
  updateSessionItem(sessionId: string, itemId: string, data: { status?: string }) {
    return this.request(`/shopping/session/${sessionId}/items/${itemId}`, {
      method: 'PUT', body: JSON.stringify(data),
    });
  }
  submitSessionPrice(sessionId: string, itemId: string, price: number) {
    return this.request(`/shopping/session/${sessionId}/items/${itemId}/price`, {
      method: 'POST', body: JSON.stringify({ price }),
    });
  }
  submitSessionAisle(sessionId: string, itemId: string, aisle: string) {
    return this.request(`/shopping/session/${sessionId}/items/${itemId}/aisle`, {
      method: 'POST', body: JSON.stringify({ aisle }),
    });
  }
  endShoppingSession(sessionId: string, durationSeconds?: number) {
    return this.request<ShoppingHistory>(`/shopping/session/${sessionId}/end`, {
      method: 'POST',
      body: JSON.stringify({ durationSeconds }),
    });
  }
  cancelShoppingSession(sessionId: string) {
    return this.request(`/shopping/session/${sessionId}/cancel`, { method: 'POST' });
  }
  removeShoppingItem(id: string) {
    return this.request(`/shopping/list/${id}`, { method: 'DELETE' });
  }
  addRecommendationToList(data: { itemName: string; category?: string; ingredients?: string[]; priority?: string; notes?: string }) {
    return this.request<ShoppingItem>('/shopping/list', { method: 'POST', body: JSON.stringify(data) });
  }
  addIngredientsToList(data: { ingredients: string[]; mealName: string; mealDate?: string; profileId?: string; category?: string; servings?: number }) {
    return this.request<ShoppingItem[]>('/shopping/add-ingredients', { method: 'POST', body: JSON.stringify(data) });
  }

  // === Shopping History ===
  getShoppingHistory() { return this.request<ShoppingHistory[]>('/shopping/history'); }
  createShoppingHistory(data: Partial<ShoppingHistory>) {
    return this.request<ShoppingHistory>('/shopping/history', {
      method: 'POST', body: JSON.stringify(data),
    });
  }
  deleteShoppingHistory(id: string) {
    return this.request(`/shopping/history/${id}`, { method: 'DELETE' });
  }

  async uploadReceipts(historyId: string, files: FileList | File[]): Promise<ShoppingHistory> {
    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append('receipts', file);
    }

    const doUpload = async () => {
      const headers: Record<string, string> = {};
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }
      return fetch(`${API_BASE}/shopping/history/${historyId}/receipts`, {
        method: 'POST',
        headers,
        body: formData,
      });
    };

    let res = await doUpload();

    // Handle token refresh for expired sessions
    if (res.status === 401 && this.refreshToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        res = await doUpload();
      }
    }

    if (res.status === 401) {
      this.clearTokens();
      this.onUnauthorized?.();
      throw new Error('Session expired');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(body.error || body.message || `Upload failed (${res.status})`);
    }

    return res.json();
  }

  async scanReceipt(historyId: string, file: File): Promise<ReceiptOcrResult> {
    const formData = new FormData();
    formData.append('receipt', file);

    const doUpload = async () => {
      const headers: Record<string, string> = {};
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }
      return fetch(`${API_BASE}/shopping/history/${historyId}/receipts/scan`, {
        method: 'POST',
        headers,
        body: formData,
      });
    };

    let res = await doUpload();

    if (res.status === 401 && this.refreshToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        res = await doUpload();
      }
    }

    if (res.status === 401) {
      this.clearTokens();
      this.onUnauthorized?.();
      throw new Error('Session expired');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Scan failed' }));
      throw new Error(body.error || body.message || `Scan failed (${res.status})`);
    }

    return res.json();
  }

  // === Pricing ===
  submitPrice(data: { itemName: string; storeName: string; zipRegion: string; actualPrice: number }) {
    return this.request('/pricing/submit', { method: 'POST', body: JSON.stringify(data) });
  }
  getPriceEstimate(itemName: string, storeName?: string, zipRegion?: string) {
    const params = new URLSearchParams({ itemName });
    if (storeName) params.set('storeName', storeName);
    if (zipRegion) params.set('zipRegion', zipRegion);
    return this.request<{ estimatedPrice: number | null; source?: string }>(`/pricing/estimate?${params}`);
  }
  predictAisleLocation(itemName: string, storeName: string, zipRegion?: string) {
    return this.request<{ aisle: string | null; source?: string }>('/aisles/predict', {
      method: 'POST', body: JSON.stringify({ itemName, storeName, zipRegion: zipRegion ?? '' }),
    });
  }

  // === Support ===
  reportIssue(data: { description: string; workflow?: string; route?: string; metadata?: Record<string, unknown> }) {
    return this.request<{ success: boolean; message: string }>('/support/report', {
      method: 'POST', body: JSON.stringify(data),
    });
  }
  submitFeedback(data: { type: 'feature' | 'improvement' | 'general'; subject: string; description: string }) {
    return this.request<{ success: boolean; message: string }>('/support/feedback', {
      method: 'POST', body: JSON.stringify(data),
    });
  }

  // === Macros ===
  getMacros(date?: string, profileId?: string) {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (profileId) params.set('profileId', profileId);
    const q = params.toString() ? `?${params}` : '';
    return this.request<{ logs: any[]; totals: any; date: string }>(`/macros${q}`);
  }
  getMacroSummary(days = 7) {
    return this.request<{ summary: Record<string, any>; days: number }>(`/macros/summary?days=${days}`);
  }
  logMacro(data: { date?: string; mealName: string; calories?: number; protein?: number; carbs?: number; fat?: number; fiber?: number; notes?: string; profileId?: string }) {
    return this.request<any>('/macros', { method: 'POST', body: JSON.stringify(data) });
  }
  updateMacro(id: string, data: Partial<{ mealName: string; calories: number; protein: number; carbs: number; fat: number; fiber: number; notes: string }>) {
    return this.request<any>(`/macros/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  deleteMacro(id: string) {
    return this.request(`/macros/${id}`, { method: 'DELETE' });
  }

  // === Share ===
  createShareLink() {
    return this.request<{ token: string; url: string; expiresAt: string }>('/share', { method: 'POST' });
  }
  getShareSnapshot(token: string) {
    return this.request<{ snapshot: any[]; createdAt: string; expiresAt: string }>(`/share/${token}`);
  }

  // === Push Notifications ===
  getVapidPublicKey() {
    return this.request<{ configured: boolean; publicKey: string | null }>('/push/vapid-public-key');
  }
  subscribePush(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    return this.request<{ success: boolean }>('/push/subscribe', {
      method: 'POST', body: JSON.stringify(subscription),
    });
  }
  unsubscribePush(endpoint: string) {
    return this.request('/push/subscribe', {
      method: 'DELETE', body: JSON.stringify({ endpoint }),
    });
  }

  // === Kroger / Aisle Seeding ===
  seedAislesFromKroger(data: { zipCode: string; storeName: string }) {
    return this.request<{ seeded: number; items: string[]; message?: string }>('/aisles/seed-kroger', {
      method: 'POST', body: JSON.stringify(data),
    });
  }
  getKrogerStores(zipCode: string) {
    return this.request<any[]>(`/aisles/kroger-stores?zipCode=${zipCode}`);
  }
  // T70: Live Kroger product search
  getKrogerProducts(storeName: string, zipCode: string, itemName: string) {
    return this.request<{
      supported: boolean;
      reason?: string;
      locationId?: string | null;
      products?: Array<{ productId: string; name: string; brand: string; aisleLocation: string | null; upc: string }>;
    }>(`/shopping/kroger-products?storeName=${encodeURIComponent(storeName)}&zipCode=${encodeURIComponent(zipCode)}&itemName=${encodeURIComponent(itemName)}`);
  }

  // === Session add-item ===
  addItemToSession(sessionId: string, data: { itemName: string; quantity?: string; category?: string; notes?: string }) {
    return this.request<any>(`/shopping/session/${sessionId}/add-item`, {
      method: 'POST', body: JSON.stringify(data),
    });
  }

  // === Account ===
  changePassword(currentPassword: string, newPassword: string) {
    return this.request('/users/me/password', {
      method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }),
    });
  }
  requestEmailChange(newEmail: string) {
    return this.request<{ sent: boolean }>('/users/me/change-email-request', {
      method: 'POST', body: JSON.stringify({ newEmail }),
    });
  }
  confirmEmailChange(code: string) {
    return this.request<{ success: boolean; email: string }>('/users/me/change-email-confirm', {
      method: 'POST', body: JSON.stringify({ code }),
    });
  }
  exportData() {
    return this.request<any>('/users/me/export');
  }
  deleteAccount() {
    return this.request('/users/me', { method: 'DELETE' });
  }

  // === Budget Reset ===
  resetBudget() {
    return this.request<{ budgetLastResetAt: string }>('/users/me/preferences/budget/reset', { method: 'POST' });
  }

  // === Pantry ===
  getPantryItems() {
    return this.request<any[]>('/pantry');
  }
  getExpiringPantryItems(days = 3) {
    return this.request<any[]>(`/pantry/expiring?days=${days}`);
  }
  checkPantryForItems(itemNames: string[]) {
    return this.request<{ itemName: string; inPantry: boolean }[]>('/pantry/check', {
      method: 'POST', body: JSON.stringify({ itemNames }),
    });
  }
  addPantryItem(data: {
    itemName: string; category?: string; quantity?: string; unit?: string;
    expiresAt?: string; purchasedAt?: string; notes?: string; lowStockAlert?: boolean;
  }) {
    return this.request<any>('/pantry', { method: 'POST', body: JSON.stringify(data) });
  }
  updatePantryItem(id: string, data: Partial<{
    itemName: string; category: string; quantity: string; unit: string;
    expiresAt: string | null; purchasedAt: string; notes: string; lowStockAlert: boolean;
  }>) {
    return this.request<any>(`/pantry/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  deletePantryItem(id: string) {
    return this.request<{ success: boolean }>(`/pantry/${id}`, { method: 'DELETE' });
  }

  // === Recipes ===
  searchRecipes(q: string) {
    return this.request<any[]>(`/recipes/search?q=${encodeURIComponent(q)}`);
  }
  getRecipeCategories() {
    return this.request<string[]>('/recipes/categories');
  }
  getRecipesByCategory(category: string) {
    return this.request<any[]>(`/recipes/by-category/${encodeURIComponent(category)}`);
  }
  getRecipe(id: string) {
    return this.request<any>(`/recipes/${id}`);
  }
  generateRecipeInstructions(data: { name: string; ingredients: string[]; mealType?: string; servings?: number }) {
    return this.request<{ steps: string[]; prepTime: number; cookTime: number; tips: string[] }>(
      '/recipes/generate-instructions', { method: 'POST', body: JSON.stringify(data) }
    );
  }
  uploadRecipePhoto(mealId: string, file: File) {
    const form = new FormData();
    form.append('photo', file);
    form.append('mealId', mealId);
    return this.requestFormData<{ photoUrl: string }>('/recipes/photo-upload', form);
  }
  uploadRecipePhotoOnly(file: File) {
    const form = new FormData();
    form.append('photo', file);
    return this.requestFormData<{ photoUrl: string }>('/recipes/photo-upload', form);
  }
  scanRecipeFromPhoto(file: File) {
    const form = new FormData();
    form.append('photo', file);
    return this.requestFormData<{
      name: string | null; mealType: string | null; ingredients: string[];
      preparationNotes: string | null; servings: number | null;
      prepTime: number | null; calories: number | null; tags: string[];
    }>('/recipes/scan', form);
  }
  checkRecipeDuplicate(name: string) {
    return this.request<{ isDuplicate: boolean; existing: { id: string; name: string; mealType: string; createdAt: string } | null }>(
      '/recipes/check-duplicate', { method: 'POST', body: JSON.stringify({ name }) }
    );
  }
  addRecipeToList(id: string, data: { servings?: number; listGroupId?: string }) {
    return this.request<{ added: number; recipeName: string; message: string }>(
      `/recipes/${id}/add-to-list`, { method: 'POST', body: JSON.stringify(data) }
    );
  }

  // === Shopping List Groups ===
  getShoppingGroups() {
    return this.request<any[]>('/shopping-groups');
  }
  createShoppingGroup(data: { name: string; storeName?: string; storeAddress?: string; isDefault?: boolean }) {
    return this.request<any>('/shopping-groups', { method: 'POST', body: JSON.stringify(data) });
  }
  updateShoppingGroup(id: string, data: Partial<{ name: string; storeName: string; storeAddress: string; isDefault: boolean }>) {
    return this.request<any>(`/shopping-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  deleteShoppingGroup(id: string) {
    return this.request<{ success: boolean }>(`/shopping-groups/${id}`, { method: 'DELETE' });
  }
  getGroupItems(id: string) {
    return this.request<any[]>(`/shopping-groups/${id}/items`);
  }
  moveItemToGroup(itemId: string, listGroupId: string | null) {
    return this.request<any>(`/shopping-groups/items/${itemId}/move`, {
      method: 'PUT', body: JSON.stringify({ listGroupId }),
    });
  }
  getStoreRecommendations(zipCode: string, listGroupId?: string) {
    const q = listGroupId ? `&listGroupId=${listGroupId}` : '';
    return this.request<{ recommendations: any[]; itemCount: number }>(
      `/shopping-groups/recommend-store?zipCode=${zipCode}${q}`
    );
  }

  // === Reorder Suggestions ===
  getReorderSuggestions() {
    return this.request<any[]>('/shopping/reorder-suggestions');
  }

  // === Profile Avatar Upload ===
  uploadProfileAvatar(profileId: string, file: File) {
    const form = new FormData();
    form.append('avatar', file);
    return this.requestFormData<{ avatarUrl: string }>(`/profiles/${profileId}/avatar`, form);
  }

  // === Activity Log ===
  getActivity(params?: { profileId?: string; entityType?: string; from?: string; to?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.profileId) qs.set('profileId', params.profileId);
    if (params?.entityType) qs.set('entityType', params.entityType);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return this.request<ActivityLogEntry[]>(`/activity${query ? `?${query}` : ''}`);
  }

  // === Household ===
  getHousehold() {
    return this.request<Household | null>('/household');
  }
  createHousehold(name?: string) {
    return this.request<Household>('/household', { method: 'POST', body: JSON.stringify({ name }) });
  }
  inviteHouseholdMember(email: string, role: 'ADMIN' | 'MEMBER' = 'MEMBER') {
    return this.request<HouseholdMember & { inviteUrl: string }>('/household/invite', { method: 'POST', body: JSON.stringify({ email, role }) });
  }
  removeHouseholdMember(memberId: string) {
    return this.request(`/household/members/${memberId}`, { method: 'DELETE' });
  }
  updateMemberPermissions(memberId: string, permissions: Record<string, boolean>) {
    return this.request(`/household/members/${memberId}/permissions`, { method: 'PATCH', body: JSON.stringify({ permissions }) });
  }
  acceptHouseholdInvite(token: string) {
    return this.request<{ householdId: string }>('/household/accept', { method: 'POST', body: JSON.stringify({ token }) });
  }
  getHouseholdInvitePreview(token: string) {
    return this.request<{ householdName: string; ownerName: string; inviteEmail: string; role: string; status: string }>(`/household/invite/preview?token=${encodeURIComponent(token)}`);
  }
  getMyHouseholdPermissions() {
    return this.request<{ permissions: Record<string, boolean>; role: string; householdId: string } | null>('/household/permissions');
  }

  // ── Data Export (T58-T63) ──
  requestDataExport(reason: string) {
    return this.request<{ ok: boolean }>('/data-export/request', { method: 'POST', body: JSON.stringify({ reason }) });
  }
  verifyDataExportCode(code: string) {
    return this.request<{ ok: boolean }>('/data-export/verify', { method: 'POST', body: JSON.stringify({ code }) });
  }
  getDataExportStatus() {
    return this.request<DataExportStatus>('/data-export/status');
  }
  reportStoreAddress(storeName: string, currentAddress: string, correction: string, notes?: string) {
    return this.request<{ ok: boolean; id: string }>('/store-corrections', {
      method: 'POST',
      body: JSON.stringify({ storeName, currentAddress, correction, notes }),
    });
  }

  // === Notifications ===
  getNotifications(unreadOnly = false) {
    return this.request<{ notifications: any[]; unreadCount: number }>(`/notifications${unreadOnly ? '?unreadOnly=true' : ''}`);
  }
  getNotificationCount() {
    return this.request<{ count: number }>('/notifications/count');
  }
  markNotificationsRead(ids: string[]) {
    return this.request('/notifications/read', { method: 'PATCH', body: JSON.stringify({ ids }) });
  }
  markAllNotificationsRead() {
    return this.request('/notifications/read-all', { method: 'PATCH' });
  }

  // === Family Suggestions ===
  getSuggestions() {
    return this.request<any[]>('/suggestions');
  }
  getMySuggestions() {
    return this.request<any[]>('/suggestions/mine');
  }
  createSuggestion(type: 'meal' | 'shopping_item', title: string, details?: string) {
    return this.request<any>('/suggestions', { method: 'POST', body: JSON.stringify({ type, title, details }) });
  }
  reviewSuggestion(id: string, status: 'APPROVED' | 'DENIED', adminNotes?: string) {
    return this.request<any>(`/suggestions/${id}`, { method: 'PATCH', body: JSON.stringify({ status, adminNotes }) });
  }
}

export const api = new ApiClient();
