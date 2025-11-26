// src/lib/session.ts
import { Secp256k1KeyIdentity } from "@dfinity/identity-secp256k1";

export function loadOrCreateSessionKey(): Secp256k1KeyIdentity {
  const saved = localStorage.getItem("sessionPrivateKey");
  if (saved) {
    return Secp256k1KeyIdentity.fromJSON(JSON.parse(saved));
  }
  const key = Secp256k1KeyIdentity.generate();
  localStorage.setItem("sessionPrivateKey", JSON.stringify(key.toJSON()));
  return key;
}
