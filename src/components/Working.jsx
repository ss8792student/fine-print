import { CheckIcon } from './Icons.jsx';

const STEPS = ['read', 'hide', 'explain', 'verify'];

export default function Working({ steps, t }) {
  return (
    <div className="working glass card-pad" aria-live="polite">
      <h1 className="page-title">{t('working_title')}</h1>
      <ol className="work-steps">
        {STEPS.map((id) => {
          const state = steps[id] || 'todo';
          return (
            <li key={id} className={`step-${state}`}>
              <span className="step-dot" aria-hidden="true">{state === 'done' ? <CheckIcon width={14} height={14} /> : null}</span>
              {t(`work_${id}`)}
            </li>
          );
        })}
      </ol>
      <p className="muted small">{t('work_time')}</p>
    </div>
  );
}
