import { useStore } from '../store';
import { TASKS } from './definitions';

export function Tasks() {
  const graph = useStore((s) => s.graph);
  const solver = useStore((s) => s.solver);
  const activeTaskId = useStore((s) => s.activeTaskId);
  const setActiveTask = useStore((s) => s.setActiveTask);

  const active = TASKS.find((t) => t.id === activeTaskId) ?? null;
  const result = active ? active.check(graph, solver) : null;

  return (
    <div className="panel tasks">
      <div className="panel-title">实验任务</div>
      <div className="task-list">
        {TASKS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === activeTaskId ? 'task-item active' : 'task-item'}
            onClick={() => setActiveTask(t.id === activeTaskId ? null : t.id)}
          >
            {t.title}
          </button>
        ))}
      </div>

      {active && result && (
        <div className="task-detail">
          <div className="task-goal">{active.goal}</div>
          <div className={result.passed ? 'task-status ok' : 'task-status no'}>
            {result.passed ? '✓ 已达标' : '○ 未达标'}
          </div>
          <div className="task-result">{result.detail}</div>
          <div className="task-hint">提示：{active.hint}</div>
        </div>
      )}
      {!active && <div className="empty-hint">选择一个任务查看目标与实时判定。</div>}
    </div>
  );
}
