import seed from "../../data/db.json";
import { getStore, remoteImageBase } from "./storage.mjs";

const { adminPassword: _secret, ...bundled } = seed as typeof seed & {
  adminPassword?: string;
};
export const store = () => getStore({ seed: bundled });
export const imageBase = () => remoteImageBase();
export const readOnlyError =
  "A demonstração permite apenas consulta. A edição fica disponível na instalação local ou com o Supabase configurado.";
