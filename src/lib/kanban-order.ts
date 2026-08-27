export type KanbanOrderTask = {
  id: string;
  title: string;
  priority: string;
  dueDate: Date | null;
  deliveryDate: Date | null;
};

const PRIORITY_POSITION: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Ordem dos cards no board: usa a entrega quando ela existir; caso contrário,
 * usa a conclusão. A prioridade desempata tarefas com a mesma data.
 */
export function compareKanbanTasks(left: KanbanOrderTask, right: KanbanOrderTask) {
  const leftScheduleDate = left.deliveryDate ?? left.dueDate;
  const rightScheduleDate = right.deliveryDate ?? right.dueDate;
  const leftDue = leftScheduleDate ? new Date(leftScheduleDate).getTime() : null;
  const rightDue = rightScheduleDate ? new Date(rightScheduleDate).getTime() : null;

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

/** Concluídas: mostra primeiro as tarefas encerradas com conclusão mais recente. */
export function sortCompletedKanbanTasks<T extends KanbanOrderTask>(tasks: T[]) {
  return [...tasks].sort((left, right) => {
    const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : null;
    const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : null;
    if (leftDue !== rightDue) {
      if (leftDue === null) return 1;
      if (rightDue === null) return -1;
      return rightDue - leftDue;
    }
    const byPriority = (PRIORITY_POSITION[left.priority] ?? Number.MAX_SAFE_INTEGER)
      - (PRIORITY_POSITION[right.priority] ?? Number.MAX_SAFE_INTEGER);
    if (byPriority !== 0) return byPriority;
    return left.title.localeCompare(right.title, "pt-BR") || left.id.localeCompare(right.id);
  });
}
