/**
 * In-memory stand-in for the slice of the firebase-admin Firestore API the
 * booking server code uses. Documents are deep-copied on the way in and out,
 * so a caller mutating what it read never changes stored state.
 */

type Data = Record<string, unknown>;
type Op =
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "in"
  | "not-in"
  | "array-contains"
  | "array-contains-any";

const isPlainObject = (value: unknown): value is Data =>
  typeof value === "object" &&
  value !== null &&
  Object.getPrototypeOf(value) === Object.prototype;

const sentinelName = (value: unknown): string | undefined =>
  typeof value === "object" && value !== null
    ? (value as { constructor?: { name?: string } }).constructor?.name
    : undefined;

const isDeleteSentinel = (value: unknown) =>
  sentinelName(value) === "DeleteTransform";

/** Copy plain objects and arrays; keep class instances (Timestamp) as they are. */
const clone = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(clone) as unknown as T;
  if (isPlainObject(value)) {
    const out: Data = {};
    for (const [key, inner] of Object.entries(value)) out[key] = clone(inner);
    return out as T;
  }
  return value;
};

const comparable = (value: unknown): unknown => {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function")
    return (value as { toMillis: () => number }).toMillis();
  if (value instanceof Date) return value.getTime();
  return value;
};

/** Keys that would reach an object's prototype instead of its own fields. */
const isUnsafeKey = (key: string) =>
  key === "__proto__" || key === "constructor" || key === "prototype";

const getPath = (data: Data | undefined, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (current, key) => (isPlainObject(current) ? current[key] : undefined),
      data,
    );

const setPath = (data: Data, path: string, value: unknown) => {
  const keys = path.split(".");
  if (keys.some(isUnsafeKey)) return;
  let current = data;
  keys.slice(0, -1).forEach((key) => {
    if (!isPlainObject(current[key])) current[key] = {};
    current = current[key] as Data;
  });
  const last = keys[keys.length - 1];
  if (isDeleteSentinel(value)) delete current[last];
  else current[last] = clone(value);
};

/** Drop delete sentinels from a document being written whole. */
const stripSentinels = (data: Data): Data => {
  const out: Data = {};
  for (const [key, value] of Object.entries(data)) {
    if (isDeleteSentinel(value)) continue;
    out[key] = isPlainObject(value) ? stripSentinels(value) : clone(value);
  }
  return out;
};

const mergeInto = (target: Data, source: Data) => {
  for (const [key, value] of Object.entries(source)) {
    if (isUnsafeKey(key)) continue;
    if (isDeleteSentinel(value)) delete target[key];
    else if (isPlainObject(value)) {
      if (!isPlainObject(target[key])) target[key] = {};
      mergeInto(target[key] as Data, value);
    } else target[key] = clone(value);
  }
};

const matches = (data: Data, field: string, op: Op, expected: unknown) => {
  const actual = comparable(getPath(data, field));
  const want = comparable(expected);
  switch (op) {
    case "==":
      return actual === want;
    case "!=":
      return actual !== undefined && actual !== want;
    case "<":
      return actual !== undefined && (actual as number) < (want as number);
    case "<=":
      return actual !== undefined && (actual as number) <= (want as number);
    case ">":
      return actual !== undefined && (actual as number) > (want as number);
    case ">=":
      return actual !== undefined && (actual as number) >= (want as number);
    case "in":
      return (expected as unknown[]).map(comparable).includes(actual);
    case "not-in":
      return (
        actual !== undefined &&
        !(expected as unknown[]).map(comparable).includes(actual)
      );
    case "array-contains":
      return Array.isArray(actual) && actual.includes(want);
    case "array-contains-any":
      return (
        Array.isArray(actual) &&
        (expected as unknown[]).some((item) => actual.includes(item))
      );
    default:
      throw new Error(`fakeFirestore: unsupported operator ${op}`);
  }
};

export class FakeFirestore {
  private collections = new Map<string, Map<string, Data>>();

  private nextId = 1;

  /** Every write, in order, for tests that assert "nothing was written". */
  writes: { path: string; kind: "set" | "update" | "delete" }[] = [];

  reset() {
    this.collections.clear();
    this.writes = [];
    this.nextId = 1;
  }

  private table(name: string) {
    let table = this.collections.get(name);
    if (!table) {
      table = new Map();
      this.collections.set(name, table);
    }
    return table;
  }

  /** Test-side read that does not count as application activity. */
  peek(collection: string, id: string): Data | undefined {
    const data = this.table(collection).get(id);
    return data ? clone(data) : undefined;
  }

  /** Test-side write that does not count as application activity. */
  seed(collection: string, id: string, data: Data) {
    this.table(collection).set(id, clone(data));
  }

  all(collection: string): { id: string; data: Data }[] {
    return [...this.table(collection).entries()].map(([id, data]) => ({
      id,
      data: clone(data),
    }));
  }

  settings() {}

  collection(name: string) {
    return new FakeCollection(this, name);
  }

  doc(path: string) {
    const parts = path.split("/");
    const id = parts.pop() as string;
    return new FakeDocRef(this, parts.join("/"), id);
  }

  async getAll(...refs: FakeDocRef[]) {
    return Promise.all(refs.map((ref) => ref.get()));
  }

  batch() {
    const pending: (() => Promise<unknown>)[] = [];
    const batch = {
      set: (ref: FakeDocRef, data: Data, options?: { merge?: boolean }) => {
        pending.push(() => ref.set(data, options));
        return batch;
      },
      update: (ref: FakeDocRef, data: Data) => {
        pending.push(() => ref.update(data));
        return batch;
      },
      delete: (ref: FakeDocRef) => {
        pending.push(() => ref.delete());
        return batch;
      },
      commit: async () => {
        for (const run of pending) await run();
      },
    };
    return batch;
  }

  /** Runs the callback once. There is no contention to retry against here. */
  async runTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const tx = {
      get: (target: FakeDocRef | FakeQuery) => target.get(),
      set: (ref: FakeDocRef, data: Data, options?: { merge?: boolean }) => {
        ref.setNow(data, options);
        return tx;
      },
      update: (ref: FakeDocRef, data: Data) => {
        ref.updateNow(data);
        return tx;
      },
      delete: (ref: FakeDocRef) => {
        ref.deleteNow();
        return tx;
      },
    };
    return fn(tx);
  }

  newId() {
    const id = `fake-doc-${this.nextId}`;
    this.nextId += 1;
    return id;
  }

  read(collection: string, id: string) {
    return this.table(collection).get(id);
  }

  write(collection: string, id: string, data: Data | undefined) {
    if (data === undefined) this.table(collection).delete(id);
    else this.table(collection).set(id, data);
  }

  rows(collection: string) {
    return [...this.table(collection).entries()];
  }
}

class FakeSnapshot {
  constructor(
    readonly ref: FakeDocRef,
    private stored: Data | undefined,
    private fields?: string[],
  ) {}

  get id() {
    return this.ref.id;
  }

  get exists() {
    return this.stored !== undefined;
  }

  data(): Data | undefined {
    if (!this.stored) return undefined;
    if (!this.fields) return clone(this.stored);
    const out: Data = {};
    this.fields.forEach((field) => {
      const value = getPath(this.stored, field);
      if (value !== undefined) setPath(out, field, value);
    });
    return out;
  }

  get(field: string) {
    return clone(getPath(this.stored, field));
  }
}

export class FakeDocRef {
  constructor(
    private db: FakeFirestore,
    private collectionName: string,
    readonly id: string,
  ) {}

  get path() {
    return `${this.collectionName}/${this.id}`;
  }

  collection(name: string) {
    return new FakeCollection(this.db, `${this.path}/${name}`);
  }

  async get() {
    return new FakeSnapshot(this, this.db.read(this.collectionName, this.id));
  }

  setNow(data: Data, options?: { merge?: boolean }) {
    const existing = this.db.read(this.collectionName, this.id);
    if (options?.merge && existing) {
      const next = clone(existing);
      mergeInto(next, data);
      this.db.write(this.collectionName, this.id, next);
    } else {
      this.db.write(this.collectionName, this.id, stripSentinels(data));
    }
    this.db.writes.push({ path: this.path, kind: "set" });
  }

  updateNow(data: Data) {
    const existing = this.db.read(this.collectionName, this.id);
    if (!existing) {
      throw new Error(`fakeFirestore: no document to update at ${this.path}`);
    }
    const next = clone(existing);
    // Firestore's update(): a dotted key addresses a nested field, and a
    // top-level key replaces that field whole.
    for (const [key, value] of Object.entries(data)) setPath(next, key, value);
    this.db.write(this.collectionName, this.id, next);
    this.db.writes.push({ path: this.path, kind: "update" });
  }

  deleteNow() {
    this.db.write(this.collectionName, this.id, undefined);
    this.db.writes.push({ path: this.path, kind: "delete" });
  }

  async set(data: Data, options?: { merge?: boolean }) {
    this.setNow(data, options);
  }

  async update(data: Data) {
    this.updateNow(data);
  }

  async delete() {
    this.deleteNow();
  }
}

class FakeQuery {
  constructor(
    protected db: FakeFirestore,
    protected collectionName: string,
    private filters: { field: string; op: Op; value: unknown }[] = [],
    private order: { field: string; direction: "asc" | "desc" }[] = [],
    private max?: number,
    private fields?: string[],
  ) {}

  where(field: string, op: Op, value: unknown) {
    return new FakeQuery(
      this.db,
      this.collectionName,
      [...this.filters, { field, op, value }],
      this.order,
      this.max,
      this.fields,
    );
  }

  orderBy(field: string, direction: "asc" | "desc" = "asc") {
    return new FakeQuery(
      this.db,
      this.collectionName,
      this.filters,
      [...this.order, { field, direction }],
      this.max,
      this.fields,
    );
  }

  limit(max: number) {
    return new FakeQuery(
      this.db,
      this.collectionName,
      this.filters,
      this.order,
      max,
      this.fields,
    );
  }

  select(...fields: string[]) {
    return new FakeQuery(
      this.db,
      this.collectionName,
      this.filters,
      this.order,
      this.max,
      fields,
    );
  }

  async get() {
    let rows = this.db
      .rows(this.collectionName)
      .filter(([, data]) =>
        this.filters.every((f) => matches(data, f.field, f.op, f.value)),
      );
    this.order
      .slice()
      .reverse()
      .forEach(({ field, direction }) => {
        rows = rows.slice().sort(([, a], [, b]) => {
          const left = comparable(getPath(a, field)) as number;
          const right = comparable(getPath(b, field)) as number;
          if (left === right) return 0;
          const result = left < right ? -1 : 1;
          return direction === "asc" ? result : -result;
        });
      });
    if (this.max !== undefined) rows = rows.slice(0, this.max);
    const docs = rows.map(
      ([id, data]) =>
        new FakeSnapshot(
          new FakeDocRef(this.db, this.collectionName, id),
          data,
          this.fields,
        ),
    );
    return {
      docs,
      size: docs.length,
      empty: docs.length === 0,
      forEach: (fn: (doc: FakeSnapshot) => void) => docs.forEach(fn),
    };
  }
}

class FakeCollection extends FakeQuery {
  get id() {
    return this.collectionName;
  }

  doc(id?: string) {
    return new FakeDocRef(this.db, this.collectionName, id ?? this.db.newId());
  }

  async add(data: Data) {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}
