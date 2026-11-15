import "../styles/app.css";
import { useAuthSession } from "../features/auth/hooks/useAuthSession";
import AppRouter from "./AppRouter";

function App() {
  const { session, authReady, passwordRecovery, linkError, dismissLinkError } = useAuthSession();
  return (
    <AppRouter
      session={session}
      authReady={authReady}
      passwordRecovery={passwordRecovery}
      linkError={linkError}
      onLinkErrorShown={dismissLinkError}
    />
  );
}

export default App;
