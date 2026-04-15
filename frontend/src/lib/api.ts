import type { AuthResponse, User, UserPreferences, Profile, ProfileFormData, Recommendation, MealPlan, ShoppingItem, ShoppingHistory, ShoppingSession, StoreResult } from '@/types';

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
  generateMealPlan(profileIds: string[], date: string, mealTypes: string[], days: number = 7) {
    return this.request<MealPlan[]>('/meal-plan/generate', {
      method: 'POST', body: JSON.stringify({ profileIds, date, mealTypes, days }),
    });
  }
  updateMealPlan(id: string, data: Partial<MealPlan>) {
    return this.request<MealPlan>(`/meal-plan/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  deleteMealPlan(id: string) {
    return this.request(`/meal-plan/${id}`, { method: 'DELETE' });
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
  endShoppingSession(sessionId: string) {
    return this.request<ShoppingHistory>(`/shopping/session/${sessionId}/end`, { method: 'POST' });
  }
  removeShoppingItem(id: string) {
    return this.request(`/shopping/list/${id}`, { method: 'DELETE' });
  }
  addRecommendationToList(data: { itemName: string; category?: string; ingredients?: string[]; priority?: string; notes?: string }) {
    return this.request<ShoppingItem>('/shopping/list', { method: 'POST', body: JSON.stringify(data) });
  }
  addIngredientsToList(data: { ingredients: string[]; mealName: string; mealDate?: string; profileId?: string; category?: string }) {
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

    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const res = await fetch(`${API_BASE}/shopping/history/${historyId}/receipts`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(body.error || body.message || `Upload failed (${res.status})`);
    }

    return res.json();
  }

  // === Pricing ===
  submitPrice(data: { itemName: string; storeName: string; zipRegion: string; actualPrice: number }) {
    return this.request('/pricing/submit', { method: 'POST', body: JSON.stringify(data) });
  }

  // === Account ===
  changePassword(currentPassword: string, newPassword: string) {
    return this.request('/users/me/password', {
      method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }),
    });
  }
  exportData() {
    return this.request<any>('/users/me/export');
  }
  deleteAccount() {
    return this.request('/users/me', { method: 'DELETE' });
  }
}

export const api = new ApiClient();
