/** True when a key event comes from a text field, where shortcuts must not fire. */
export const isTyping = (e: KeyboardEvent) => /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
