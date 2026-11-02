import { useRef, useState, type CSSProperties } from 'react';
import { TextInput } from '@mantine/core';

interface ChatTitleEditorProps {
  initialTitle: string;
  size?: 'xs' | 'sm' | 'md';
  style?: CSSProperties;
  onCommit: (title: string) => void;
  onCancel: () => void;
}

/**
 * Inline title editor for chats: Enter or blur saves, Escape cancels, and an
 * empty value cancels instead of saving a blank title. The settled ref keeps
 * the blur that follows a commit/cancel from running a second time.
 */
export function ChatTitleEditor({ initialTitle, size = 'sm', style, onCommit, onCancel }: Readonly<ChatTitleEditorProps>) {
  const [value, setValue] = useState(initialTitle);
  const settledRef = useRef(false);

  const commit = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    const trimmed = value.trim();
    if (!trimmed) {
      onCancel();
      return;
    }
    onCommit(trimmed);
  };

  const cancel = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    onCancel();
  };

  return (
    <TextInput
      size={size}
      aria-label="Chat name"
      value={value}
      style={style}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setValue(event.currentTarget.value)}
      onBlur={commit}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        }
      }}
    />
  );
}
