/** Render message text: blank lines separate paragraphs; "1. " lines become an ordered list. */
export function Paragraphs({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\d+\.\s/.test(l))) {
          return (
            <ol key={i}>
              {lines.map((l) => (
                <li key={l}>{l.replace(/^\d+\.\s/, '')}</li>
              ))}
            </ol>
          );
        }
        return <p key={i}>{b}</p>;
      })}
    </>
  );
}
