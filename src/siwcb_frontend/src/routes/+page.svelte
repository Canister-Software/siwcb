<script lang="ts">
  import { onMount } from 'svelte';
  import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
  import { DelegationIdentity, DelegationChain } from '@dfinity/identity';
  import { Actor, HttpAgent } from '@dfinity/agent';
  
  // Your Coinbase OAuth client ID
  const clientId = import.meta.env.PUBLIC_COINBASE_CLIENT_ID;
  
  // The registered callback URL for your application
  const redirectUri = "https://auth.canister.software/callback";
  
  let sessionKey: Secp256k1KeyIdentity | null = null;
  let delegatedIdentity: DelegationIdentity | null = null;
  let principal: string | null = null;
  let isAuthenticated = false;
  let isLoading = true;
  let error: string | null = null;
  
  onMount(async () => {
    isLoading = true;
    
    try {
      // Initialize or load the session key
      await initializeSessionKey();
      
      // Check if we're returning from the auth flow with a delegation
      const urlParams = new URLSearchParams(window.location.search);
      const delegationParam = urlParams.get('delegation');
      const errorParam = urlParams.get('error');
      
      if (errorParam) {
        error = `Authentication error: ${errorParam}`;
      } else if (delegationParam) {
        // Process the delegation from the auth callback
        await processDelegation(delegationParam);
        // Clean up URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        // Check if we have a valid delegation in localStorage
        const savedDelegation = localStorage.getItem('delegationChain');
        if (savedDelegation) {
          try {
            await processDelegation(savedDelegation);
          } catch (e) {
            console.error('Error processing saved delegation:', e);
            // Clear invalid delegation
            localStorage.removeItem('delegationChain');
            error = 'Saved authentication expired or invalid';
          }
        }
      }
    } catch (e) {
      console.error('Initialization error:', e);
      error = 'Failed to initialize authentication';
    } finally {
      isLoading = false;
    }
  });
  
  async function initializeSessionKey() {
    const savedKey = localStorage.getItem('sessionPrivateKey');
    
    if (savedKey) {
      try {
        sessionKey = Secp256k1KeyIdentity.fromJSON(JSON.parse(savedKey));
      } catch (e) {
        console.error('Failed to load saved session key:', e);
        sessionKey = Secp256k1KeyIdentity.generate();
        localStorage.setItem('sessionPrivateKey', JSON.stringify(sessionKey.toJSON()));
      }
    } else {
      // Generate a new session key
      sessionKey = Secp256k1KeyIdentity.generate();
      localStorage.setItem('sessionPrivateKey', JSON.stringify(sessionKey.toJSON()));
    }
  }
  
  async function processDelegation(delegationParam: string) {
    if (!sessionKey) {
      throw new Error('Session key not initialized');
    }
    
    // Parse the delegation chain
    const delegationData = JSON.parse(atob(delegationParam));
    const delegationChain = DelegationChain.fromJSON(delegationData);
    
    // Create the delegated identity
    delegatedIdentity = DelegationIdentity.fromDelegation(sessionKey, delegationChain);
    
    // Save the delegation to localStorage for future use
    localStorage.setItem('delegationChain', delegationParam);
    
    // Set up the Internet Computer agent with this identity
    const agent = new HttpAgent({
      identity: delegatedIdentity,
      host: 'https://ic0.app' // or your local replica host
    });
    
    // In development, you might need to fetch the root key
    if (import.meta.env.DEV) {
      await agent.fetchRootKey().catch(err => {
        console.warn('Unable to fetch root key. Check your replica connection', err);
      });
    }
    
    // Get the principal ID
    principal = delegatedIdentity.getPrincipal().toString();
    isAuthenticated = true;
    
    console.log('Successfully authenticated with principal:', principal);
  }
  
  function loginWithCoinbase() {
    if (!sessionKey) {
      console.error("Session key not initialized.");
      return;
    }
    
    // Get the public key in DER format and convert to base64
    const publicKeyDER = sessionKey.getPublicKey().toDer() as unknown as Uint8Array;
    const publicKeyBase64 = btoa(
      Array.from(publicKeyDER)
        .map((b) => String.fromCharCode(b))
        .join('')
    );
    
    // Create the state object with the public key
    const state = encodeURIComponent(JSON.stringify({
      pubkey: publicKeyBase64,
      returnTo: window.location.origin
    }));
    
    // Build the OAuth URL
    const authUrl = `https://www.coinbase.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=wallet:user:read&state=${state}`;
    
    // Redirect to Coinbase OAuth
    window.location.href = authUrl;
  }
  
  function logout() {
    // Clear authentication data
    localStorage.removeItem('delegationChain');
    delegatedIdentity = null;
    principal = null;
    isAuthenticated = false;
    
    // We keep the session key for future use
  }
</script>

<main>
  <div class="container">
    {#if isLoading}
      <div class="loading">
        <p>Loading...</p>
      </div>
    {:else if isAuthenticated}
      <div class="authenticated">
        <h1>Welcome to CanisterAuth</h1>
        <p>You are successfully authenticated!</p>
        
        <div class="principal-info">
          <p>Your principal ID:</p>
          <code>{principal}</code>
        </div>
        
        <button on:click={logout} class="logout-button">
          Log Out
        </button>
      </div>
    {:else}
      <h1>Welcome to CanisterAuth</h1>
      <p>Sign in with Coinbase to get started.</p>
      
      {#if error}
        <div class="error">
          <p>{error}</p>
        </div>
      {/if}
      
      <button on:click={loginWithCoinbase} class="login-button">
        Sign in with Coinbase
      </button>
    {/if}
  </div>
</main>

<style>
  .container {
    max-width: 500px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  h1 {
    color: #333;
    margin-bottom: 1rem;
  }
  
  p {
    color: #666;
    margin-bottom: 2rem;
  }
  
  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
  }
  
  .authenticated {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .principal-info {
    background-color: #f5f5f5;
    padding: 1rem;
    border-radius: 4px;
    margin: 1.5rem 0;
    width: 100%;
  }
  
  .principal-info p {
    margin-bottom: 0.5rem;
    font-weight: 500;
  }
  
  code {
    display: block;
    padding: 0.5rem;
    background-color: #eee;
    border-radius: 4px;
    font-family: monospace;
    word-break: break-all;
    font-size: 0.875rem;
  }
  
  .login-button {
    background-color: #0052FF; /* Coinbase blue */
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .login-button:hover {
    background-color: #0039B3;
  }
  
  .logout-button {
    background-color: #ef4444;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .logout-button:hover {
    background-color: #dc2626;
  }
  
  .error {
    background-color: #fee2e2;
    color: #b91c1c;
    padding: 0.75rem 1rem;
    border-radius: 4px;
    margin-bottom: 1.5rem;
    text-align: left;
  }
  
  .error p {
    margin: 0;
    color: inherit;
  }
</style>