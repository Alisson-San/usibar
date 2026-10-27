"use client";
import { useEffect, useState } from "react";

// Editing happens on the site itself; this page only signs the owner in.
const EDIT_URL = "/?editar=1";

export default function Admin() {
  const [state, setState] = useState<"loading" | "login" | "demo">("loading"),
    [password, setPassword] = useState(""),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((a) => {
        if (a.demoMode) setState("demo");
        else if (a.authenticated) location.replace(EDIT_URL);
        else setState("login");
      })
      .catch(() => {
        setState("login");
        setMsg("Não foi possível verificar a sessão.");
      });
  }, []);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok)
        throw Error((await res.json()).error || "Não foi possível entrar.");
      location.replace(EDIT_URL);
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
          onSubmit={login}
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
          <label className="block space-y-2">
            <span>Senha de acesso</span>
            <input
              className="w-full px-4 py-3 rounded-lg bg-steel-950 border border-steel-700 text-white"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={state === "loading"}
              required
            />
          </label>
          <button
            disabled={busy || state === "loading"}
            className="w-full bg-usibar p-3 rounded-lg font-bold"
          >
            {busy ? "Entrando..." : "Entrar e editar"}
          </button>
          <p role="status" className="text-sm text-usibar">
            {msg}
          </p>
        </form>
      )}
    </main>
  );
}
