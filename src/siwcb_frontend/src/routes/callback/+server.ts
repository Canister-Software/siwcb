// src/routes/callback/+server.ts
import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
import { 
  DelegationChain, 
  Delegation, 
  SignedDelegation 
} from '@dfinity/identity';
import { Principal } from '@dfinity/principal';

// This would normally be loaded from environment variables or a secure storage
// In a real app, NEVER hardcode this in your source code
const SERVER_IDENTITY = Secp256k1KeyIdentity.fromJSON(
  // Generate this with Secp256k1KeyIdentity.generate() and store securely
  JSON.parse(process.env.SERVER_IDENTITY || '{"publicKey":{"type":"public","hex":""},"privateKey":{"type":"private","hex":""}}')
);

// In a real app, store user identities in a database
const userIdentities = new Map<string, Secp256k1KeyIdentity>();

export async function GET({ url, cookies }: RequestEvent) {
  // Extract the code and state from the URL (Coinbase OAuth callback)
  const code = url.searchParams.get('code');
  const stateStr = url.searchParams.get('state');
  
  if (!code || !stateStr) {
    throw redirect(302, '/?error=missing_params');
  }
  
  try {
    // Parse the state to get the client's public key and return URL
    const state = JSON.parse(decodeURIComponent(stateStr));
    const publicKeyBase64 = state.pubkey;
    const returnTo = state.returnTo || '/';
    
    // Exchange the code for an access token (Coinbase OAuth)
    const tokenResponse = await fetch('https://api.coinbase.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.PUBLIC_COINBASE_CLIENT_ID,
        client_secret: process.env.COINBASE_CLIENT_SECRET,
        redirect_uri: 'https://auth.canister.software/callback'
      })
    });
    
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw redirect(302, '/?error=token_error');
    }
    
    // Get user info from Coinbase
    const userResponse = await fetch('https://api.coinbase.com/v2/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    const userData = await userResponse.json();
    const userId = userData.data.id;
    
    // Get or create user identity based on their Coinbase ID
    let userIdentity = userIdentities.get(userId);
    if (!userIdentity) {
      userIdentity = Secp256k1KeyIdentity.generate();
      userIdentities.set(userId, userIdentity);
      // In a real app, save this to a database
    }
    
    // Set expiration to 24 hours from now
    const expiration = BigInt(Date.now() + 24 * 60 * 60 * 1000) * BigInt(1000_000); // to nanoseconds
    
    // Create a compatible delegation chain for your library version
    // We'll manually construct what the DelegationChain needs
    const delegations = [];
    
    // Create a delegation object that delegates from user to server
    const delegation = {
      pubkey: SERVER_IDENTITY.getPublicKey(),
      expiration,
      targets: undefined
    };
    
    // Sign the delegation with the user's identity
    const message = Buffer.from(JSON.stringify(delegation));
    const signature = await userIdentity.sign(message);
    
    // Create a signed delegation
    const signedDelegation = {
      delegation,
      signature
    };
    
    // Add to the delegations array
    delegations.push(signedDelegation);
    
    // Create the delegation chain
    const delegationChain = {
      delegations,
      publicKey: userIdentity.getPublicKey()
    };
    
    // Serialize the delegation chain to send to the client
    const serializedChain = JSON.stringify(delegationChain);
    const encodedChain = Buffer.from(serializedChain).toString('base64');
    
    // Set a cookie to identify the user in future requests
    cookies.set('userId', userId, { 
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 24 hours
    });
    
    // Redirect back to the client with the delegation chain
    throw redirect(302, `${returnTo}?delegation=${encodedChain}`);
    
  } catch (e) {
    console.error('Error in OAuth callback:', e);
    // If it's already a redirect response, just throw it again
    if (e instanceof Response && e.status === 302) throw e;
    
    throw redirect(302, '/?error=auth_failed');
  }
}