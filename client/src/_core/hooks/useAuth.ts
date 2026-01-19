import { useAuth as useSupabaseAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { user, loading, signOut } = useSupabaseAuth();
  const utils = trpc.useUtils();

  // We still use the meQuery to get any additional user data from our DB
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !!user,
  });

  const logout = useCallback(async () => {
    await signOut();
    utils.auth.me.setData(undefined, null);
    await utils.auth.me.invalidate();
  }, [signOut, utils]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: loading || meQuery.isLoading,
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(user),
    };
  }, [user, loading, meQuery.data, meQuery.error, meQuery.isLoading]);

  return {
    ...state,
    supabaseUser: user,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
