import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { walletApi, Beneficiary } from '../../../utils/api';
import { useAuth } from './AuthContext';

export type TransactionType = 'deposit' | 'withdrawal' | 'transfer_sent' | 'transfer_received';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  fee: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  reference: string;
  method: string;
  methodIcon: string;
  recipient?: string;
  sender?: string;
  phone?: string;
  createdAt: string;
  completedAt?: string;
}

export interface WalletStats {
  balance: number;
  totalSent: number;
  totalReceived: number;
  totalDeposits: number;
  totalWithdrawals: number;
  countSent: number;
  countReceived: number;
  countDeposits: number;
  countWithdrawals: number;
}

interface WalletContextType {
  stats: WalletStats;
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  addDeposit: (amount: number, method: string, methodIcon: string, phone: string, reference: string, fee: number) => Promise<void>;
  addWithdrawal: (amount: number, method: string, methodIcon: string, phone: string, reference: string, fee: number) => Promise<void>;
  addTransfer: (amount: number, recipient: string, method: string, methodIcon: string, phone: string, reference: string, fee: number, pin?: string) => Promise<void>;
  confirmTransaction: (transactionId: string) => Promise<void>;
  checkBalance: (amount: number, fee?: number) => Promise<boolean>;
  refreshWallet: () => Promise<void>;
  getTransactionStatus: (transactionId: string) => Promise<{ status: string; failureReason?: string }>;

  // NEW — Bénéficiaires
  beneficiaries: Beneficiary[];
  beneficiariesLoading: boolean;
  refreshBeneficiaries: () => Promise<void>;
  createBeneficiary: (data: { email: string; name?: string; phone?: string }) => Promise<Beneficiary>;
  deleteBeneficiary: (id: string) => Promise<void>;
  touchBeneficiary: (id: string) => Promise<void>;
  verifyRecipient: (email: string) => Promise<{ found: boolean; name?: string; reason?: string }>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const INITIAL_STATS: WalletStats = {
  balance: 0, totalSent: 0, totalReceived: 0,
  totalDeposits: 0, totalWithdrawals: 0,
  countSent: 0, countReceived: 0, countDeposits: 0, countWithdrawals: 0,
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [stats, setStats] = useState<WalletStats>(INITIAL_STATS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [beneficiariesLoading, setBeneficiariesLoading] = useState(false);

  const loadWalletData = async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await walletApi.getWallet();
      setStats(data.stats || INITIAL_STATS);
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error('Failed to load wallet from backend:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement du portefeuille');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshBeneficiaries = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setBeneficiariesLoading(true);
      const list = await walletApi.getBeneficiaries();
      setBeneficiaries(list);
    } catch (err) {
      console.error('Failed to load beneficiaries:', err);
    } finally {
      setBeneficiariesLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadWalletData();
      refreshBeneficiaries();
    } else {
      setStats(INITIAL_STATS);
      setTransactions([]);
      setBeneficiaries([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  const addDeposit = async (amount: number, method: string, methodIcon: string, phone: string, reference: string, fee: number) => {
    try {
      setError(null);
      const result = await walletApi.createDeposit({ amount, method, methodIcon, phone, reference, fee });
      setTransactions(prev => [result.transaction, ...prev]);
    } catch (err) {
      console.error('Failed to create deposit:', err);
      setError(err instanceof Error ? err.message : 'Échec de la création du dépôt');
      throw err;
    }
  };

  const addWithdrawal = async (amount: number, method: string, methodIcon: string, phone: string, reference: string, fee: number) => {
    try {
      setError(null);
      const result = await walletApi.createWithdrawal({ amount, method, methodIcon, phone, reference, fee });
      setTransactions(prev => [result.transaction, ...prev]);
    } catch (err) {
      console.error('Failed to create withdrawal:', err);
      setError(err instanceof Error ? err.message : 'Échec de la création du retrait');
      throw err;
    }
  };

  const addTransfer = async (amount: number, recipient: string, method: string, methodIcon: string, phone: string, reference: string, fee: number, pin?: string) => {
    try {
      setError(null);
      const result = await walletApi.createTransfer({ amount, recipient, method, methodIcon, phone, reference, fee, pin });
      setTransactions(prev => [result.transaction, ...prev]);
    } catch (err) {
      console.error('Failed to create transfer:', err);
      setError(err instanceof Error ? err.message : 'Échec de la création du transfert');
      throw err;
    }
  };

  const confirmTransaction = async (transactionId: string) => {
    try {
      setError(null);
      const result = await walletApi.confirmTransaction(transactionId);
      setStats(result.wallet);
      setTransactions(prev => prev.map(t => (t.id === transactionId ? result.transaction : t)));
    } catch (err) {
      console.error('Failed to confirm transaction:', err);
      setError('Échec de la confirmation de la transaction');
      throw err;
    }
  };

  const checkBalance = async (amount: number, fee: number = 0): Promise<boolean> => {
    try {
      const result = await walletApi.checkBalance({ amount, fee });
      return result.hasSufficientBalance;
    } catch (err) {
      console.error('Failed to check balance:', err);
      return stats.balance >= amount + fee;
    }
  };

  const refreshWallet = async () => {
    await loadWalletData();
  };

  // NEW — Bénéficiaires
  const createBeneficiary = async (data: { email: string; name?: string; phone?: string }) => {
    const b = await walletApi.createBeneficiary(data);
    setBeneficiaries(prev => [b, ...prev]);
    return b;
  };

  const deleteBeneficiary = async (id: string) => {
    await walletApi.deleteBeneficiary(id);
    setBeneficiaries(prev => prev.filter(b => b.id !== id));
  };

  const touchBeneficiary = async (id: string) => {
    await walletApi.touchBeneficiary(id);
    setBeneficiaries(prev =>
      prev.map(b => (b.id === id ? { ...b, lastUsedAt: new Date().toISOString() } : b))
    );
  };

  const verifyRecipient = (email: string) => walletApi.verifyRecipient(email);

  return (
    <WalletContext.Provider
      value={{
        stats, transactions, isLoading, error,
        addDeposit, addWithdrawal, addTransfer, confirmTransaction,
        checkBalance, refreshWallet,
        getTransactionStatus: (id) => walletApi.getTransactionStatus(id),
        beneficiaries, beneficiariesLoading, refreshBeneficiaries,
        createBeneficiary, deleteBeneficiary, touchBeneficiary, verifyRecipient,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}