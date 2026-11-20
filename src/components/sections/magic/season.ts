/**
 * The Christmas season of the hub pages: from mid-November until Epiphany
 * (the same end as the app's Christmas corner, AppChristmas.CHRISTMAS_END).
 * Read it in an effect, never during render: the server can't know the date
 * the page will be seen.
 */
export function isChristmasSeason(now: Date = new Date()): boolean {
  const m = now.getMonth();
  const d = now.getDate();
  return (m === 10 && d >= 15) || m === 11 || (m === 0 && d < 7);
}
