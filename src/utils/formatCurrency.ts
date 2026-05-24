export function formatVND(amount: number): string {
  const k = Math.round(amount / 1000);
  return k.toLocaleString('vi-VN') + 'K';
}
