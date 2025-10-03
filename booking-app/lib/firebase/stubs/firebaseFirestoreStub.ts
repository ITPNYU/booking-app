export type Firestore = Record<string, unknown>;
export type QueryConstraint = Record<string, unknown>;

export class Timestamp {
  constructor(private readonly date: Date = new Date()) {}
  static now() {
    return new Timestamp();
  }
  toDate() {
    return this.date;
  }
}

const createRef = (...parts: unknown[]) => ({ parts });

export const initializeFirestore = (_app: unknown, _options?: unknown, _dbName?: unknown): Firestore => ({ initialized: true });
export const collection = (...args: unknown[]) => createRef(...args);
export const doc = (...args: unknown[]) => createRef(...args);
export const addDoc = async () => ({ id: 'mock-doc-id' });
export const setDoc = async () => {};
export const updateDoc = async () => {};
export const deleteDoc = async () => {};
export const getDoc = async () => ({ exists: () => false, data: () => ({}) });
export const getDocs = async () => ({ docs: [] });
export const query = (...args: unknown[]) => ({ args });
export const where = (...args: unknown[]) => ({ args });
export const orderBy = (...args: unknown[]) => ({ args });
export const limit = (value: unknown) => ({ value });
export const startAfter = (...args: unknown[]) => ({ args });
