"use client";
import { useEffect, useState } from "react";
import {
  changeMyPassword,
  hasStoredSession,
  isAdmin,
  signOut,
  supabase,
} from "@/lib/browser-auth";

// Editing happens on the site itself; this page only signs the owner in.
const EDIT_URL = "/?editar=1";

type View = "loading" | "login" | "demo" | "recovery";

export default function Admin() {
  const [state, setState] = useState<View>("loading"),
    [mode, setMode] = useState<"supabase" | "password">("supabase"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false);

  // After sign-in or on session restore: only accounts that administer this site stay in.
  async function admit(): Promise<boolean> {
    if (await isAdmin()) {
      location.replace(EDIT_URL);
      return true;
    }
    await signOut();
    setMsg("Esta conta não administra este site.");
    setState("login");
    setBusy(false);
    return false;
  }

  useEffect(() => {
    let off: (() => void) | undefined;
    fetch("/api/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then(async (a) => {
        if (a.demoMode) return setState("demo");
        if (a.login === "password") {
          setMode("password");
          if (a.authenticated) location.replace(EDIT_URL);
          else setState("login");
          return;
        }
        // Recovery links arrive with a token in the URL; supabase-js turns it into a session.
        const recovering = /type=recovery/.test(location.hash + location.search);
        if (recovering || hasStoredSession()) {
          const db = await supabase();
          const { data } = db.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY") {
              setMsg("");
              setState("recovery");
            }
          });
          off = () => data.subscription.unsubscribe();
          if (recovering) {
            setState("recovery");
            return;
          }
          if (await isAdmin(db)) return location.replace(EDIT_URL);
          await signOut();
        }
        setState("login");
      })
      .catch(() => {
        setState("login");
        setMsg("Não foi possível verificar a sessão.");
      });
    return () => off?.();
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      if (mode === "password") {
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (!res.ok) throw Error((await res.json()).error || "Não foi possível entrar.");
        return location.replace(EDIT_URL);
      }
      const db = await supabase();
      const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw Error("E-mail ou senha incorretos.");
      await admit();
    } catch (e) {
      setMsg((e as Error).message);
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email.trim()) return setMsg("Informe seu e-mail e clique de novo em “Esqueci minha senha”.");
    setBusy(true);
    const { error } = await (await supabase()).auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/admin`,
    });
    setBusy(false);
    setMsg(
      error
        ? "Não foi possível enviar o e-mail agora. Tente de novo em instantes."
        : "Se o e-mail estiver cadastrado, enviamos um link para criar uma nova senha.",
    );
  }

  async function recover(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) return setMsg("Use ao menos 10 caracteres.");
    if (password !== confirm) return setMsg("As senhas não coincidem.");
    setBusy(true);
    try {
      await changeMyPassword(password);
      history.replaceState(null, "", "/admin");
      await admit();
    } catch (e) {
      setMsg((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell min-h-screen cad-grid-bg grid place-items-center p-5">
      {state === "demo" ? (
        <section className="max-w-xl space-y-6">
          <img
            className="admin-logo h-16"
            src="/assets/logo-usibar-light.webp"
            alt="Usibar"
          />
          <h1 className="text-3xl font-display">Demonstração do site</h1>
          <p>
            O catálogo e a apresentação estão disponíveis para consulta. A
            edição de produtos e o envio de imagens ficam disponíveis na
            instalação local.
          </p>
          <a href="/" className="inline-block border border-current px-5 py-3">
            Voltar ao site ↗
          </a>
        </section>
      ) : (
        <form
          onSubmit={state === "recovery" ? recover : login}
          aria-busy={state === "loading"}
          className="w-full max-w-md p-8 rounded-2xl bg-steel-900 border border-steel-700 space-y-6"
        >
          <a href="/" className="text-usibar text-sm">
            ← Voltar ao site
          </a>
          <img
            src="/assets/logo-usibar-light.webp"
            alt="Usibar"
            className="admin-logo h-16 mx-auto"
          />
          <div className="space-y-2">
            <h1 className="text-2xl font-display">Editar o site</h1>
            <p className="text-sm">
              Após entrar, você volta à página inicial com o modo de edição
              ativo: clique nos textos destacados para alterá-los e use a barra
              inferior para cadastrar peças.
            </p>
          </div>
          {mode === "supabase" && state !== "recovery" && (
            <label className="block space-y-2">
              <span>E-mail</span>
              <input
                className="w-full px-4 py-3 rounded-lg bg-steel-950 border border-steel-700 text-white"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={state === "loading"}
                required
              />
            </label>
          )}
          <label className="block space-y-2">
            <span>
              {state === "recovery" ? "Nova senha (mín. 10 caracteres)" : mode === "supabase" ? "Senha" : "Senha de acesso"}
            </span>
            <input
              className="w-full px-4 py-3 rounded-lg bg-steel-950 border border-steel-700 text-white"
              type="password"
              autoComplete={state === "recovery" ? "new-password" : "current-password"}
              minLength={state === "recovery" ? 10 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={state === "loading"}
              required
            />
          </label>
          {state === "recovery" && (
            <label className="block space-y-2">
              <span>Confirmar nova senha</span>
              <input
                className="w-full px-4 py-3 rounded-lg bg-steel-950 border border-steel-700 text-white"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </label>
          )}
          <button
            disabled={busy || state === "loading"}
            className="w-full bg-usibar p-3 rounded-lg font-bold"
          >
            {state === "recovery" ? (busy ? "Salvando..." : "Definir nova senha") : busy ? "Entrando..." : "Entrar e editar"}
          </button>
          {mode === "supabase" && state === "login" && (
            <button type="button" onClick={forgot} disabled={busy} className="text-usibar text-sm underline">
              Esqueci minha senha
            </button>
          )}
          <p role="status" className="text-sm text-usibar">
            {msg}
          </p>
        </form>
      )}
    </main>
  );
}
