import { useEffect, useRef } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { api } from './runs.js';

// Email sign in through Privy. Only loaded when VITE_PRIVY_APP_ID is set.
function Inner({ onSession, onMessage }) {
  const { ready, authenticated, login, user, getAccessToken, logout } = usePrivy();
  const busy = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || busy.current) return;
    busy.current = true;
    (async () => {
      try {
        const accessToken = await getAccessToken();
        const r = await api('/api/auth/privy', {
          method: 'POST',
          body: { accessToken, email: user?.email?.address || '' },
        });
        onSession(r.session, r.user);
        // our own session is kept, the Privy one is not needed any more
        logout().catch(() => {});
      } catch (e) {
        onMessage(e.message);
      } finally {
        busy.current = false;
      }
    })();
  }, [ready, authenticated]);

  return (
    <button disabled={!ready} onClick={() => login()}>
      Email
    </button>
  );
}

export default function EmailSignIn({ appId, onSession, onMessage }) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email'],
        appearance: { theme: 'light', accentColor: '#7A2E2E', landingHeader: 'Sign in to The Last Seat' },
        embeddedWallets: { ethereum: { createOnLogin: 'off' } },
      }}
    >
      <Inner onSession={onSession} onMessage={onMessage} />
    </PrivyProvider>
  );
}
