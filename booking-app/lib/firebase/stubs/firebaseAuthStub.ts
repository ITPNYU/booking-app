export class GoogleAuthProvider {
  setCustomParameters(_params: Record<string, unknown>) {
    // noop for tests
  }
}

export const getAuth = (_app?: unknown) => ({
  currentUser: null,
  signOut: async () => {},
  onAuthStateChanged: (callback: (user: unknown) => void) => {
    callback(null);
    return () => {};
  },
});

export const signInWithPopup = async () => ({ user: null });
export const signInWithRedirect = async () => {};
export const getRedirectResult = async () => null;
export const signOut = async () => {};
export const onAuthStateChanged = (
  _auth: unknown,
  callback: (user: unknown) => void,
) => {
  callback(null);
  return () => {};
};
