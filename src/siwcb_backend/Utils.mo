module {

public type vetkd_curve = {
  #bls12_381_g2
};

public type vetkd_key_id = {
  curve : vetkd_curve;
  name : Text;
};

public type vetkd_public_key_args = {
  canister_id :  ?Principal;
  derivation_path :  [Blob];
  key_id : vetkd_key_id;
};

public type vetkd_public_key_result = {
  public_key : Blob;
};

public type vetkd_derive_key_request = {
  derivation_id : Blob;
  derivation_path :  Blob;
  key_id : vetkd_key_id;
  encryption_public_key : Blob;
};

type vetkd_derive_key_result = {
  encrypted_key : Blob;
};

public let IC = actor "aaaaa-aa" : actor {
  vetkd_public_key : (vetkd_public_key_args) -> async (vetkd_public_key_result);
  vetkd_derive_key : (vetkd_derive_key_request) -> async (vetkd_derive_key_result);
}
}
