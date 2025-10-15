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

type MockDocument = {
  id: string;
  data: Record<string, unknown>;
};

type MockCollections = Record<string, MockDocument[]>;

const mockCollections: MockCollections = {
  'mc-bookingTypes': [
    {
      id: 'general-event',
      data: {
        bookingType: 'General Event',
        description: 'Mock general booking type for tests',
        isActive: true,
      },
    },
    {
      id: 'class-session',
      data: {
        bookingType: 'Class Session',
        description: 'Mock class booking type for tests',
        isActive: true,
      },
    },
  ],
};

const makeDocSnapshot = (doc: MockDocument) => ({
  id: doc.id,
  data: () => ({ ...doc.data }),
  exists: () => true,
});

const resolveCollectionPath = (ref: any): string => {
  if (!ref) return '';
  if (ref.__type === 'query') {
    return resolveCollectionPath(ref.collectionRef);
  }
  if (ref.__type === 'collection') {
    return ref.path;
  }
  if (typeof ref === 'string') {
    return ref;
  }
  if (Array.isArray(ref.parts)) {
    const parts = ref.parts.filter((part) => typeof part === 'string');
    return parts[parts.length - 1] as string;
  }
  return '';
};

const resolveDocPath = (ref: any) => {
  if (ref?.__type === 'doc') {
    return { collectionPath: ref.pathParts.slice(0, -1).join('/'), docId: ref.pathParts.slice(-1)[0] };
  }
  if (Array.isArray(ref?.parts)) {
    const parts = ref.parts.filter((part) => typeof part === 'string');
    return { collectionPath: parts.slice(0, -1).join('/'), docId: parts.slice(-1)[0] };
  }
  return { collectionPath: '', docId: '' };
};

export const initializeFirestore = (_app: unknown, _options?: unknown, _dbName?: unknown): Firestore => ({ initialized: true });

export const collection = (_db: Firestore, collectionPath: string, ...rest: string[]) => ({
  __type: 'collection',
  path: [collectionPath, ...rest].filter(Boolean).join('/'),
});

export const doc = (_db: Firestore, collectionPath: string, docId: string) => ({
  __type: 'doc',
  pathParts: [collectionPath, docId],
});

export const addDoc = async (collectionRef: any, data: Record<string, unknown>) => {
  const path = resolveCollectionPath(collectionRef);
  const id = `mock-${Date.now()}`;
  const entry: MockDocument = { id, data };
  if (!mockCollections[path]) {
    mockCollections[path] = [];
  }
  mockCollections[path].push(entry);
  return { id };
};

export const setDoc = async (docRef: any, data: Record<string, unknown>) => {
  const { collectionPath, docId } = resolveDocPath(docRef);
  if (!collectionPath || !docId) return;
  if (!mockCollections[collectionPath]) {
    mockCollections[collectionPath] = [];
  }
  const existingIndex = mockCollections[collectionPath].findIndex((entry) => entry.id === docId);
  if (existingIndex >= 0) {
    mockCollections[collectionPath][existingIndex] = { id: docId, data };
  } else {
    mockCollections[collectionPath].push({ id: docId, data });
  }
};

export const updateDoc = async (docRef: any, data: Record<string, unknown>) => {
  const { collectionPath, docId } = resolveDocPath(docRef);
  if (!collectionPath || !docId || !mockCollections[collectionPath]) return;
  const entry = mockCollections[collectionPath].find((doc) => doc.id === docId);
  if (entry) {
    entry.data = { ...entry.data, ...data };
  }
};

export const deleteDoc = async (docRef: any) => {
  const { collectionPath, docId } = resolveDocPath(docRef);
  if (!collectionPath || !docId || !mockCollections[collectionPath]) return;
  mockCollections[collectionPath] = mockCollections[collectionPath].filter((doc) => doc.id !== docId);
};

export const getDoc = async (docRef: any) => {
  const { collectionPath, docId } = resolveDocPath(docRef);
  const entry = collectionPath && mockCollections[collectionPath]?.find((doc) => doc.id === docId);
  if (!entry) {
    return { exists: () => false, data: () => ({}) };
  }
  return {
    exists: () => true,
    data: () => ({ ...entry.data }),
  };
};

export const query = (collectionRef: any, ...constraints: QueryConstraint[]) => ({
  __type: 'query',
  collectionRef,
  constraints,
});

export const where = (...args: unknown[]) => ({ args });
export const orderBy = (...args: unknown[]) => ({ args });
export const limit = (value: unknown) => ({ value });
export const startAfter = (...args: unknown[]) => ({ args });

export const getDocs = async (queryOrCollection: any) => {
  const path = resolveCollectionPath(queryOrCollection);
  const docs = (mockCollections[path] ?? []).map(makeDocSnapshot);
  return { docs };
};
