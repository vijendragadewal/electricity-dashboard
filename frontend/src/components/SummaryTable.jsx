import React from 'react'

export default function SummaryTable({ daily }) {
  if (!daily || daily.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Delivery Date</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Publish Time Used</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600">n</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600">MAE (MW)</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600">RMSE (MW)</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600">MAPE (%)</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600">Bias (MW)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {daily.map((row) => (
            <tr key={row.deliveryDate} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-medium text-slate-800">{row.deliveryDate}</td>
              <td className="px-3 py-2 text-slate-600">
                {row.selectedPublishTime
                  ? new Date(row.selectedPublishTime).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC'
                  : '—'}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.nPoints || 0}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.metrics?.mae_mw ?? '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.metrics?.rmse_mw ?? '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.metrics?.mape_pct ?? '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.metrics?.bias_mw ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
