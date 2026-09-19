import { useEffect, useRef, useState } from 'react';
import { TextInput } from '@astryxdesign/core/TextInput';
import { typingDelay } from '../../../shared/lib/search';

// The field owns what is typed and mirrors it to the URL. Bound straight to the URL, the router's asynchronous update
// wrote an older value back while a Korean syllable was still being composed, which dropped or split the letters.
// A URL value the field did not send (history, a link with q) replaces the text.
export function SearchFilter({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value);
  const typed = useRef(value);
  const pending = useRef<string[]>([]);
  // Only the value that is actually sent is recorded above, so the delay does not disturb the echo bookkeeping.
  const send = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => { clearTimeout(send.current); }, []);
  useEffect(() => {
    if (value === typed.current) { pending.current = []; return; }
    const index = pending.current.indexOf(value);
    if (index >= 0) { pending.current.splice(0, index + 1); return; }
    pending.current = []; typed.current = value; setText(value);
  }, [value]);
  return <TextInput label={label} isLabelHidden placeholder={placeholder} value={text} hasClear onChange={next => {
    typed.current = next; setText(next);
    clearTimeout(send.current);
    send.current = setTimeout(() => { pending.current.push(next); onChange(next); }, typingDelay);
  }}/>;
}
