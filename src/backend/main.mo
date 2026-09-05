import List "mo:core/List";
import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import Types "types/stylists";
import DirectoryLib "lib/directory";
import StylistsApi "mixins/stylists-api";
import ApiDocMixin "mixins/api-doc";

actor {
  let accessControlState : AccessControl.AccessControlState;
  let stylists : List.List<Types.Stylist>;
  let directoryState : DirectoryLib.State;
  include MixinAuthorization(accessControlState, null);
  include StylistsApi(stylists, directoryState, accessControlState);
  include ApiDocMixin();
};
