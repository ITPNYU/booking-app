// Clean object by removing undefined values for Firestore compatibility
export function cleanObjectForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .map(item => cleanObjectForFirestore(item))
      .filter(item => item !== undefined);
  }

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanObjectForFirestore(value);
    }
  }

  return cleaned;
}

// Common function to create XState data structure
export function createXStateData(
  machineId: string,
  snapshot: any,
  targetState?: string,
) {
  return {
    machineId,
    lastTransition: new Date().toISOString(),
    snapshot: {
      status: snapshot.status,
      value: targetState || snapshot.value,
      historyValue: snapshot.historyValue || {},
      context: cleanObjectForFirestore(snapshot.context),
      children: snapshot.children || {},
    },
  };
}

