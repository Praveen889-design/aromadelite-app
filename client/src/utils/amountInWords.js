// Convert a number to Indian-format words (lakhs/crores).
// 1,23,456.50 → "One Lakh Twenty Three Thousand Four Hundred Fifty Rupees and Fifty Paise Only"

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n) => {
  if (n < 20) return ones[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return tens[t] + (o ? ' ' + ones[o] : '');
};

const threeDigits = (n) => {
  if (n === 0) return '';
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return (h ? ones[h] + ' Hundred' + (rest ? ' ' : '') : '') + (rest ? twoDigits(rest) : '');
};

export function amountInWords(amount) {
  if (amount == null || isNaN(amount)) return '';
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);

  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';

  const parts = [];
  const crore = Math.floor(rupees / 10_000_000);
  const lakh  = Math.floor((rupees % 10_000_000) / 100_000);
  const thou  = Math.floor((rupees % 100_000) / 1_000);
  const rem   = rupees % 1_000;

  if (crore) parts.push(twoDigits(crore) + ' Crore');
  if (lakh)  parts.push(twoDigits(lakh)  + ' Lakh');
  if (thou)  parts.push(twoDigits(thou)  + ' Thousand');
  if (rem)   parts.push(threeDigits(rem));

  let words = (negative ? 'Minus ' : '') + parts.join(' ').replace(/\s+/g, ' ').trim() + ' Rupees';
  if (paise) words += ' and ' + twoDigits(paise) + ' Paise';
  return words + ' Only';
}
