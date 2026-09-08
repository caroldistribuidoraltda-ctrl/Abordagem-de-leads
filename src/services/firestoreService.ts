import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Client, MessageConfig } from '../types';

const APP_STATE_DOC = 'latest_import';
const CAMPAIGN_CONFIG_DOC = 'latest';

export interface PersistedAppState {
  clients: Client[];
  config: MessageConfig;
  updatedAt: string;
  sourceFileName?: string;
}

/**
 * Saves both the imported spreadsheet clients and the campaign message/keywords to Firestore.
 */
export async function saveAppStateToFirestore(
  clients: Client[],
  config: MessageConfig,
  sourceFileName?: string
): Promise<void> {
  try {
    const updatedAt = new Date().toISOString();

    const statePayload: PersistedAppState = {
      clients,
      config,
      updatedAt,
      sourceFileName: sourceFileName || 'Planilha de Clientes',
    };

    // Save in app_state collection
    const stateDocRef = doc(db, 'app_state', APP_STATE_DOC);
    await setDoc(stateDocRef, statePayload, { merge: true });

    // Also persist campaign config specifically in campaign_config collection
    const configDocRef = doc(db, 'campaign_config', CAMPAIGN_CONFIG_DOC);
    await setDoc(
      configDocRef,
      {
        ...config,
        updatedAt,
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error saving app state to Firestore:', error);
    throw error;
  }
}

/**
 * Loads the latest imported sheet and campaign message/keywords from Firestore.
 */
export async function loadAppStateFromFirestore(): Promise<PersistedAppState | null> {
  try {
    const stateDocRef = doc(db, 'app_state', APP_STATE_DOC);
    const snap = await getDoc(stateDocRef);

    if (snap.exists()) {
      const data = snap.data() as PersistedAppState;
      return data;
    }

    // Fallback check: check campaign_config if state doc doesn't exist yet
    const configDocRef = doc(db, 'campaign_config', CAMPAIGN_CONFIG_DOC);
    const configSnap = await getDoc(configDocRef);
    if (configSnap.exists()) {
      const configData = configSnap.data() as MessageConfig & { updatedAt?: string };
      return {
        clients: [],
        config: {
          context: configData.context || '',
          keywords: configData.keywords || '',
          tone: configData.tone || 'amigavel',
          mentionDays: configData.mentionDays ?? true,
          mentionSeller: configData.mentionSeller ?? true,
        },
        updatedAt: configData.updatedAt || new Date().toISOString(),
      };
    }

    return null;
  } catch (error) {
    console.error('Error loading app state from Firestore:', error);
    return null;
  }
}

/**
 * Subscribes to real-time updates from Firestore for seamless live sync.
 */
export function subscribeToAppState(
  onUpdate: (state: PersistedAppState) => void,
  onError?: (error: any) => void
) {
  const stateDocRef = doc(db, 'app_state', APP_STATE_DOC);
  return onSnapshot(
    stateDocRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as PersistedAppState;
        onUpdate(data);
      }
    },
    (err) => {
      console.warn('Firestore snapshot listener warning:', err);
      if (onError) onError(err);
    }
  );
}
