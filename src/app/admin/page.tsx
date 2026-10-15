"use client";
import { useEffect, useState, useRef } from "react";
const blank = {
  id: "",
  title: "",
  code: "",
  category: "cilindros",
  specs: "Usinagem CNC • Sob medida",
  description:
    "Componente fabricado sob medida pela Usibar Usinagens Especiais.",
  featured: false,
  imageUrl: "",
};
export default function Admin() {
  const [demoMode, setDemoMode] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [logged, setLogged] = useState(false),
    [password, setPassword] = useState(""),
    [company, setCompany] = useState<any>(null),
    [products, setProducts] = useState<any[]>([]),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false),
    [item, setItem] = useState(blank),
    [removeBg, setRemoveBg] = useState(false);
  useEffect(() => {
    Promise.all([
      fetch("/api/company").then((r) => {
        if (!r.ok) throw Error("Falha ao carregar dados.");
        return r.json();
      }),
      fetch("/api/auth").then((r) => r.json()),
    ])
      .then(([d, a]) => {
        setCompany(d.company);
        setProducts(d.products);
        setLogged(a.authenticated);
        setDemoMode(a.demoMode === true);
      })
      .catch((e) => setMsg(e.message));
  }, []);
  async function request(url: string, options: RequestInit) {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) setLogged(false);
      throw Error(data.error || "Não foi possível concluir.");
    }
    return data;
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await request("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setLogged(true);
      setPassword("");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(next = products) {
    setBusy(true);
    setMsg("Salvando...");
    try {
      await request("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, products: next }),
      });
      setProducts(next);
      setMsg("Alterações salvas.");
    } catch (e) {
      setMsg((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg("Preparando imagem...");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("removeBg", String(removeBg));
      const d = await request("/api/upload", { method: "POST", body: fd });
      setItem((prev) => ({ ...prev, imageUrl: d.url }));
      setMsg("Imagem pronta. Salve a peça para publicar no catálogo.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }
  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!item.imageUrl) {
      setMsg("Selecione uma foto da peça.");
      return;
    }
    const updated = { ...item, id: item.id || crypto.randomUUID() };
    try {
      await save(
        item.id
          ? products.map((p) => (p.id === item.id ? updated : p))
          : [updated, ...products],
      );
      setItem(blank);
    } catch {}
  }
  const input =
    "w-full px-4 py-3 rounded-lg bg-steel-950 border border-steel-700 text-white";
  const field = (
    label: string,
    key: string,
    value: string,
    onChange: (v: string) => void,
    type = "text",
  ) => (
    <label className="block text-sm space-y-2" key={key}>
      <span>{label}</span>
      <input
        className={input}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        maxLength={4000}
      />
    </label>
  );
  if (demoMode)
    return (
      <main className="admin-shell min-h-screen grid place-items-center p-6">
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
      </main>
    );
  if (!logged)
    return (
      <main className="admin-shell min-h-screen cad-grid-bg grid place-items-center p-5">
        <form
          onSubmit={login}
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
          <h1 className="text-2xl font-display">Painel administrativo</h1>
          <label className="block space-y-2">
            <span>Senha de acesso</span>
            <input
              className={input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button
            disabled={busy}
            className="w-full bg-usibar p-3 rounded-lg font-bold"
          >
            {busy ? "Entrando..." : "Entrar"}
          </button>
          <p role="status" className="text-sm text-usibar">
            {msg}
          </p>
        </form>
      </main>
    );
  if (!company)
    return (
      <main className="p-10">
        <p role="status">{msg || "Carregando painel..."}</p>
        <button onClick={() => location.reload()}>Tentar novamente</button>
      </main>
    );
  return (
    <main className="admin-shell min-h-screen bg-steel-950 p-5 sm:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <p className="text-usibar font-mono text-xs">USIBAR / GESTÃO</p>
            <h1 className="text-3xl font-display">Painel administrativo</h1>
          </div>
          <div className="flex gap-5">
            <a href="/" target="_blank">
              Ver site ↗
            </a>
            <button
              onClick={async () => {
                try {
                  await request("/api/auth", { method: "DELETE" });
                  setLogged(false);
                  setMsg("");
                } catch (e) {
                  setMsg((e as Error).message);
                }
              }}
            >
              Sair
            </button>
          </div>
        </header>
        <p role="status" aria-live="polite" className="text-usibar min-h-6">
          {msg}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save().catch(() => {});
          }}
          className="p-6 rounded-2xl border border-steel-700 bg-steel-900 space-y-6"
        >
          <h2 className="text-2xl font-display">Empresa e contatos</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              ["Nome da empresa", "name"],
              ["Mensagem institucional", "headline"],
              ["Subtítulo", "subheadline"],
              ["Telefone visível", "phoneDisplay"],
              ["WhatsApp (somente números)", "whatsapp"],
              ["E-mail", "email"],
              ["Cidade / UF", "city"],
              ["Experiência", "experienceYears"],
            ].map(([label, key]) =>
              field(
                label,
                key,
                company[key],
                (v) => setCompany({ ...company, [key]: v }),
                key === "email" ? "email" : "text",
              ),
            )}
          </div>
          {["aboutParagraph1", "aboutParagraph2", "aboutParagraph3"].map(
            (key, i) => (
              <label key={key} className="block space-y-2">
                <span>Apresentação — parágrafo {i + 1}</span>
                <textarea
                  required
                  maxLength={4000}
                  rows={3}
                  className={input}
                  value={company[key]}
                  onChange={(e) =>
                    setCompany({ ...company, [key]: e.target.value })
                  }
                />
              </label>
            ),
          )}
          <button
            disabled={busy}
            className="bg-usibar px-6 py-3 rounded-lg font-bold"
          >
            Salvar dados da empresa
          </button>
        </form>
        <form
          ref={formRef}
          onSubmit={saveItem}
          className="p-6 rounded-2xl border border-steel-700 bg-steel-900 space-y-5"
        >
          <h2 className="text-2xl font-display">
            {item.id ? "Editar peça" : "Cadastrar peça"}
          </h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              ["Nome da peça", "title"],
              ["Código", "code"],
              ["Especificações", "specs"],
            ].map(([label, key]) =>
              field(label, key, (item as any)[key], (v) =>
                setItem({ ...item, [key]: v }),
              ),
            )}
            <label className="space-y-2">
              <span>Categoria</span>
              <select
                className={input}
                value={item.category}
                onChange={(e) => setItem({ ...item, category: e.target.value })}
              >
                <option value="cilindros">Cilindros hidráulicos</option>
                <option value="blocos">Blocos hidráulicos</option>
              </select>
            </label>
          </div>
          <label className="block space-y-2">
            <span>Descrição</span>
            <textarea
              className={input}
              required
              value={item.description}
              onChange={(e) =>
                setItem({ ...item, description: e.target.value })
              }
            />
          </label>
          <div className="flex flex-wrap gap-6">
            <label>
              <input
                type="checkbox"
                checked={item.featured}
                onChange={(e) =>
                  setItem({ ...item, featured: e.target.checked })
                }
              />{" "}
              Destacar no catálogo
            </label>
            <label>
              <input
                type="checkbox"
                checked={removeBg}
                onChange={(e) => setRemoveBg(e.target.checked)}
              />{" "}
              Remover fundo branco da foto
            </label>
          </div>
          <label className="block space-y-2">
            <span>Foto da peça — JPG, PNG ou WebP, até 8 MB</span>
            <input
              disabled={busy}
              className="block max-w-full"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={upload}
            />
          </label>
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt="Prévia da peça"
              className="h-40 object-contain"
            />
          )}
          <div className="flex gap-4">
            <button
              disabled={busy}
              className="bg-usibar px-6 py-3 rounded-lg font-bold"
            >
              Salvar peça
            </button>
            <button type="button" onClick={() => setItem(blank)}>
              Limpar formulário
            </button>
          </div>
        </form>
        <section className="space-y-4">
          <h2 className="text-2xl font-display">
            Catálogo ({products.length})
          </h2>
          {products.map((p) => (
            <article
              key={p.id}
              className="flex flex-wrap items-center gap-4 p-4 border border-steel-700 rounded-xl"
            >
              <img
                src={p.imageUrl}
                alt={p.title}
                className="w-24 h-20 object-contain"
              />
              <div className="flex-1 min-w-48">
                <p className="text-usibar text-xs font-mono">{p.code}</p>
                <h3>{p.title}</h3>
              </div>
              <button
                disabled={busy}
                onClick={() => {
                  setItem(p);
                  formRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
              >
                Editar
              </button>
              <button
                disabled={busy}
                className="text-red-300"
                onClick={() => {
                  if (confirm("Excluir esta peça do catálogo?"))
                    void save(products.filter((x) => x.id !== p.id)).catch(
                      () => {},
                    );
                }}
              >
                Excluir
              </button>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
