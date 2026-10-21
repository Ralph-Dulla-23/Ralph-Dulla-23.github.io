import React from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';

export default function ConfirmDiscardDialog({ onStay, onDiscard }) {
  return createPortal(<div className="diary-discard-overlay" role="presentation">
    <div role="alertdialog" aria-modal="true" aria-labelledby="discard-title" aria-describedby="discard-copy" className="diary-discard-card">
      <p className="text-xs font-extrabold uppercase tracking-widest text-amber-500">Unsaved changes</p>
      <h2 id="discard-title" className="mt-2 text-xl font-bold">Discard your edits?</h2>
      <p id="discard-copy" className="mt-2 text-sm leading-6 opacity-75">You have changed this entry. Leaving now will lose those unsaved changes.</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button type="button" onClick={onDiscard} className="min-h-12 rounded-xl border border-red-300 px-3 text-sm font-semibold text-red-600 dark:border-red-900 dark:text-red-300">Discard</button>
        <button type="button" autoFocus onClick={onStay} className="min-h-12 rounded-xl bg-sky-600 px-3 text-sm font-bold text-white">Keep editing</button>
      </div>
    </div>
  </div>, document.body);
}
ConfirmDiscardDialog.propTypes = { onStay: PropTypes.func.isRequired, onDiscard: PropTypes.func.isRequired };
