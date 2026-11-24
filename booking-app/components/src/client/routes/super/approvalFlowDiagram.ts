/**
 * Read-only layout for an approvalFlow document.
 * The document is the XState config: states, and transitions in on, always,
 * after, and onDone. Positions are computed here so the view can draw them.
 */

export type ApprovalDiagramNode = {
  id: string;
  name: string;
  kind: "state" | "final" | "parallel" | "compound" | "external";
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
  initial: boolean;
  loops: string[];
  clickable: boolean;
};

export type ApprovalDiagramEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: "event" | "always" | "after" | "done";
  path: string;
  labelX: number;
  labelY: number;
  labelAnchor: "start" | "middle" | "end";
};

export type ApprovalDiagramExit = {
  label: string;
  to: string;
};

export type ApprovalDiagram =
  | {
      ok: true;
      machineId?: string;
      width: number;
      height: number;
      nodes: ApprovalDiagramNode[];
      edges: ApprovalDiagramEdge[];
      exits: ApprovalDiagramExit[];
    }
  | { ok: false; message: string };

type RawState = {
  type?: unknown;
  initial?: unknown;
  states?: unknown;
  on?: unknown;
  onDone?: unknown;
  always?: unknown;
  after?: unknown;
};

type DraftEdge = {
  from: string;
  to: string;
  label: string;
  kind: ApprovalDiagramEdge["kind"];
  self: boolean;
  external: boolean;
};

const PAD = 20;
const ROW_GAP = 44;
const COL_GAP = 280;
const CHAR_W = 7;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stateMap(value: unknown): Record<string, unknown> | null {
  const record = asRecord(value);
  if (!record) return null;
  const states = asRecord(record.states);
  if (!states || Object.keys(states).length === 0) return null;
  return states;
}

function asState(value: unknown): RawState {
  return (asRecord(value) ?? {}) as RawState;
}

function nodeAt(value: unknown, path: string[]): RawState | null {
  let current = value;
  for (const name of path) {
    const states = stateMap(current);
    if (!states || !(name in states)) return null;
    current = states[name];
  }
  if (!stateMap(current)) return null;
  return asState(current);
}

function machineIdOf(value: unknown): string | undefined {
  const id = asRecord(value)?.id;
  return typeof id === "string" && id ? id : undefined;
}

function listOf(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function targetOf(transition: unknown): string | undefined {
  if (typeof transition === "string" && transition) return transition;
  const target = asRecord(transition)?.target;
  return typeof target === "string" && target ? target : undefined;
}

function guardOf(transition: unknown): string | undefined {
  const guard = asRecord(transition)?.guard;
  if (typeof guard === "string" && guard) return guard;
  const type = asRecord(guard)?.type;
  return typeof type === "string" && type ? type : undefined;
}

function withGuard(label: string, transition: unknown): string {
  const guard = guardOf(transition);
  return guard ? `${label} if ${guard}` : label;
}

function formatDelay(raw: string): string {
  const ms = Number(raw);
  if (!Number.isFinite(ms)) return raw;
  const day = 86_400_000;
  if (ms % day === 0 && ms !== 0) {
    const days = ms / day;
    return days === 1 ? "1 day" : `${days} days`;
  }
  const hour = 3_600_000;
  if (ms % hour === 0 && ms !== 0) {
    const hours = ms / hour;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const minute = 60_000;
  if (ms % minute === 0 && ms !== 0) return `${ms / minute} min`;
  return `${ms}ms`;
}

function transitionEdges(
  stateName: string,
  state: RawState,
  siblings: Set<string>,
): DraftEdge[] {
  const edges: DraftEdge[] = [];
  const add = (transition: unknown, label: string, kind: DraftEdge["kind"]) => {
    const to = targetOf(transition);
    if (!to) return;
    edges.push({
      from: stateName,
      to,
      label: withGuard(label, transition),
      kind,
      self: to === stateName,
      external: !siblings.has(to),
    });
  };

  const on = asRecord(state.on) ?? {};
  for (const [event, transition] of Object.entries(on)) {
    listOf(transition).forEach((item) => add(item, event, "event"));
  }
  listOf(state.always).forEach((item) => add(item, "always", "always"));
  const after = asRecord(state.after) ?? {};
  for (const [delay, transition] of Object.entries(after)) {
    add(transition, `after ${formatDelay(delay)}`, "after");
  }
  if (state.onDone !== undefined) add(state.onDone, "onDone", "done");
  return edges;
}

function textWidth(text: string): number {
  return Math.max(140, Math.min(280, text.length * CHAR_W + 36));
}

function nodeKind(
  state: RawState,
  childCount: number,
): ApprovalDiagramNode["kind"] {
  if (state.type === "final") return "final";
  if (state.type === "parallel") return "parallel";
  if (childCount > 0) return "compound";
  return "state";
}

function subtitle(kind: ApprovalDiagramNode["kind"]): string {
  if (kind === "parallel") return "parallel";
  if (kind === "final") return "final";
  if (kind === "compound") return "nested";
  if (kind === "external") return "outside this view";
  return "";
}

export function layoutApprovalFlow(
  value: unknown,
  path: string[] = [],
): ApprovalDiagram {
  const container = nodeAt(value, path);
  const states = container ? stateMap(container) : null;
  if (!container || !states) {
    return {
      ok: false,
      message:
        path.length === 0
          ? "This JSON has no states to draw."
          : "That part of the flow has no states to draw.",
    };
  }

  const names = Object.keys(states);
  const siblings = new Set(names);
  const parallel = container.type === "parallel";
  const outgoing = new Map<string, DraftEdge[]>();
  for (const name of names) {
    outgoing.set(name, transitionEdges(name, asState(states[name]), siblings));
  }

  const rank = new Map<string, number>();
  const seen: string[] = [];
  const visit = (name: string) => {
    if (!seen.includes(name)) seen.push(name);
  };

  if (parallel) {
    names.forEach((name) => {
      rank.set(name, 0);
      visit(name);
    });
  } else {
    const declared = container.initial;
    const initial =
      typeof declared === "string" && siblings.has(declared)
        ? declared
        : names[0];
    const queue = [initial];
    rank.set(initial, 0);
    visit(initial);
    while (queue.length > 0) {
      const name = queue.shift()!;
      const nextRank = rank.get(name)! + 1;
      for (const edge of outgoing.get(name) ?? []) {
        if (edge.self || edge.external || rank.has(edge.to)) continue;
        rank.set(edge.to, nextRank);
        visit(edge.to);
        queue.push(edge.to);
      }
    }
    const extra = Math.max(...rank.values()) + 1;
    for (const name of names) {
      if (rank.has(name)) continue;
      rank.set(name, extra);
      visit(name);
    }
  }

  const externalNames: string[] = [];
  for (const edges of outgoing.values()) {
    for (const edge of edges) {
      if (edge.external && !edge.self && !externalNames.includes(edge.to)) {
        externalNames.push(edge.to);
      }
    }
  }
  const externalRank =
    externalNames.length > 0 ? Math.max(...rank.values()) + 1 : null;
  externalNames.forEach((name) => visit(name));

  const columns = new Map<number, string[]>();
  const addToColumn = (column: number, name: string) => {
    const list = columns.get(column) ?? [];
    list.push(name);
    columns.set(column, list);
  };
  for (const name of names) addToColumn(rank.get(name)!, name);
  if (externalRank !== null) {
    externalNames.forEach((name) => addToColumn(externalRank, name));
  }
  for (const list of columns.values()) {
    list.sort((a, b) => seen.indexOf(a) - seen.indexOf(b));
  }

  const drafts = new Map<
    string,
    {
      kind: ApprovalDiagramNode["kind"];
      loops: string[];
      width: number;
      height: number;
    }
  >();
  const describe = (name: string, external: boolean) => {
    const state = external ? {} : asState(states[name]);
    const childCount = external ? 0 : Object.keys(stateMap(state) ?? {}).length;
    const kind: ApprovalDiagramNode["kind"] = external
      ? "external"
      : nodeKind(state, childCount);
    const loops = external
      ? []
      : (outgoing.get(name) ?? [])
          .filter((edge) => edge.self)
          .map((edge) => edge.label);
    const lines = [name, subtitle(kind), loops.join(" / ")].filter(Boolean);
    drafts.set(name, {
      kind,
      loops,
      width: textWidth(lines.reduce((a, b) => (a.length > b.length ? a : b))),
      height: 18 + lines.length * 16,
    });
  };
  names.forEach((name) => describe(name, false));
  externalNames.forEach((name) => describe(name, true));

  const columnRanks = [...columns.keys()].sort((a, b) => a - b);
  const columnWidths = new Map<number, number>();
  const columnHeights = new Map<number, number>();
  for (const column of columnRanks) {
    const list = columns.get(column)!;
    columnWidths.set(
      column,
      Math.max(...list.map((name) => drafts.get(name)!.width)),
    );
    columnHeights.set(
      column,
      list.reduce(
        (sum, name, index) =>
          sum + drafts.get(name)!.height + (index > 0 ? ROW_GAP : 0),
        0,
      ),
    );
  }
  const stackHeight = Math.max(...columnHeights.values());

  const nodes: ApprovalDiagramNode[] = [];
  let x = PAD;
  const columnX = new Map<number, number>();
  for (const column of columnRanks) {
    columnX.set(column, x);
    const list = columns.get(column)!;
    let y = PAD + (stackHeight - columnHeights.get(column)!) / 2;
    for (const name of list) {
      const draft = drafts.get(name)!;
      const external = externalNames.includes(name);
      nodes.push({
        id: name,
        name,
        kind: draft.kind,
        column: external ? externalRank! : rank.get(name)!,
        x,
        y,
        width: draft.width,
        height: draft.height,
        initial:
          !parallel &&
          !external &&
          container.initial === name &&
          siblings.has(name),
        loops: draft.loops,
        clickable:
          !external && (draft.kind === "parallel" || draft.kind === "compound"),
      });
      y += draft.height + ROW_GAP;
    }
    x += columnWidths.get(column)! + COL_GAP;
  }

  const byName = new Map(nodes.map((node) => [node.name, node]));
  const drawable = [...outgoing.values()]
    .flat()
    .filter((edge) => !edge.self && byName.has(edge.to));
  const back = drawable.filter(
    (edge) => byName.get(edge.to)!.column <= byName.get(edge.from)!.column,
  );
  const forward = drawable.filter((edge) => !back.includes(edge));

  const contentBottom = Math.max(...nodes.map((node) => node.y + node.height));
  const edges: ApprovalDiagramEdge[] = [];

  const departures = new Map<string, number>();
  const arrivals = new Map<string, number>();
  forward.forEach((edge) => {
    departures.set(edge.from, (departures.get(edge.from) ?? 0) + 1);
    arrivals.set(edge.to, (arrivals.get(edge.to) ?? 0) + 1);
  });
  const departureIndex = new Map<string, number>();
  const arrivalIndex = new Map<string, number>();
  for (const edge of forward) {
    const from = byName.get(edge.from)!;
    const to = byName.get(edge.to)!;
    const leaveCount = departures.get(edge.from)!;
    const leaveIndex = departureIndex.get(edge.from) ?? 0;
    departureIndex.set(edge.from, leaveIndex + 1);
    const spread = Math.min(from.height - 16, (leaveCount - 1) * 12);
    const leaveOffset =
      leaveCount === 1
        ? 0
        : (leaveIndex - (leaveCount - 1) / 2) *
          (spread / Math.max(leaveCount - 1, 1));
    const arriveCount = arrivals.get(edge.to)!;
    const arriveIndex = arrivalIndex.get(edge.to) ?? 0;
    arrivalIndex.set(edge.to, arriveIndex + 1);
    const x1 = from.x + from.width;
    const y1 = from.y + from.height / 2 + leaveOffset;
    const x2 = to.x;
    const y2 = to.y + to.height / 2;
    const dx = Math.max(48, (x2 - x1) / 2);
    edges.push({
      id: `${edge.from}->${edge.to}:${edge.label}:${arriveIndex}`,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      kind: edge.kind,
      path: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
      labelX: x2 - 8,
      labelY: y2 + (arriveIndex - (arriveCount - 1) / 2) * 14 - 6,
      labelAnchor: "end",
    });
  }

  back.forEach((edge, lane) => {
    const from = byName.get(edge.from)!;
    const to = byName.get(edge.to)!;
    const y = contentBottom + 36 + lane * 34;
    const x1 = from.x + from.width / 2;
    const x2 = to.x + to.width / 2;
    const toward = x2 === x1 ? 0 : x2 > x1 ? 1 : -1;
    edges.push({
      id: `${edge.from}->${edge.to}:${edge.label}:${lane}`,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      kind: edge.kind,
      path: `M ${x1} ${from.y + from.height} V ${y} H ${x2} V ${to.y + to.height}`,
      labelX: x1 + toward * 56,
      labelY: y - 8,
      labelAnchor: "middle",
    });
  });

  const exits =
    path.length === 0
      ? []
      : transitionEdges(path[path.length - 1], container, new Set())
          .filter((edge) => !edge.self)
          .map((edge) => ({ label: edge.label, to: edge.to }));

  const width = Math.max(...nodes.map((node) => node.x + node.width)) + PAD;
  const height =
    (back.length > 0 ? contentBottom + 36 + back.length * 34 : contentBottom) +
    PAD;

  return {
    ok: true,
    machineId: machineIdOf(value),
    width,
    height,
    nodes,
    edges,
    exits,
  };
}
