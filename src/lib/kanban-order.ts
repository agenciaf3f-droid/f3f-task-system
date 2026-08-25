export type KanbanOrderTask = {
  id: string;
  title: string;
  priority: string;
  dueDate: Date | null;
};

const PRIORITY_POSITION: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Ordem dos cards no board: o prazo manda, a prioridade desempata. Tarefa sem
 * prazo cai no fim da coluna — não dá para colocá-la antes de uma que tem data
 * marcada sem inventar um prazo que ninguém definiu.
 */
export function compareKanbanTasks(left: KanbanOrderTask, right: KanbanOrderTask) {
  const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : null;
  const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : null;

  if (leftDue !== rightDue) {
    if (leftDue === null) return 1;
    if (rightDue === null) return -1;
    return leftDue - rightDue;
  }

  const byPriority = (PRIORITY_POSITION[left.priority] ?? Number.MAX_SAFE_INTEGER)
    - (PRIORITY_POSITION[right.priority] ?? Number.MAX_SAFE_INTEGER);
  if (byPriority !== 0) return byPriority;

  // Último critério só para a ordem não oscilar entre renders com dados iguais.
  return left.title.localeCompare(right.title, "pt-BR") || left.id.localeCompare(right.id);
}

/** Devolve uma cópia: a lista original controla o drag and drop e não pode ser mutada. */
export function sortKanbanTasks<T extends KanbanOrderTask>(tasks: T[]) {
  return [...tasks].sort(compareKanbanTasks);
}
