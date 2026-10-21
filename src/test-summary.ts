/** Reads one summary card from the DOM: its value and sub-line. */
export function stat(label: string): { value: string; sub: string } {
  const dt = [...document.querySelectorAll('.summary dt')].find((d) => d.textContent === label)
  if (!dt) throw new Error(`No summary card labelled "${label}"`)
  const dd = dt.nextElementSibling!
  return {
    // Intl puts a no-break space after some currency codes (SEK 426); normalise it.
    value: dd.querySelector('.stat-value')!.textContent!.replace(/\s/g, ' '),
    sub: dd.querySelector('.stat-sub')!.textContent!,
  }
}

export const summaryText = () => document.querySelector('.summary')!.textContent!.replace(/\s/g, ' ')
