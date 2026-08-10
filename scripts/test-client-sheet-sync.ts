import assert from "node:assert/strict";
import {
  extractClientName,
  parseClientSheet,
  parseCsv,
  resolveManager,
} from "../src/lib/client-sheet-sync";

const csv = [
  "Grupo,Gestor Responsável,Status,ID Grupo (Uazapi),Plano",
  '"F3F - Cliente, Com Vírgula - PREMIUM",Gabriel,Ativo,120363123456789000@g.us,PREMIUM',
  "(FECHADO) F3F - Cliente Antigo - FUNIL,Raphael,Inativo,120363123456789001@g.us,FUNIL",
].join("\n");

assert.deepEqual(parseCsv('a,"b,b","c""d"\n'), [["a", "b,b", 'c"d']]);

const parsed = parseClientSheet(csv);
assert.equal(parsed.rows.length, 2);
assert.equal(parsed.rows[0].clientName, "Cliente, Com Vírgula");
assert.equal(parsed.rows[1].clientName, "Cliente Antigo");
assert.equal(parsed.rows[1].status, "inactive");

assert.equal(extractClientName("F3F - (Studio) Juan Manuel - 1 FASE", "1 FASE"), "(Studio) Juan Manuel");
assert.equal(
  resolveManager([{ id: "1", name: "Rafinha Silva" }], "Rafhael")?.id,
  "1",
);

console.log("Client sheet sync checks passed");
