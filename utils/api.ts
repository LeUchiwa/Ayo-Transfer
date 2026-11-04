import { supabase } from './supabase/client';
import { projectId } from './supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/server`;

interface ApiOptions {
  method?: string;
  body?: any;
}

async function apiCall(endpoint: string, options: ApiOptions = {}) {
  const { method = 'GET', body } = options;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };

  const config: RequestInit = { method, headers };
  if (body && method !== 'GET') config.body = JSON.stringify(body);

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `API error: ${response.status}`);
  }

  return response.json();
}

export interface Beneficiary {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export const walletApi = {
  getWallet: () => apiCall('/wallet'),

  createDeposit: (data: {
    amount: number; method: string; methodIcon: string;
    phone: string; reference: string; fee: number;
  }) => apiCall('/wallet/deposit', { method: 'POST', body: data }),

  createWithdrawal: (data: {
    amount: number; method: string; methodIcon: string;
    phone: string; reference: string; fee: number;
  }) => apiCall('/wallet/withdraw', { method: 'POST', body: data }),

  createTransfer: (data: {
    amount: number; recipient: string; method: string; methodIcon: string;
    phone: string; reference: string; fee: number;
  }) => apiCall('/wallet/transfer', { method: 'POST', body: data }),

  confirmTransaction: (transactionId: string) =>
    apiCall(`/wallet/confirm/${transactionId}`, { method: 'POST' }),

  checkBalance: (data: { amount: number; fee?: number }) =>
    apiCall('/wallet/check-balance', { method: 'POST', body: data }),

  getTransactionStatus: (transactionId: string) =>
    apiCall(`/wallet/transaction/${transactionId}/status`),

  getNotifications: () => apiCall('/notifications'),
  getTransactions: () => apiCall('/transactions'),

  getDepositStatus: (id: string) => apiCall(`/wallet/deposit/${id}/status`),
  submitDepositInfo: (id: string, data: { txRef: string; screenshotUrl?: string }) =>
    apiCall(`/wallet/deposit/${id}/info`, { method: 'POST', body: data }),
  cancelExpiredDeposit: (id: string) =>
    apiCall(`/wallet/deposit/${id}/cancel-expired`, { method: 'POST' }),
  getServices: () => apiCall('/services'),

  // ═══ NEW — Bénéficiaires ═══

  verifyRecipient: async (email: string): Promise<{
    found: boolean;
    name?: string;
    reason?: "not_found" | "self" | "invalid_format" | "rate_limited";
  }> => {
    try {
      return await apiCall('/wallet/verify-recipient', { method: 'POST', body: { email } });
    } catch {
      // 429 ou autre → ne casse pas le debounce côté UI
      return { found: false, reason: 'rate_limited' };
    }
  },

  getBeneficiaries: async (): Promise<Beneficiary[]> => {
    const data = await apiCall('/beneficiaries');
    return data.beneficiaries ?? [];
  },

  createBeneficiary: async (data: { email: string; name?: string; phone?: string }): Promise<Beneficiary> => {
    const res = await apiCall('/beneficiaries', { method: 'POST', body: data });
    return res.beneficiary;
  },

  deleteBeneficiary: (id: string) =>
    apiCall(`/beneficiaries/${id}`, { method: 'DELETE' }),

  touchBeneficiary: (id: string) =>
    apiCall(`/beneficiaries/${id}/touch`, { method: 'POST' }),
};