import List "mo:core/List";
import Map "mo:core/Map";
import Principal "mo:core/Principal";

module {
  type UserRole = {
    #admin;
    #user;
    #guest;
  };

  type AccessControlState = {
    var adminAssigned : Bool;
    userRoles : Map.Map<Principal, UserRole>;
  };

  type Stylist = {
    name : Text;
    specialty : Text;
    availability : Text;
  };

  type OldActor = {};

  type NewActor = {
    accessControlState : AccessControlState;
    stylists : List.List<Stylist>;
  };

  public func migration(_old : OldActor) : NewActor {
    {
      accessControlState = {
        var adminAssigned = false;
        userRoles = Map.empty();
      };
      stylists = List.empty();
    };
  };
};
