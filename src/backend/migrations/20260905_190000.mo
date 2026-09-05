import List "mo:core/List";
import Map "mo:core/Map";
import Principal "mo:core/Principal";

module {
  type ServicePreference = { name : Text; level : Text };

  type Stylist = {
    id : Nat;
    name : Text;
    phone : Text;
    services : [ServicePreference];
    availabilityStatus : Text;
    availabilityNote : Text;
    availabilityExpiresAt : Nat;
    acceptsNewClients : Bool;
    active : Bool;
    eligibleOpportunities : Nat;
    assignments : Nat;
    declines : Nat;
    noResponses : Nat;
    lastAssignedAt : Nat;
    createdAt : Nat;
    updatedAt : Nat;
    revision : Nat;
  };

  type ClientRequest = {
    id : Nat;
    idempotencyKey : Text;
    clientName : Text;
    service : Text;
    requestedTime : Text;
    timing : Text;
    specialtyMatters : Bool;
    notes : Text;
    status : Text;
    recommendedStylistId : ?Nat;
    backupStylistId : ?Nat;
    assignedStylistId : ?Nat;
    explanation : Text;
    createdAt : Nat;
    updatedAt : Nat;
    revision : Nat;
  };

  type AuditEvent = {
    id : Nat;
    requestId : ?Nat;
    stylistId : ?Nat;
    kind : Text;
    detail : Text;
    createdAt : Nat;
  };

  type UserRole = {
    #admin;
    #user;
    #guest;
  };

  type AccessControlState = {
    var adminAssigned : Bool;
    userRoles : Map.Map<Principal, UserRole>;
  };

  type LegacyStylist = {
    name : Text;
    specialty : Text;
    availability : Text;
  };

  type DirectoryState = {
    stylists : List.List<Stylist>;
    requests : List.List<ClientRequest>;
    audit : List.List<AuditEvent>;
    var nextStylistId : Nat;
    var nextRequestId : Nat;
    var nextAuditId : Nat;
  };

  type OldActor = {
    accessControlState : AccessControlState;
    stylists : List.List<LegacyStylist>;
  };

  type NewActor = {
    accessControlState : AccessControlState;
    stylists : List.List<LegacyStylist>;
    directoryState : DirectoryState;
  };

  public func migration(old : OldActor) : NewActor {
    let records = List.empty<Stylist>();
    var nextId = 1;
    for (legacy in old.stylists.values()) {
      records.add({
        id = nextId;
        name = legacy.name;
        phone = "";
        services = [{ name = legacy.specialty; level = "love" }];
        availabilityStatus = "later";
        availabilityNote = legacy.availability;
        availabilityExpiresAt = 0;
        acceptsNewClients = true;
        active = true;
        eligibleOpportunities = 0;
        assignments = 0;
        declines = 0;
        noResponses = 0;
        lastAssignedAt = 0;
        createdAt = 0;
        updatedAt = 0;
        revision = 1;
      });
      nextId += 1;
    };
    {
      accessControlState = old.accessControlState;
      stylists = old.stylists;
      directoryState = {
        stylists = records;
        requests = List.empty();
        audit = List.empty();
        var nextStylistId = nextId;
        var nextRequestId = 1;
        var nextAuditId = 1;
      };
    }
  };
};
