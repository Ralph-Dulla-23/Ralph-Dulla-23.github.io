import { useCallback, useEffect, useRef, useState } from 'react';

/** A baseline for the current edit session, updated only when the dialog opens. */
export function useEditorDraftGuard(isOpen, signature, closeEditor) {
  const baseline = useRef(null);
  const wasOpen = useRef(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      setConfirmDiscard(false);
    }
  }

  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      baseline.current = signature;
    } else if (!isOpen) {
      baseline.current = null;
    }
    wasOpen.current = isOpen;
  }, [isOpen, signature]);

  const requestClose = useCallback(() => {
    if (baseline.current !== null && signature !== baseline.current) {
      setConfirmDiscard(true);
    } else {
      closeEditor();
    }
  }, [signature, closeEditor]);

  const discard = useCallback(() => {
    setConfirmDiscard(false);
    closeEditor();
  }, [closeEditor]);

  const keepEditing = useCallback(() => {
    setConfirmDiscard(false);
  }, []);

  return { confirmDiscard, requestClose, discard, keepEditing };
}
