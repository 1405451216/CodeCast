import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../lib/useI18n';

interface Crumb {
  label: string;
  path?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  const t = useI18n();
  const navigate = useNavigate();
  return (
    <nav aria-label={t.breadcrumb.ariaLabel} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--c-textMute)', marginBottom: 16 }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span style={{ opacity: 0.4 }}>/</span>}
          {item.path ? (
            <button
              onClick={() => navigate(item.path!)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--c-textMute)',
                cursor: 'pointer',
                fontSize: 12,
                padding: 0,
                textDecoration: 'none',
                transition: 'color var(--dur-fast) var(--ease)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--c-accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--c-textMute)'; }}
            >
              {item.label}
            </button>
          ) : (
            <span style={{ color: 'var(--c-text)', fontWeight: 500 }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
