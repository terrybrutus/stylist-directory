import List "mo:core/List";
import Types "../types/stylists";
import StylistsLib "../lib/stylists";

mixin (stylists : List.List<Types.Stylist>) {
  public shared func addStylist(stylist : Types.Stylist) : async () {
    StylistsLib.addStylist(stylists, stylist);
  };

  public query func getStylists() : async [Types.Stylist] {
    StylistsLib.getStylists(stylists);
  };
};
