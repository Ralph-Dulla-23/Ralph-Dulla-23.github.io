import React from 'react';
import PropTypes from 'prop-types';
import DiaryEditorModal from '../ui/DiaryEditorModal';

/** Non-destructive, consistent mobile preview. Never writes until Confirm Import is pressed. */
export default function BookmoryImportPreview({ preview, busy, onClose, onConfirm }) {
  const report = preview.previewReport || {};
  const summary = report.summary || {};
  const metrics = [
    { label:'New books',value:summary.additions ?? 0 },
    { label:'Updates',value:summary.updates ?? 0 },
    { label:'Duplicates skipped',value:summary.duplicates ?? 0 },
    { label:'History periods',value:summary.historicalAggregatesCount ?? 0 },
    { label:'Private reviews',value:summary.journalEntriesCount ?? 0 },
  ];
  const hasChanges = (Number(summary.additions) || 0) + (Number(summary.updates) || 0) > 0;
  return <DiaryEditorModal title="Review Bookmory import" onClose={onClose} busy={busy} footer={<>
    <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border border-gray-300 px-4 text-sm font-semibold dark:border-gray-600">Cancel</button>
    <button type="button" onClick={onConfirm} disabled={busy || !hasChanges} className="min-h-11 rounded-xl bg-sky-600 px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Importing…' : 'Confirm Import'}</button>
  </>}>
    <section className="space-y-5" aria-label="Import preview — no records written yet">
      <div className="rounded-2xl bg-sky-50 p-4 text-sm leading-relaxed text-sky-900 dark:bg-sky-900/30 dark:text-sky-100">
        <strong>Review before saving.</strong> {preview.filesCount} source file(s) analyzed. No Firebase records have been changed by this preview.
      </div>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map(metric => <div key={metric.label} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-2xl font-extrabold tabular-nums">{metric.value}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{metric.label}</p>
        </div>)}
      </div>
      {report.warnings?.length > 0 && <div className="rounded-2xl border border-amber-300/50 bg-amber-50 p-4 dark:bg-amber-900/20">
        <h3 className="font-bold text-amber-700 dark:text-amber-300">Review warnings ({report.warnings.length})</h3>
        <ul className="mt-2 space-y-2 text-xs leading-5">
          {report.warnings.slice(0, 20).map((w,i) => <li key={i}><strong>{w.title || w.code || 'Review'}:</strong> {w.message || (w.collisions ? `${w.collisions.length} possible conflicts` : 'Please verify this record')}</li>)}
        </ul>
      </div>}
      <section><h3 className="mb-2 font-bold">Planned changes</h3>
        <div className="max-h-[38dvh] space-y-2 overflow-y-auto pr-1">
          {(report.diff || []).map((item,i) => <div key={`${item.title}-${i}`} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-700">
            <span className="min-w-0 truncate text-sm font-medium">{item.title || 'Untitled book'}</span>
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase dark:bg-gray-700">{item.type === 'duplicate' ? 'Skip' : item.type === 'update' ? 'Update' : 'Add'}</span>
          </div>)}
        </div>
      </section>
      <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Existing private notes and published visibility remain protected according to the importer rules. Keep a verified backup before running large imports.</p>
    </section>
  </DiaryEditorModal>;
}
BookmoryImportPreview.propTypes = { preview:PropTypes.object.isRequired, busy:PropTypes.bool, onClose:PropTypes.func.isRequired,onConfirm:PropTypes.func.isRequired };
