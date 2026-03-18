/**
 * R1 Frontend Shim for @tauri-apps/api/clipboard
 */

export const writeText = async (text: string): Promise<void> => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  
  // Support HTTP environments
  const textArea = document.createElement("textarea");
  textArea.value = text;
  Object.assign(textArea.style, {
    position: "fixed",
    left: "-999999px",
    top: "-999999px"
  });
  
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('[R1 Clipboard] Fallback copy failed', err);
  }
  document.body.removeChild(textArea);
};

export const readText = async (): Promise<string | null> => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.readText();
  }
  return null;
};
