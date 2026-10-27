import { splitTokens, displayValue, labelFor } from '../lib/redact.js';
import { LockIcon } from './Icons.jsx';

// Renders text with private placeholders put back as small locked chips.
// The real values only ever exist here, on the device. Each chip is isolated left-to-right
// so phone numbers don't scramble inside right-to-left languages.
export default function TokenText({ text, items }) {
  return splitTokens(text || '', items).map((part, i) =>
    typeof part === 'string' ? (
      <span key={i}>{part}</span>
    ) : (
      <bdi key={i} dir="ltr" className="private-chip" title={`${part.item ? labelFor(part.item.type) : 'Private detail'} — kept on this device`}>
        <LockIcon />
        <span>{part.item ? displayValue(part.item) : part.token}</span>
      </bdi>
    ),
  );
}
