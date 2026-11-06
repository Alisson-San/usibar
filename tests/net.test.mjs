import test from "node:test";
import assert from "node:assert/strict";
import { networkProblem } from "../src/lib/net.mjs";

const fetchFailed = (code) => new TypeError("fetch failed", { cause: Object.assign(Error("x"), { code }) });

test("a proxy certificate is named as such, with the code Node gave", () => {
  for (const code of ["SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"]) {
    const p = networkProblem(fetchFailed(code), "o Gemini");
    assert.equal(p.kind, "certificate");
    assert.equal(p.code, code);
    assert.match(p.message, new RegExp(`conexão com o Gemini \\(${code}\\)`));
  }
});

test("timeouts and plain network failures get their own messages", () => {
  const timeout = Object.assign(Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
  assert.equal(networkProblem(timeout, "o Gemini").kind, "timeout");
  assert.match(networkProblem(timeout, "o Gemini").message, /^O Gemini demorou demais/);
  assert.equal(networkProblem(fetchFailed("ECONNREFUSED"), "o Supabase").kind, "network");
  assert.equal(networkProblem(new TypeError("fetch failed"), "o Supabase").kind, "network");
});

test("errors that are not about the connection are left alone", () => {
  assert.equal(networkProblem(Error("Supabase: falha ao ler o conteúdo (500)."), "o Supabase"), null);
  assert.equal(networkProblem(new TypeError("x is not a function"), "o Supabase"), null);
  assert.equal(networkProblem(undefined, "o Supabase"), null);
});
