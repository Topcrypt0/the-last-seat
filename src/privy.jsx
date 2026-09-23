import { useEffect, useRef } from 'react';
import { PrivyProvider, usePrivy, getIdentityToken } from '@privy-io/react-auth';
import { api } from './runs.js';

// Email and X sign in through Privy. Only loaded when VITE_PRIVY_APP_ID is set.
// Privy proves who you are; after that the game keeps its own session.
function Buttons({ onSession, onMessage }) {
  const { ready, authenticated, login, user, getAccessToken, logout } = usePrivy();
  const busy = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || busy.current) return;
    busy.current = true;
    (async () => {
      try {
        const accessToken = await getAccessToken();
        const identityToken = await getIdentityToken().catch(() => null);
        const r = await api('/api/auth/privy', {
          method: 'POST',
          body: {
            accessToken,
            identityToken,
            email: user?.email?.address || '',
            xHandle: user?.twitter?.username || '',
          },
        });
        onSession(r.session, r.user);
        logout().catch(() => {});
      } catch (e) {
        onMessage(e.message);
      } finally {
        busy.current = false;
      }
    })();
  }, [ready, authenticated]);

  return (
    <>
      <button disabled={!ready} onClick={() => login({ loginMethods: ['email'] })}>
        Email
      </button>
      <button disabled={!ready} onClick={() => login({ loginMethods: ['twitter'] })}>
        X account
      </button>
    </>
  );
}

export default function PrivySignIn({ appId, onSession, onMessage }) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'twitter'],
        appearance: { theme: 'light', accentColor: '#7A2E2E', landingHeader: 'Sign in to The Last Seat' },
        embeddedWallets: { ethereum: { createOnLogin: 'off' } },
      }}
    >
      <Buttons onSession={onSession} onMessage={onMessage} />
    </PrivyProvider>
  );
}
