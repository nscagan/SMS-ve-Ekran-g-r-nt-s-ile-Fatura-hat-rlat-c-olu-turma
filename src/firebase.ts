import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";

let authInstance: any = null;
let googleProvider: any = null;
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export async function getFirebase() {
  if (authInstance) {
    return { auth: authInstance, provider: googleProvider };
  }
  try {
    const response = await fetch("/firebase-applet-config.json");
    if (!response.ok) {
      throw new Error("Firebase configuration file not found");
    }
    
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      throw new Error("Firebase config file is not created yet (delivered SPA fallback HTML instead of JSON configuration).");
    }

    const text = await response.text();
    if (text.trim().startsWith("<!doctype") || text.trim().startsWith("<html")) {
      throw new Error("Firebase config file returned HTML instead of JSON configuration.");
    }

    const firebaseConfig = JSON.parse(text);
    const app = initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.addScope("https://www.googleapis.com/auth/calendar.events");
    return { auth: authInstance, provider: googleProvider };
  } catch (error) {
    console.warn("Firebase initialization skipped because applet cloud setup is in progress:", error);
    return { auth: null, provider: null };
  }
}

export const initAuth = async (
  onAuthSuccess: (user: User, token: string) => void,
  onAuthFailure: () => void
) => {
  const { auth } = await getFirebase();
  if (!auth) {
    onAuthFailure();
    return () => {};
  }

  return onAuthStateChanged(auth, async (user: any) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  const { auth, provider } = await getFirebase();
  if (!auth || !provider) {
    throw new Error("Sistem henüz Google Giriş yetkilendirmesi için hazır değil. Lütfen kurulmasını bekleyin.");
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get Google Calendar access token.");
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Giriş hatası:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  const { auth } = await getFirebase();
  if (auth) {
    await auth.signOut();
  }
  cachedAccessToken = null;
};
