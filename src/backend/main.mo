import List "mo:core/List";
import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import Expose "mo:caffeineai-oql/Expose";
import Entity "mo:caffeineai-oql/Entity";
import ListEntity "mo:caffeineai-oql/ListEntity";
import RecordValue "mo:caffeineai-oql/RecordValue";
import TextValue "mo:caffeineai-oql/TextValue";
import Types "types/stylists";
import StylistsApi "mixins/stylists-api";
import ApiDocMixin "mixins/api-doc";

actor {
  let accessControlState : AccessControl.AccessControlState;
  let stylists : List.List<Types.Stylist>;
  include MixinAuthorization(accessControlState, null);
  include StylistsApi(stylists);
  include Expose({
    entities = [
      stylists.toEntity("stylist", "Stylist", "name")
        .sample({ name = ""; specialty = ""; availability = "" })
        .public_()
        .build()
    ];
  });
  include ApiDocMixin();
};
