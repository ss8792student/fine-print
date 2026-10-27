const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const CameraIcon = (p) => (
  <svg {...base} {...p}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.5" /></svg>
);
export const UploadIcon = (p) => (
  <svg {...base} {...p}><path d="M12 15V4" /><path d="m7 9 5-5 5 5" /><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></svg>
);
export const PasteIcon = (p) => (
  <svg {...base} {...p}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4.5V3h6v1.5" /><path d="M9 10h6M9 14h6M9 18h3" /></svg>
);
export const LockIcon = (p) => (
  <svg {...base} width="13" height="13" strokeWidth={2.4} {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const CheckIcon = (p) => (
  <svg {...base} strokeWidth={2.6} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const AlertIcon = (p) => (
  <svg {...base} strokeWidth={2.6} {...p}><path d="M12 7v6" /><path d="M12 17.2v.1" /></svg>
);
export const XIcon = (p) => (
  <svg {...base} strokeWidth={2.6} {...p}><path d="m7 7 10 10M17 7 7 17" /></svg>
);
export const SpeakerIcon = (p) => (
  <svg {...base} {...p}><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" /><path d="M16 9a4 4 0 0 1 0 6" /><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" /></svg>
);
export const StopIcon = (p) => (
  <svg {...base} {...p}><rect x="6.5" y="6.5" width="11" height="11" rx="1.5" /></svg>
);
export const CalendarIcon = (p) => (
  <svg {...base} {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
);
export const ChevronIcon = (p) => (
  <svg {...base} {...p}><path d="m9 6 6 6-6 6" /></svg>
);
export const ArrowDownIcon = (p) => (
  <svg {...base} {...p}><path d="M12 5v14M6 13l6 6 6-6" /></svg>
);
export const ShieldIcon = (p) => (
  <svg {...base} {...p}><path d="M12 3 5 6v5.5c0 4.2 2.9 7.9 7 9.5 4.1-1.6 7-5.3 7-9.5V6l-7-3Z" /><path d="m9 12 2.2 2.2L15.5 10" /></svg>
);
export const ArrowUpRightIcon = (p) => (
  <svg {...base} {...p}><path d="M7 17 17 7M9 7h8v8" /></svg>
);
export const ListIcon = (p) => (
  <svg {...base} {...p}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>
);
export const BookmarkIcon = (p) => (
  <svg {...base} {...p}><path d="M6 4h12v17l-6-4-6 4V4Z" /></svg>
);
export const BellIcon = (p) => (
  <svg {...base} {...p}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>
);
export const TrashIcon = (p) => (
  <svg {...base} {...p}><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" /></svg>
);
