import { useEffect, useRef } from "react";

// Google Identity Services' own runtime shape — there's no first-party
// npm package for this (the script tag in index.html is the only supported
// way to load it), so this is a minimal ambient type for just the two
// calls this component actually makes rather than pulling in a full
// community @types package for one button.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }): void;
          renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
        };
      };
    };
  }
}

// Same client id the backend's GOOGLE_CLIENT_ID must match — see
// authAbl.ts's googleAuthAbl, which verifies every ID token's `aud` claim
// against that one. Read once at module scope: this never changes at
// runtime, unlike VITE_API_URL there's nothing per-environment to swap
// beyond build time.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

interface Props {
  /** Fired with the raw Google ID token once the user picks an account — hand this straight to authApi.googleLogin, never decoded/trusted client-side (the backend is the one thing that actually verifies it). */
  onCredential: (idToken: string) => void;
}

// Renders Google's own "Sign in with Google" button into a div it owns —
// GIS draws its own iframe/button chrome, so there's no styling this
// beyond the few options renderButton itself takes (theme/size/width).
// Silently renders nothing if VITE_GOOGLE_CLIENT_ID was never configured,
// rather than throwing — a dev environment that hasn't set up Google OAuth
// yet should still be able to log in with a plain password.
export function GoogleSignInButton({ onCredential }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Read via a ref inside the effect instead of listing onCredential as a
  // dependency: LoginPage/RegisterPage each pass a fresh inline arrow
  // function on every render, and re-running this effect would call
  // Google's own initialize()/renderButton() again on every keystroke in
  // the form next to it — wasteful, and briefly flashes the button. The
  // effect below runs exactly once (mount); the ref always reads whatever
  // the latest onCredential prop actually is when a sign-in completes.
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | undefined;

    function render() {
      if (cancelled || !containerRef.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID as string,
        callback: (response) => onCredentialRef.current(response.credential),
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
      });
    }

    if (window.google) {
      render();
    } else {
      // index.html loads the GIS script with async/defer — it can still be
      // in flight by the time this component mounts (a fast reload, a slow
      // connection), so poll briefly rather than assuming it's ready.
      pollId = setInterval(() => {
        if (window.google) {
          clearInterval(pollId);
          render();
        }
      }, 100);
    }

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
    };
  }, []);

  if (!CLIENT_ID) return null;

  return <div ref={containerRef} />;
}
