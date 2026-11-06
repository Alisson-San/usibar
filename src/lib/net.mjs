// Explains a failed outbound request (Supabase, Gemini) in words an admin can act on.
// Behind a company proxy that inspects HTTPS, the browser works (the company's root certificate
// is installed in the operating system) while Node, which ships its own list of certificates,
// rejects the proxy's certificate. That shows up as "fetch failed" with a TLS code in `cause`.
const CERTIFICATE = new Set([
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_UNTRUSTED",
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

function codeOf(e) {
  for (let err = e, depth = 0; err && depth < 5; err = err.cause, depth++)
    if (typeof err.code === "string") return err.code;
  return "";
}

/**
 * `service` carries its article ("o Supabase", "o Gemini").
 * @returns {{ kind: "certificate" | "timeout" | "network", code: string, message: string } | null}
 *   null when the error is not about reaching the service.
 */
export function networkProblem(e, service) {
  const code = codeOf(e);
  if (CERTIFICATE.has(code))
    return {
      kind: "certificate",
      code,
      message: `O servidor do site não confiou no certificado da conexão com ${service} (${code}). Na rede da empresa isso costuma ser o proxy que inspeciona HTTPS; veja “Rede da empresa” no README.`,
    };
  if (e?.name === "TimeoutError" || e?.name === "AbortError" || code === "UND_ERR_CONNECT_TIMEOUT")
    return {
      kind: "timeout",
      code,
      message: `${service.charAt(0).toUpperCase()}${service.slice(1)} demorou demais para responder. Tente de novo.`,
    };
  if (code || (e?.name === "TypeError" && /fetch failed/i.test(e.message ?? "")))
    return {
      kind: "network",
      code,
      message: `O servidor do site não conseguiu falar com ${service}${code ? ` (${code})` : ""}. Verifique a internet ou o proxy da rede.`,
    };
  return null;
}
