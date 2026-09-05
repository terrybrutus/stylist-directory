module {
  public type ServicePreference = {
    name : Text;
    level : Text;
  };

  public type StylistInput = {
    name : Text;
    phone : Text;
    services : [ServicePreference];
    availabilityStatus : Text;
    availabilityNote : Text;
    availabilityExpiresAt : Nat;
    acceptsNewClients : Bool;
  };

  public type Stylist = {
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

  public type RouteInput = {
    idempotencyKey : Text;
    clientName : Text;
    service : Text;
    requestedTime : Text;
    timing : Text;
    specialtyMatters : Bool;
    notes : Text;
  };

  public type ClientRequest = {
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

  public type RoutingResult = {
    request : ClientRequest;
    recommended : ?Stylist;
    backup : ?Stylist;
  };

  public type AuditEvent = {
    id : Nat;
    requestId : ?Nat;
    stylistId : ?Nat;
    kind : Text;
    detail : Text;
    createdAt : Nat;
  };

  public type Dashboard = {
    stylists : [Stylist];
    requests : [ClientRequest];
    audit : [AuditEvent];
  };

  public type Backup = {
    version : Nat;
    exportedAt : Nat;
    dashboard : Dashboard;
  };
};
