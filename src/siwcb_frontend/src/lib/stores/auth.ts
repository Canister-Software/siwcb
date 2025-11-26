// src/lib/stores/auth.ts
import { writable, derived, get } from "svelte/store";
import { browser } from "$app/environment";
import { DelegationIdentity, DelegationChain } from "@dfinity/identity";
import { HttpAgent } from "@dfinity/agent";
import { backend } from "$lib/canisters";
import { loadOrCreateSessionKey } from "$lib/session";

type AuthState = {
  sessionKey: ReturnType<typeof loadOrCreateSessionKey> | null;
  delegatedIdentity: DelegationIdentity | null;
  isAuthenticated: boolean;
  principal: string | null;
  isLoading: boolean;
  error: string | null;
};

const initialState: AuthState = {
  sessionKey: null,
  delegatedIdentity: null,
  isAuthenticated: false,
  principal: null,
  isLoading: true,
  error: null,
};

function createAuthStore() {
  const { subscribe, update } = writable<AuthState>(initialState);

  const setLoading = (l: boolean) => update(s => ({ ...s, isLoading: l }));
  const setError   = (e: string | null) => update(s => ({ ...s, error: e }));

  return {
    subscribe,

    initialize: async () => {
      if (!browser) return;
      setLoading(true);
      try {
        // load or create the session key once
        const sessionKey = loadOrCreateSessionKey();
        update(s => ({ ...s, sessionKey }));

        // check URL for a delegation chain
        const params = new URLSearchParams(window.location.search);
        const chainB64 = params.get("delegation");
        if (chainB64) {
          await processDelegation(chainB64);
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          // load from localStorage if present
          const saved = localStorage.getItem("delegationChain");
          if (saved) await processDelegation(saved);
        }
      } catch (err) {
        console.error(err);
        setError("Initialization failed");
      } finally {
        setLoading(false);
      }
    },

    loginWithCoinbase: () => {
      update(s => {
        if (!s.sessionKey) {
          console.error("Session key missing");
          return { ...s, error: "Session key missing" };
        }
        const der = s.sessionKey.getPublicKey().toDer() as unknown as Uint8Array;
        const b64 = btoa(String.fromCharCode(...der));

        const state = encodeURIComponent(
          JSON.stringify({ pubkey: b64, returnTo: import.meta.env.PUBLIC_AUTH_COMPLETE })
        );
        const redirectUri = encodeURIComponent(import.meta.env.PUBLIC_AUTH_CALLBACK);

        const url = `https://www.coinbase.com/oauth/authorize?response_type=code`
          + `&client_id=${import.meta.env.PUBLIC_COINBASE_CLIENT_ID}`
          + `&redirect_uri=${redirectUri}`
          + `&scope=wallet:user:read`
          + `&state=${state}`;

        window.location.href = url;
        return { ...s, isLoading: true };
      });
    },

    refreshDelegation: async () => {
      setLoading(true);
      setError(null);
      try {
        const { sessionKey, principal: userId } = get(authStore);
        if (!sessionKey || !userId) throw new Error("Cannot refresh without session or userId");

        const der = sessionKey.getPublicKey().toDer() as unknown as Uint8Array;
        const chain: DelegationChain = await backend.prepare_delegation_coinbase(
          userId,
          Array.from(der),
          undefined
        );
        const chainB64 = btoa(JSON.stringify(chain));
        await processDelegation(chainB64);
      } catch (e) {
        console.error(e);
        setError("Refresh failed");
      } finally {
        setLoading(false);
      }
    },

    logout: () => {
      localStorage.removeItem("delegationChain");
      update(s => ({
        ...initialState,
        sessionKey: s.sessionKey,
        isLoading: false,
      }));
    },

    getState: () => get(authStore),
  };

  async function processDelegation(chainB64: string) {
    const chainJson = JSON.parse(atob(chainB64));
    const chain: DelegationChain = DelegationChain.fromJSON(chainJson);
    const sessionKey = get(authStore).sessionKey!;
    const id = DelegationIdentity.fromDelegation(sessionKey, chain);

    localStorage.setItem("delegationChain", chainB64);

    const agent = new HttpAgent({ identity: id, host: "https://ic0.app" });
    if (import.meta.env.DEV) await agent.fetchRootKey();

    update(s => ({
      ...s,
      delegatedIdentity: id,
      isAuthenticated: true,
      principal: id.getPrincipal().toString(),
      error: null,
    }));
  }
}

export const authStore = createAuthStore();
export const isLoading = derived(authStore, $ => $?.isLoading);
export const isAuthenticated = derived(authStore, $ => $?.isAuthenticated);
export const principal = derived(authStore, $ => $?.principal);
export const error = derived(authStore, $ => $?.error);
