import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiRequestError } from "../api/client";
import { GoogleSignInButton } from "../components/GoogleSignInButton";

export function LoginPage() {
  const { login, loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    const to = (location.state as { from?: string } | null)?.from || "/";
    navigate(to, { replace: true });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogleCredential(idToken: string) {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle(idToken);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-[380px] rounded-card border border-line bg-surface p-8 shadow-card">
        <h1 className="mb-[0.3rem] text-[1.4rem] font-bold">Welcome back</h1>
        <p className="mb-6 text-[0.88rem] text-ink-soft">Log in to your Mind Constructor maps.</p>
        {error && (
          <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
        )}
        <form onSubmit={onSubmit}>
          <div className="mb-4 flex flex-col gap-[0.35rem]">
            <label htmlFor="email" className="text-[0.8rem] font-semibold text-ink-soft">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
            />
          </div>
          <div className="mb-4 flex flex-col gap-[0.35rem]">
            <label htmlFor="password" className="text-[0.8rem] font-semibold text-ink-soft">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
            />
          </div>
          <button
            className="inline-flex w-full cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-4 py-[0.55rem] text-[0.88rem] font-semibold text-white transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={busy}
          >
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>
        <div className="my-4 flex items-center gap-3 text-[0.75rem] text-ink-soft before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
          or
        </div>
        <div className="flex justify-center">
          <GoogleSignInButton onCredential={onGoogleCredential} />
        </div>
        <div className="mt-4 text-center text-[0.85rem] text-ink-soft">
          No account? <Link to="/register">Register</Link>
        </div>
      </div>
    </div>
  );
}
