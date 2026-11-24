import "../styles/app.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { useAuthSession } from "../features/auth/hooks/useAuthSession";
import { CurrentUserIdContext } from "../lib/auth/sessionContext";
import { queryClient } from "../lib/query/queryClient";
import AppRouter from "./AppRouter";
import PreferencesProvider from "./PreferencesProvider";
import { useSessionCache } from "./useSessionCache";

function App() {
  const { session, authReady, passwordRecovery, linkError, dismissLinkError } = useAuthSession();
  const userId = session?.user.id ?? null;
  useSessionCache(userId, queryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <CurrentUserIdContext.Provider value={userId}>
        <PreferencesProvider>
          <AppRouter
            session={session}
            authReady={authReady}
            passwordRecovery={passwordRecovery}
            linkError={linkError}
            onLinkErrorShown={dismissLinkError}
          />
        </PreferencesProvider>
      </CurrentUserIdContext.Provider>
    </QueryClientProvider>
  );
}

export default App;
