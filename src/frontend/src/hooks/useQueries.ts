import { type RouteInput, type StylistInput, createActor } from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const DIRECTORY_KEY = ["directory"] as const;

export function useInitializeAccess() {
  const { actor, isFetching } = useActor(createActor);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("The secure workspace is not ready yet.");
      await actor._initialize_access_control();
      return actor.getCallerUserRole();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DIRECTORY_KEY });
    },
  });
  return {
    ...mutation,
    isActorReady: !!actor && !isFetching,
  };
}

export function useDirectory(enabled = true) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: DIRECTORY_KEY,
    queryFn: async () => {
      if (!actor) throw new Error("The secure workspace is not ready yet.");
      return actor.getDashboard();
    },
    enabled: enabled && !!actor && !isFetching,
    retry: false,
  });
}

type Actor = ReturnType<typeof createActor>;

function useDirectoryMutation<TVariables, TResult>(
  action: (actor: Actor, variables: TVariables) => Promise<TResult>,
) {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: TVariables) => {
      if (!actor) throw new Error("The secure workspace is not ready yet.");
      return action(actor, variables);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DIRECTORY_KEY });
    },
  });
}

export function useCreateStylist() {
  return useDirectoryMutation<StylistInput, unknown>((actor, input) =>
    actor.createStylist(input),
  );
}

export function useUpdateStylist() {
  return useDirectoryMutation<
    { id: bigint; input: StylistInput; revision: bigint },
    unknown
  >((actor, variables) =>
    actor.updateStylist(variables.id, variables.input, variables.revision),
  );
}

export function useSetStylistActive() {
  return useDirectoryMutation<
    { id: bigint; active: boolean; revision: bigint },
    unknown
  >((actor, variables) =>
    actor.setStylistActive(variables.id, variables.active, variables.revision),
  );
}

export function useRouteClient() {
  return useDirectoryMutation<
    RouteInput,
    Awaited<ReturnType<Actor["routeClient"]>>
  >((actor, input) => actor.routeClient(input));
}

export function useAssignRequest() {
  return useDirectoryMutation<
    { requestId: bigint; stylistId: bigint; revision: bigint; note?: string },
    unknown
  >((actor, variables) =>
    actor.assignRequest(
      variables.requestId,
      variables.stylistId,
      variables.revision,
      variables.note ?? "",
    ),
  );
}

export function useBackupRecommendation() {
  return useDirectoryMutation<
    { requestId: bigint; revision: bigint; reason: string },
    Awaited<ReturnType<Actor["useBackup"]>>
  >((actor, variables) => {
    const chooseBackup = actor.useBackup.bind(actor);
    return chooseBackup(
      variables.requestId,
      variables.revision,
      variables.reason,
    );
  });
}

export function useSetRequestStatus() {
  return useDirectoryMutation<
    { requestId: bigint; status: string; revision: bigint; reason?: string },
    unknown
  >((actor, variables) =>
    actor.setRequestStatus(
      variables.requestId,
      variables.status,
      variables.revision,
      variables.reason ?? "",
    ),
  );
}

export function useExportBackup() {
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("The secure workspace is not ready yet.");
      return actor.exportBackup();
    },
  });
}
