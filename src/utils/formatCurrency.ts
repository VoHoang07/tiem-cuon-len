export function formatVND(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return safe.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '₫';
}
