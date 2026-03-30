import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// ─── Transaction CRUD ────────────────────────────────────────────────────────

export const addTransaction = async (uid: string, data: Record<string, unknown>) => {
  return addDoc(collection(db, 'users', uid, 'transactions'), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const getTransactions = async (uid: string): Promise<Record<string, unknown>[]> => {
  const q = query(collection(db, 'users', uid, 'transactions'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const subscribeTransactions = (
  uid: string,
  callback: (txns: Record<string, unknown>[]) => void
): Unsubscribe => {
  const q = query(collection(db, 'users', uid, 'transactions'), orderBy('date', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

export const deleteTransaction = async (uid: string, txId: string) => {
  return deleteDoc(doc(db, 'users', uid, 'transactions', txId));
};

// ─── Debt CRUD ───────────────────────────────────────────────────────────────

export const addDebt = async (uid: string, data: Record<string, unknown>) => {
  return addDoc(collection(db, 'users', uid, 'debts'), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const getDebts = async (uid: string): Promise<Record<string, unknown>[]> => {
  const snap = await getDocs(collection(db, 'users', uid, 'debts'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const subscribeDebts = (
  uid: string,
  callback: (debts: Record<string, unknown>[]) => void
): Unsubscribe => {
  return onSnapshot(collection(db, 'users', uid, 'debts'), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

export const updateDebt = async (uid: string, debtId: string, data: Record<string, unknown>) => {
  return updateDoc(doc(db, 'users', uid, 'debts', debtId), data);
};

export const deleteDebt = async (uid: string, debtId: string) => {
  return deleteDoc(doc(db, 'users', uid, 'debts', debtId));
};

// ─── Goal CRUD ───────────────────────────────────────────────────────────────

export const addGoal = async (uid: string, data: Record<string, unknown>) => {
  return addDoc(collection(db, 'users', uid, 'goals'), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const getGoals = async (uid: string): Promise<Record<string, unknown>[]> => {
  const snap = await getDocs(collection(db, 'users', uid, 'goals'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const subscribeGoals = (
  uid: string,
  callback: (goals: Record<string, unknown>[]) => void
): Unsubscribe => {
  return onSnapshot(collection(db, 'users', uid, 'goals'), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

export const updateGoal = async (uid: string, goalId: string, data: Record<string, unknown>) => {
  return updateDoc(doc(db, 'users', uid, 'goals', goalId), data);
};

// ─── Savings CRUD ────────────────────────────────────────────────────────────

export const addSaving = async (uid: string, data: Record<string, unknown>) => {
  return addDoc(collection(db, 'users', uid, 'savings'), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const getSavings = async (uid: string): Promise<Record<string, unknown>[]> => {
  const snap = await getDocs(collection(db, 'users', uid, 'savings'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const subscribeSavings = (
  uid: string,
  callback: (savings: Record<string, unknown>[]) => void
): Unsubscribe => {
  return onSnapshot(collection(db, 'users', uid, 'savings'), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

export const updateSaving = async (uid: string, savingId: string, data: Record<string, unknown>) => {
  return updateDoc(doc(db, 'users', uid, 'savings', savingId), data);
};

export const deleteSaving = async (uid: string, savingId: string) => {
  return deleteDoc(doc(db, 'users', uid, 'savings', savingId));
};
