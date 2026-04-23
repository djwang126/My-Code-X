import { IconChevronDown, IconChevronUp } from '../../../../shared/chat-ui/ChatIcons';
import type { ActiveChatTodo } from '../types';

type ChatTodoPanelProps = {
  todo: ActiveChatTodo;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function ChatTodoPanel({ todo, collapsed = false, onToggleCollapsed }: ChatTodoPanelProps) {
  const hasExplanation = Boolean(todo.explanation.trim());

  return (
    <section aria-label="Todo list" className={`composer-todolist-panel ${collapsed ? 'is-collapsed' : 'is-expanded'}`}>
      <div className="composer-todolist-panel-inner">
        <div className="composer-todolist-header">
          <div className="composer-todolist-title-copy">
            <div className="composer-todolist-summary-row">
              <span aria-hidden="true" className="composer-todolist-icon">✓</span>
              <div className="composer-todolist-summary">{todo.total} task{todo.total === 1 ? '' : 's'}, {todo.completed} completed</div>
            </div>
            {!collapsed && hasExplanation ? <p className="composer-todolist-explanation">{todo.explanation}</p> : null}
          </div>
          <button
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand todo list' : 'Collapse todo list'}
            className="composer-todolist-toggle-btn"
            onClick={onToggleCollapsed}
            type="button"
          >
            {collapsed ? <IconChevronUp /> : <IconChevronDown />}
          </button>
        </div>
        {!collapsed ? (
          <div className="composer-todolist-steps-scroll">
            <ol className="composer-todolist-steps">
              {todo.steps.map((step, index) => (
                <li className="composer-todolist-step" key={`${step.step}-${index}`}>
                  <span aria-hidden="true" className={`composer-todolist-step-marker status-${step.status}`} />
                  <span className="composer-todolist-step-index">{index + 1}.</span>
                  <span className={`composer-todolist-step-text status-${step.status}`}>{step.step}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}
