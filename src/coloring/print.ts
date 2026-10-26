/**
 * Print-friendly sheet: a full-page picture with a title, shown only on
 * paper. Everything else on the page is hidden while printing.
 */
export async function printSheet({ src, title, footer }: { src: string; title: string; footer: string }): Promise<void> {
  if (typeof window === 'undefined') return;
  document.querySelector('.ziggy-print-root')?.remove();
  const root = document.createElement('div');
  root.className = 'ziggy-print-root';
  const style = document.createElement('style');
  style.textContent = `
    .ziggy-print-root { display: none; }
    @media print {
      @page { size: A4 portrait; margin: 12mm; }
      html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
      body > *:not(.ziggy-print-root) { display: none !important; }
      .ziggy-print-root { display: flex !important; flex-direction: column; align-items: center; gap: 6mm; width: 100%; font-family: Fredoka, ui-rounded, system-ui, sans-serif; color: #1d1d2b; }
      .ziggy-print-root h1 { font-size: 22pt; margin: 0; }
      .ziggy-print-root img { width: 100%; max-width: 180mm; max-height: 230mm; object-fit: contain; }
      .ziggy-print-root p { font-size: 10pt; margin: 0; color: #555; }
    }`;
  const h1 = document.createElement('h1');
  h1.textContent = title;
  const img = document.createElement('img');
  img.alt = title;
  const p = document.createElement('p');
  p.textContent = footer;
  root.append(style, h1, img, p);
  document.body.appendChild(root);
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    root.remove();
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  // Some browsers never fire afterprint; the sheet is invisible on screen anyway.
  setTimeout(cleanup, 60_000);
}
