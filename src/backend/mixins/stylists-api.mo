import List "mo:core/List";
import Types "../types/stylists";
import StylistsLib "../lib/stylists";
import DirectoryTypes "../types/directory";
import DirectoryLib "../lib/directory";
import AccessControl "mo:caffeineai-authorization/access-control";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";

mixin (stylists : List.List<Types.Stylist>, directoryState : DirectoryLib.State, accessControlState : AccessControl.AccessControlState) {
  func ensureAdmin(caller : Principal) {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: this workspace is restricted to its administrator");
    };
  };

  public shared ({ caller }) func addStylist(stylist : Types.Stylist) : async () {
    ensureAdmin(caller);
    StylistsLib.addStylist(stylists, stylist);
  };

  public shared query ({ caller }) func getStylists() : async [Types.Stylist] {
    ensureAdmin(caller);
    StylistsLib.getStylists(stylists);
  };

  public shared ({ caller }) func createStylist(input : DirectoryTypes.StylistInput) : async DirectoryTypes.Stylist {
    ensureAdmin(caller);
    DirectoryLib.createStylist(directoryState, input)
  };

  public shared ({ caller }) func updateStylist(id : Nat, input : DirectoryTypes.StylistInput, expectedRevision : Nat) : async DirectoryTypes.Stylist {
    ensureAdmin(caller);
    DirectoryLib.updateStylist(directoryState, id, input, expectedRevision)
  };

  public shared ({ caller }) func setStylistActive(id : Nat, active : Bool, expectedRevision : Nat) : async DirectoryTypes.Stylist {
    ensureAdmin(caller);
    DirectoryLib.setStylistActive(directoryState, id, active, expectedRevision)
  };

  public shared ({ caller }) func routeClient(input : DirectoryTypes.RouteInput) : async DirectoryTypes.RoutingResult {
    ensureAdmin(caller);
    DirectoryLib.routeClient(directoryState, input)
  };

  public shared ({ caller }) func assignRequest(requestId : Nat, stylistId : Nat, expectedRevision : Nat, note : Text) : async DirectoryTypes.ClientRequest {
    ensureAdmin(caller);
    DirectoryLib.assignRequest(directoryState, requestId, stylistId, expectedRevision, note)
  };

  public shared ({ caller }) func useBackup(requestId : Nat, expectedRevision : Nat, reason : Text) : async DirectoryTypes.RoutingResult {
    ensureAdmin(caller);
    DirectoryLib.useBackup(directoryState, requestId, expectedRevision, reason)
  };

  public shared ({ caller }) func setRequestStatus(requestId : Nat, status : Text, expectedRevision : Nat, reason : Text) : async DirectoryTypes.ClientRequest {
    ensureAdmin(caller);
    DirectoryLib.setRequestStatus(directoryState, requestId, status, expectedRevision, reason)
  };

  public shared query ({ caller }) func getDashboard() : async DirectoryTypes.Dashboard {
    ensureAdmin(caller);
    DirectoryLib.dashboard(directoryState)
  };

  public shared query ({ caller }) func exportBackup() : async DirectoryTypes.Backup {
    ensureAdmin(caller);
    DirectoryLib.exportBackup(directoryState)
  };
};
