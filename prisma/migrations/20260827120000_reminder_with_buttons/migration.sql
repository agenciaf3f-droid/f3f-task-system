-- Registra se o lembrete foi para a fila da UAZAPI com os botões de confirmar.
--
-- Sem esta coluna o agendador não conseguia comparar o que já está agendado com
-- o estado atual da resposta do cliente, e por isso nunca refazia a fila: um
-- lembrete marcado antes da mudança continuava saindo sem botão mesmo com o
-- cliente sem responder.
--
-- O default false é proposital para os registros antigos: eles foram marcados
-- quando só a véspera levava botão, então tratá-los como "sem botão" faz o
-- agendador refazê-los na próxima passagem, que é exatamente o que se quer.
ALTER TABLE "meeting_reminders"
  ADD COLUMN IF NOT EXISTS "with_buttons" BOOLEAN NOT NULL DEFAULT false;
