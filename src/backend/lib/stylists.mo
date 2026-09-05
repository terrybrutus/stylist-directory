import List "mo:core/List";
import Types "../types/stylists";

module {
  public func addStylist(stylists : List.List<Types.Stylist>, stylist : Types.Stylist) : () {
    stylists.add(stylist);
  };

  public func getStylists(stylists : List.List<Types.Stylist>) : [Types.Stylist] {
    stylists.toArray();
  };
};
