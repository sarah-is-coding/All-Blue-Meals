import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, type RenderOptions } from "@testing-library/react";
import { CurrentUserIdContext } from "../../lib/auth/sessionContext";
import { STALE_TIME_MS } from "../../lib/query/queryClient";

export const TEST_USER_ID = "test-user";

/** A fresh cache per test, with the app's freshness window so cached data
 *  behaves as it does for real users. No retries, so errors show immediately. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: STALE_TIME_MS } },
  });
}

type ProviderOptions = { client?: QueryClient; userId?: string | null };

function makeWrapper(client: QueryClient, userId: string | null) {
  return function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <CurrentUserIdContext.Provider value={userId}>{children}</CurrentUserIdContext.Provider>
      </QueryClientProvider>
    );
  };
}

/** render() with the app's providers: a query cache and a signed-in test user. */
export function renderWithProviders(
  ui: ReactElement,
  { client = createTestQueryClient(), userId = TEST_USER_ID, ...options }: ProviderOptions &
    Omit<RenderOptions, "wrapper"> = {}
) {
  return { client, ...render(ui, { wrapper: makeWrapper(client, userId), ...options }) };
}

/** renderHook() with the same providers. */
export function renderHookWithProviders<Result, Props>(
  hook: (props: Props) => Result,
  {
    client = createTestQueryClient(),
    userId = TEST_USER_ID,
    initialProps,
  }: ProviderOptions & { initialProps?: Props } = {}
) {
  return {
    client,
    ...renderHook(hook, { wrapper: makeWrapper(client, userId), initialProps }),
  };
}
