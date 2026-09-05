import { type Stylist, createActor } from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useStylists() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["stylists"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getStylists();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddStylist() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stylist: Stylist) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.addStylist(stylist);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stylists"] });
    },
  });
}
