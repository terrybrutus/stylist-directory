import List "mo:core/List";
import Int "mo:core/Int";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Types "../types/directory";

module {
  public type State = {
    stylists : List.List<Types.Stylist>;
    requests : List.List<Types.ClientRequest>;
    audit : List.List<Types.AuditEvent>;
    var nextStylistId : Nat;
    var nextRequestId : Nat;
    var nextAuditId : Nat;
  };

  let noTime : Nat = 0;

  func now() : Nat { Int.abs(Time.now()) };

  func clean(value : Text) : Text {
    value.trim(#char ' ')
  };

  func normal(value : Text) : Text {
    clean(value).toLower()
  };

  func findStylistIndex(state : State, id : Nat) : ?Nat {
    state.stylists.findIndex(func(stylist) { stylist.id == id })
  };

  func findRequestIndex(state : State, id : Nat) : ?Nat {
    state.requests.findIndex(func(request) { request.id == id })
  };

  func addAudit(state : State, requestId : ?Nat, stylistId : ?Nat, kind : Text, detail : Text) {
    let event : Types.AuditEvent = {
      id = state.nextAuditId;
      requestId;
      stylistId;
      kind;
      detail;
      createdAt = now();
    };
    state.nextAuditId += 1;
    state.audit.add(event);
  };

  func hasService(stylist : Types.Stylist, service : Text) : Bool {
    let wanted = normal(service);
    for (preference in stylist.services.values()) {
      if (normal(preference.name) == wanted and normal(preference.level) != "avoid") return true;
    };
    false
  };

  func lovesService(stylist : Types.Stylist, service : Text) : Bool {
    let wanted = normal(service);
    for (preference in stylist.services.values()) {
      if (normal(preference.name) == wanted and normal(preference.level) == "love") return true;
    };
    false
  };

  func isAvailable(stylist : Types.Stylist, timing : Text, currentTime : Nat) : Bool {
    if (not stylist.active or not stylist.acceptsNewClients) return false;
    if (stylist.availabilityExpiresAt != noTime and stylist.availabilityExpiresAt <= currentTime) return false;
    let status = normal(stylist.availabilityStatus);
    if (status == "unavailable") return false;
    if (normal(timing) == "now") status == "now" else status == "now" or status == "later"
  };

  func comesBefore(left : Types.Stylist, right : Types.Stylist) : Bool {
    // The least-recently-booked stylist is at the front of the rotation.
    // Filtering someone out leaves this value untouched, preserving their turn.
    if (left.lastAssignedAt < right.lastAssignedAt) return true;
    if (left.lastAssignedAt > right.lastAssignedAt) return false;
    left.id < right.id
  };

  func selected(stylistId : Nat, selectedIds : [Nat]) : Bool {
    for (id in selectedIds.values()) {
      if (id == stylistId) return true;
    };
    false
  };

  func hasAvailabilitySelection(state : State, requestId : Nat) : Bool {
    state.audit.any(
      func(event) { event.requestId == ?requestId and event.kind == "availability.selected" },
    )
  };

  func selectedForRequest(state : State, requestId : Nat, stylistId : Nat) : Bool {
    state.audit.any(
      func(event) {
        event.requestId == ?requestId and event.stylistId == ?stylistId and event.kind == "availability.selected"
      },
    )
  };

  func skippedForRequest(state : State, requestId : Nat, stylistId : Nat) : Bool {
    state.audit.any(
      func(event) {
        event.requestId == ?requestId and event.stylistId == ?stylistId and event.kind == "request.turn_preserved"
      },
    )
  };

  func rankedEligible(state : State, input : Types.RouteInput, currentTime : Nat) : [Types.Stylist] {
    let eligible = state.stylists.filter(
      func(stylist) { isAvailable(stylist, input.timing, currentTime) and hasService(stylist, input.service) },
    );
    let pool = if (input.specialtyMatters) {
      let specialists = eligible.filter(func(stylist) { lovesService(stylist, input.service) });
      if (specialists.size() > 0) specialists else eligible
    } else eligible;
    List.toArray(pool.sort(func(left, right) {
      if (comesBefore(left, right)) #less else if (comesBefore(right, left)) #greater else #equal
    }))
  };

  func rankedSelected(state : State, input : Types.RouteInput, selectedIds : [Nat]) : [Types.Stylist] {
    let eligible = state.stylists.filter(
      func(stylist) {
        stylist.active and stylist.acceptsNewClients and selected(stylist.id, selectedIds) and hasService(stylist, input.service)
      },
    );
    eligible.sort(func(left, right) {
      if (comesBefore(left, right)) #less else if (comesBefore(right, left)) #greater else #equal
    }).toArray()
  };

  func rotationStamp(state : State) : Nat {
    var latest = now();
    for (stylist in state.stylists.values()) {
      if (stylist.lastAssignedAt >= latest) latest := stylist.lastAssignedAt + 1;
    };
    latest
  };

  func incrementOpportunity(state : State, stylistId : Nat) {
    switch (findStylistIndex(state, stylistId)) {
      case null {};
      case (?index) {
        let stylist = state.stylists.at(index);
        state.stylists.put(index, { stylist with eligibleOpportunities = stylist.eligibleOpportunities + 1; updatedAt = now(); revision = stylist.revision + 1 });
      };
    }
  };

  public func createStylist(state : State, input : Types.StylistInput) : Types.Stylist {
    if (clean(input.name) == "") { assert false };
    let timestamp = now();
    let stylist : Types.Stylist = {
      id = state.nextStylistId;
      name = clean(input.name);
      phone = clean(input.phone);
      services = input.services;
      availabilityStatus = input.availabilityStatus;
      availabilityNote = clean(input.availabilityNote);
      availabilityExpiresAt = input.availabilityExpiresAt;
      acceptsNewClients = input.acceptsNewClients;
      active = true;
      eligibleOpportunities = 0;
      assignments = 0;
      declines = 0;
      noResponses = 0;
      lastAssignedAt = 0;
      createdAt = timestamp;
      updatedAt = timestamp;
      revision = 1;
    };
    state.nextStylistId += 1;
    state.stylists.add(stylist);
    addAudit(state, null, ?stylist.id, "stylist.created", stylist.name # " was added");
    stylist
  };

  public func updateStylist(state : State, id : Nat, input : Types.StylistInput, expectedRevision : Nat) : Types.Stylist {
    let index = switch (findStylistIndex(state, id)) { case null { assert false; 0 }; case (?value) value };
    let existing = state.stylists.at(index);
    if (existing.revision != expectedRevision) { assert false };
    let updated : Types.Stylist = {
      existing with
      name = clean(input.name);
      phone = clean(input.phone);
      services = input.services;
      availabilityStatus = input.availabilityStatus;
      availabilityNote = clean(input.availabilityNote);
      availabilityExpiresAt = input.availabilityExpiresAt;
      acceptsNewClients = input.acceptsNewClients;
      updatedAt = now();
      revision = existing.revision + 1;
    };
    state.stylists.put(index, updated);
    addAudit(state, null, ?id, "stylist.updated", updated.name # "'s profile was updated");
    updated
  };

  public func setStylistActive(state : State, id : Nat, active : Bool, expectedRevision : Nat) : Types.Stylist {
    let index = switch (findStylistIndex(state, id)) { case null { assert false; 0 }; case (?value) value };
    let existing = state.stylists.at(index);
    if (existing.revision != expectedRevision) { assert false };
    let updated = { existing with active; updatedAt = now(); revision = existing.revision + 1 };
    state.stylists.put(index, updated);
    addAudit(state, null, ?id, if (active) "stylist.activated" else "stylist.archived", existing.name);
    updated
  };

  func route(state : State, input : Types.RouteInput, selectedIds : ?[Nat]) : Types.RoutingResult {
    if (clean(input.idempotencyKey) != "") {
      switch (state.requests.find(func(request) { request.idempotencyKey == input.idempotencyKey })) {
        case (?existing) return routingResult(state, existing);
        case null {};
      }
    };
    let timestamp = now();
    let ranked = switch (selectedIds) {
      case null rankedEligible(state, input, timestamp);
      case (?ids) rankedSelected(state, input, ids);
    };
    for (stylist in ranked.values()) { incrementOpportunity(state, stylist.id) };
    let recommendedId = if (ranked.size() > 0) ?ranked[0].id else null;
    let backupId = if (ranked.size() > 1) ?ranked[1].id else null;
    let explanation = switch (recommendedId) {
      case null "No stylist is currently eligible. Check availability or service settings.";
      case (?_id) {
        let selected = ranked[0];
        let fit = if (lovesService(selected, input.service)) "loves this service" else "performs this service";
        selected.name # " was marked available, " # fit # ", and is first in the current rotation."
      };
    };
    let request : Types.ClientRequest = {
      id = state.nextRequestId;
      idempotencyKey = clean(input.idempotencyKey);
      clientName = clean(input.clientName);
      service = clean(input.service);
      requestedTime = clean(input.requestedTime);
      timing = input.timing;
      specialtyMatters = input.specialtyMatters;
      notes = clean(input.notes);
      status = if (recommendedId == null) "unmatched" else "suggested";
      recommendedStylistId = recommendedId;
      backupStylistId = backupId;
      assignedStylistId = null;
      explanation;
      createdAt = timestamp;
      updatedAt = timestamp;
      revision = 1;
    };
    state.nextRequestId += 1;
    state.requests.add(request);
    addAudit(state, ?request.id, recommendedId, "request.routed", explanation);
    routingResult(state, request)
  };

  public func routeClient(state : State, input : Types.RouteInput) : Types.RoutingResult {
    route(state, input, null)
  };

  public func routeAppointment(state : State, input : Types.AppointmentInput) : Types.RoutingResult {
    if (clean(input.service) == "" or input.availableStylistIds.size() == 0) { assert false };
    let routeInput : Types.RouteInput = {
      idempotencyKey = input.idempotencyKey;
      clientName = input.clientName;
      service = input.service;
      requestedTime = input.requestedTime;
      timing = "staff_selected";
      specialtyMatters = false;
      notes = input.notes;
    };
    let result = route(state, routeInput, ?input.availableStylistIds);
    if (not hasAvailabilitySelection(state, result.request.id)) {
      for (stylist in state.stylists.values()) {
        if (selected(stylist.id, input.availableStylistIds)) {
          addAudit(state, ?result.request.id, ?stylist.id, "availability.selected", stylist.name # " was marked free after checking Booksy");
        };
      };
    };
    result
  };

  func routingResult(state : State, request : Types.ClientRequest) : Types.RoutingResult {
    {
      request;
      recommended = switch (request.recommendedStylistId) { case null null; case (?id) state.stylists.find(func(stylist) { stylist.id == id }) };
      backup = switch (request.backupStylistId) { case null null; case (?id) state.stylists.find(func(stylist) { stylist.id == id }) };
    }
  };

  public func assignRequest(state : State, requestId : Nat, stylistId : Nat, expectedRevision : Nat, note : Text) : Types.ClientRequest {
    let requestIndex = switch (findRequestIndex(state, requestId)) { case null { assert false; 0 }; case (?value) value };
    let existing = state.requests.at(requestIndex);
    if (existing.revision != expectedRevision) { assert false };
    switch (existing.assignedStylistId) {
      case (?alreadyAssigned) { if (alreadyAssigned == stylistId) return existing else assert false };
      case null {};
    };
    if (existing.status != "suggested") { assert false };
    if (existing.recommendedStylistId != ?stylistId and clean(note) == "") { assert false };
    let stylistIndex = switch (findStylistIndex(state, stylistId)) { case null { assert false; 0 }; case (?value) value };
    let stylist = state.stylists.at(stylistIndex);
    let timestamp = now();
    let nextTurn = rotationStamp(state);
    let updatedStylist = { stylist with assignments = stylist.assignments + 1; lastAssignedAt = nextTurn; updatedAt = timestamp; revision = stylist.revision + 1 };
    state.stylists.put(stylistIndex, updatedStylist);
    let updatedRequest = {
      existing with
      status = "confirmed";
      assignedStylistId = ?stylistId;
      updatedAt = timestamp;
      revision = existing.revision + 1;
    };
    state.requests.put(requestIndex, updatedRequest);
    let eventKind = if (existing.recommendedStylistId == ?stylistId) "request.confirmed" else "request.overridden";
    addAudit(state, ?requestId, ?stylistId, eventKind, stylist.name # " received the client" # (if (clean(note) == "") "" else ": " # clean(note)));
    updatedRequest
  };

  public func useBackup(state : State, requestId : Nat, expectedRevision : Nat, reason : Text) : Types.RoutingResult {
    let requestIndex = switch (findRequestIndex(state, requestId)) { case null { assert false; 0 }; case (?value) value };
    let existing = state.requests.at(requestIndex);
    if (existing.revision != expectedRevision) { assert false };
    let oldRecommended = existing.recommendedStylistId;
    let ranked = if (hasAvailabilitySelection(state, requestId)) {
      state.stylists.filter(
        func(stylist) {
          stylist.active and stylist.acceptsNewClients and hasService(stylist, existing.service) and selectedForRequest(state, requestId, stylist.id) and not skippedForRequest(state, requestId, stylist.id) and oldRecommended != ?stylist.id
        },
      ).sort(func(left, right) {
        if (comesBefore(left, right)) #less else if (comesBefore(right, left)) #greater else #equal
      }).toArray()
    } else {
      switch (existing.backupStylistId) {
        case null [];
        case (?id) state.stylists.filter(func(stylist) { stylist.id == id }).toArray();
      }
    };
    let nextId = if (ranked.size() > 0) ?ranked[0].id else null;
    let backupId = if (ranked.size() > 1) ?ranked[1].id else null;
    let updated = {
      existing with
      recommendedStylistId = nextId;
      backupStylistId = backupId;
      explanation = switch (nextId) { case null "No additional eligible stylist is available."; case (?_id) "The next Booksy-available stylist in the saved rotation is now recommended." };
      status = if (nextId == null) "unmatched" else "suggested";
      updatedAt = now();
      revision = existing.revision + 1;
    };
    state.requests.put(requestIndex, updated);
    addAudit(state, ?requestId, oldRecommended, "request.turn_preserved", if (clean(reason) == "") "Stylist was skipped and kept their place" else clean(reason));
    routingResult(state, updated)
  };

  public func setRequestStatus(state : State, requestId : Nat, status : Text, expectedRevision : Nat, reason : Text) : Types.ClientRequest {
    let index = switch (findRequestIndex(state, requestId)) { case null { assert false; 0 }; case (?value) value };
    let existing = state.requests.at(index);
    if (existing.revision != expectedRevision) { assert false };
    let nextStatus = normal(status);
    let allowed = switch (existing.status, nextStatus) {
      case ("confirmed", "completed") true;
      case ("confirmed", "cancelled") true;
      case ("suggested", "cancelled") true;
      case ("unmatched", "cancelled") true;
      case _ false;
    };
    if (not allowed) { assert false };
    if (nextStatus == "cancelled" and normal(reason) == "client_cancelled") {
      switch (existing.assignedStylistId) {
        case null {};
        case (?stylistId) {
          switch (findStylistIndex(state, stylistId)) {
            case null {};
            case (?stylistIndex) {
              let stylist = state.stylists.at(stylistIndex);
              let assignments : Nat = if (stylist.assignments == 0) 0 else stylist.assignments - 1;
              // A cancelled or mistaken booking must not cost the stylist a turn.
              state.stylists.put(stylistIndex, { stylist with assignments; lastAssignedAt = 0; updatedAt = now(); revision = stylist.revision + 1 });
            };
          }
        };
      }
    };
    if (nextStatus == "cancelled" and normal(reason) == "stylist_cancelled") {
      switch (existing.assignedStylistId) {
        case null {};
        case (?stylistId) {
          switch (findStylistIndex(state, stylistId)) {
            case null {};
            case (?stylistIndex) {
              let stylist = state.stylists.at(stylistIndex);
              state.stylists.put(stylistIndex, { stylist with declines = stylist.declines + 1; updatedAt = now(); revision = stylist.revision + 1 });
            };
          }
        };
      }
    };
    let updated = { existing with status = nextStatus; updatedAt = now(); revision = existing.revision + 1 };
    state.requests.put(index, updated);
    addAudit(state, ?requestId, existing.assignedStylistId, "request." # normal(status), if (clean(reason) == "") "Status updated" else clean(reason));
    updated
  };

  public func dashboard(state : State) : Types.Dashboard {
    {
      stylists = state.stylists.toArray();
      requests = state.requests.toArray();
      audit = state.audit.toArray();
    }
  };

  public func exportBackup(state : State) : Types.Backup {
    { version = 1; exportedAt = now(); dashboard = dashboard(state) }
  };
};
