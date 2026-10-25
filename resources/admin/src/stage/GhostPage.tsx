/**
 * The faint web page a design is shown on (ADR 0170): a header, a hero and some
 * lines, sized in container units so it reads the same at every stage size. A
 * thumb drops the details, which are noise at 84px.
 */
export function GhostPage({ displayType, thumb }: { displayType: string; thumb: boolean }) {
  const lines = (count: number) => (
    <div className="wconvert-ghost__lines">{Array.from({ length: count }, (_, index) => <i key={index} />)}</div>
  );

  return (
    <div className="wconvert-ghost" aria-hidden="true">
      <div className="wconvert-ghost__head"><span /><i /><i /><i /></div>
      {displayType === 'inline' ? (
        <>
          {lines(thumb ? 2 : 3)}
          <div />
          {lines(12)}
        </>
      ) : (
        <>
          <div className="wconvert-ghost__hero"><div><i /><i /><i /><i /></div><span /></div>
          {!thumb && <div className="wconvert-ghost__cols"><i /><i /><i /></div>}
          {lines(10)}
        </>
      )}
    </div>
  );
}
