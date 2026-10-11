/**
 * Qidr (قِدر) mark: a cooking pot — two orange dots above a lid bar and a pot with a chevron.
 * Redrawn as clean vector from the owner's icon. `tone="light"` is for dark surfaces (sidebar).
 */
export function LogoMark({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  const ink = tone === 'light' ? '#F4F1EC' : '#191512';
  const cut = tone === 'light' ? '#191919' : '#FFFFFF';
  return (
    <svg viewBox="40 60 176 156" fill="none" className={className} aria-hidden>
      <circle cx="101" cy="86" r="15.5" fill="#E2692E" />
      <circle cx="154" cy="86" r="15.5" fill="#E2692E" />
      <rect x="44" y="126" width="168" height="19" rx="9.5" fill={ink} />
      <path d="M59 152h138v6c0 30-29 52-69 52s-69-22-69-52v-6Z" fill={ink} />
      <path d="M102 196l26-24 26 24" stroke={cut} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
