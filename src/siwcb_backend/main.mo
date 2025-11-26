import Principal       "mo:base/Principal";
import CertifiedData   "mo:base/CertifiedData";
import Time            "mo:base/Time";
import Blob            "mo:base/Blob";
import Map "mo:base/OrderedMap";
import Text "mo:base/Text";


persistent actor {
type AuthResponse = {
  userPrincipal  : Principal.Principal;
  delegationBlob : Blob;
};

transient let users = Map.Make<Text>(Text.compare);
transient let sessions = Map.Make<Blob>(Blob.compare);

  var user_map : Map.Map<Text, Principal> = users.empty();
  var session_map : Map.Map<Blob, Principal> = sessions.empty();
}
