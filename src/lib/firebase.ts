import { FirebaseApp, initializeApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectDatabaseEmulator, getDatabase, ref, onValue, set, Unsubscribe, DatabaseReference, update } from 'firebase/database';

let firebaseApp: FirebaseApp;
const useEmulator = () => import.meta.env.VITE_USE_FIREBASE_EMULATOR;

export const setupFirebase = () => {
  try {
    firebaseApp = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTHDOMAIN,
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASEURL,
      projectId: import.meta.env.VITE_FIREBASE_PROJECTID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGEBUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGINGSENDERID,
      appId: import.meta.env.VITE_FIREBASE_APPID,
    });
  } catch (error) {
    console.error({error})
  }
};

let auth: Auth;
let firestore: ReturnType<typeof getFirestore>;
let storage: ReturnType<typeof getStorage>;
let database: ReturnType<typeof getDatabase>;

export const useAuth = () => {
  auth = getAuth(firebaseApp);
  if (useEmulator()) {
    connectAuthEmulator(auth, 'http://localhost:9099');
  }
  return auth;
};

export const useFirestore = () => {
  if (!firestore) {
    firestore = getFirestore();
    if (useEmulator()) {
      connectFirestoreEmulator(firestore, 'localhost', 8080);
    }
  }
  return firestore;
};

export const useStorage = () => {
  if (!storage) {
    storage = getStorage();
    if (useEmulator()) {
      connectStorageEmulator(storage, 'localhost', 9199);
    }
  }
  return storage;
};

export const useDatabase = () => {
  if (!database) {
    database = getDatabase();
    if (useEmulator()) {
      connectDatabaseEmulator(database, 'localhost', 9000);
    }
  }
  return database;
};

export const setDoc = async (index: string, data: any) => {
  const db = useDatabase();
  const docRef = ref(db, `sessions/${index}`);
  await set(docRef, data);
}

export const updateDoc = async (index: string, changes: any) => {
  const db = useDatabase();
  const docRef = ref(db, `sessions/${index}`);
  await update(docRef, changes);
}

export const watchDoc = (index: string, callback: (ref: DatabaseReference, data: any) => void): Unsubscribe => {
  const db = useDatabase();
  const docRef = ref(db, `sessions/${index}`);
  return onValue(docRef, (snapshot) => {
    callback(docRef, snapshot.val());
  });
}
