import Utils "Utils";
import Text "mo:base/Text";

persistent actor Orchestrator {
  
  let CONTEXT : Blob = Text.encodeUtf8("siwcb-auth");
  
  func keyId() : Utils.vetkd_key_id {
    { curve = #bls12_381_g2; name = "test_key_1" }
  };

  public func public_key() : async Utils.vetkd_public_key_result {
    await Utils.IC.vetkd_public_key({
      canister_id = null;
      context = CONTEXT;
      key_id = keyId();
    });
  };

  public func derive_key(coinbaseUserId : Text, transportPublicKey : Blob) : async Utils.vetkd_derive_key_result {
    await Utils.IC.vetkd_derive_key({
      input = Text.encodeUtf8(coinbaseUserId);
      context = CONTEXT;
      key_id = keyId();
      transport_public_key = transportPublicKey;
    });
  };
}