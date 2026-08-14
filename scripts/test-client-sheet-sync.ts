import assert from "node:assert/strict";
import {
  canonicalizeClientName,
  extractClientName,
  inferPlanFromGroupName,
  isSafeClientNameVariant,
  parseClientSheet,
  parseCsv,
  resolveManager,
} from "../src/lib/client-sheet-sync";

const csv = [
  "Grupo,Gestor Responsável,Status,ID do Grupo,ID Grupo (Uazapi),Plano",
  '"F3F - Cliente, Com Vírgula - PREMIUM",Gabriel,Ativo,120363123456789000-group,120363123456789000@g.us,PREMIUM',
  "(FECHADO) F3F - Cliente Antigo - FUNIL,Raphael,Inativo,120363123456789001-group,120363123456789001@g.us,FUNIL",
  "F3F - Cliente Sem IDs - 1 FASE,,Ativo,,,1 FASE",
].join("\n");

assert.deepEqual(parseCsv('a,"b,b","c""d"\n'), [["a", "b,b", 'c"d']]);

const parsed = parseClientSheet(csv);
assert.equal(parsed.rows.length, 3);
assert.equal(parsed.rows[0].clientName, "Cliente, Com Vírgula");
assert.equal(parsed.rows[1].clientName, "Cliente Antigo");
assert.equal(parsed.rows[1].status, "inactive");
assert.equal(parsed.rows[0].sourceGroupId, "120363123456789000-group");
assert.equal(parsed.rows[2].clientName, "Cliente Sem IDs");
assert.equal(parsed.rows[2].sourceGroupId, "");
assert.equal(parsed.rows[2].whatsappGroupId, "");

assert.equal(extractClientName("F3F - (Studio) Juan Manuel - 1 FASE", "1 FASE"), "(Studio) Juan Manuel");
assert.equal(
  extractClientName("( FECHADO ) F3F - Cliente Antigo - 1 FASE", "1 FASE"),
  "Cliente Antigo",
);
assert.equal(
  extractClientName("F3F - Rayanne Magna Mesquita Da Silva - 1 FASE", ""),
  "Rayanne Magna Mesquita Da Silva",
);
assert.equal(inferPlanFromGroupName("F3F - Rayanne Magna Mesquita Da Silva - 1 FASE"), "1 FASE");
assert.equal(inferPlanFromGroupName("F3F - Cliente sem sufixo reconhecido - Vídeos"), "");
assert.equal(canonicalizeClientName("Sinergia (Rubens e Rogério)"), "Sinergia");
assert.equal(
  extractClientName("F3F - Sinergia (Rubens e Rogério) - Premium", "Premium"),
  "Sinergia",
);
assert.equal(
  resolveManager([{ id: "1", name: "Amorim" }], "Rafhael", "Outro cliente")?.id,
  "1",
);
assert.equal(
  resolveManager([{ id: "2", name: "Denzel" }], "Rafinha", "Arthur")?.id,
  "2",
);
assert.equal(resolveManager([{ id: "2", name: "Denzel" }], "Vídeos", "Jucilaine Perin"), null);
assert.equal(isSafeClientNameVariant("Karine Xavier", "Karine Xavier de Oliveira"), true);
assert.equal(isSafeClientNameVariant("Frederico Silva de Farias", "Frederico Silva de Faria"), true);
assert.equal(isSafeClientNameVariant("Adriana Cristina de Costa Leite", "Adriana Cristina da Costa Leite"), true);
assert.equal(isSafeClientNameVariant("Douglas José da Silva", "Douglas Vieira"), false);
assert.equal(isSafeClientNameVariant("Sinergia", "Sinergia (Rubens e Rogério)"), true);

console.log("Client sheet sync checks passed");
