"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiJSON } from "../lib/investigation";
import { validateAccount, type Account } from "../lib/account";
const AccountContext = createContext<{
  account: Account | null;
  setAccount: (value: Account | null) => void;
}>({ account: null, setAccount: () => {} });
export const useAccount = () => useContext(AccountContext);
export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [message, setMessage] = useState(
      "Account tokens stay in memory. Sign in again after reload.",
    ),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const code = new URLSearchParams(window.location.hash.slice(1)).get(
      "oauth",
    );
    if (!code) return;
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    setBusy(true);
    void apiJSON(
      "/v1/auth/google/complete",
      null,
      { code },
      undefined,
      15000,
      "include",
    )
      .then((r) => {
        setAccount(validateAccount(r));
        setMessage("Signed in with Google.");
      })
      .catch((e: unknown) =>
        setMessage(e instanceof Error ? e.message : "OAUTH_REJECTED"),
      )
      .finally(() => setBusy(false));
  }, []);
  async function submit(action: "login" | "signup") {
    setBusy(true);
    try {
      const r = await apiJSON(`/v1/auth/${action}`, null, { email, password });
      setAccount(validateAccount(r));
      setPassword("");
      setMessage("Signed in. Account history is available below.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "AUTH_FAILED");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }
  async function logout() {
    if (!account) return;
    setBusy(true);
    try {
      await apiJSON("/v1/auth/logout", account.token, {});
      setAccount(null);
      setMessage("Signed out. Local datasets remain in this browser session.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "LOGOUT_FAILED");
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    setBusy(true);
    try {
      const r = await apiJSON(
        "/v1/auth/google/start",
        null,
        {},
        undefined,
        15000,
        "include",
      );
      if (
        typeof r.url !== "string" ||
        new URL(r.url).origin !== "https://accounts.google.com"
      )
        throw new Error("INVALID_OAUTH_URL");
      window.location.assign(r.url);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "OAUTH_REJECTED");
      setBusy(false);
    }
  }
  return (
    <AccountContext.Provider value={{ account, setAccount }}>
      <section className="panel" aria-label="Account">
        <details>
          <summary>
            {account
              ? `Signed in as ${account.email}`
              : "Account — sign in or create an account"}
          </summary>
          {account ? (
            <button onClick={logout} disabled={busy}>
              Log out
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit("login");
              }}
            >
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={12}
                  maxLength={256}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
              </label>
              <div className="actions">
                <button disabled={busy}>Log in</button>
                <button
                  type="button"
                  disabled={busy || !email || password.length < 12}
                  onClick={() => submit("signup")}
                >
                  Create account
                </button>
                <button type="button" disabled={busy} onClick={google}>
                  Continue with Google
                </button>
              </div>
            </form>
          )}
          <p role="status">{message}</p>
        </details>
      </section>
      {children}
    </AccountContext.Provider>
  );
}
