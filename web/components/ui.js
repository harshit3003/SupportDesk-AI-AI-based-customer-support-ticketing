export const Stat = ({ title, value, sub, tone }) => (
  <div className={`card stat ${tone || ''}`}>
    <div className="muted">{title}</div>
    <div className="big">{value}</div>
    {sub && <div className="muted small">{sub}</div>}
  </div>
);

export function Bars({ rows, max, format = (v) => v }) {
  const top = max || Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r.label} className="bar-row">
          <span className="bar-label">{r.label}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.value / top) * 100}%` }} /></div>
          <span className="bar-val">{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export const Badge = ({ kind, children }) => <span className={`badge ${kind}`}>{children}</span>;
