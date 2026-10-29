import React from 'react'

function Metric({ label, value, unit, hint }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-slate-900">{value ?? '—'}</span>
        {unit && <span className="text-sm text-slate-500">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  )
}

export default function MetricsCard({ metrics }) {
  if (!metrics || Object.keys(metrics).length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
        No quantitative metrics available for this day (insufficient overlapping data).
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Metric label="MAE" value={metrics.mae_mw} unit="MW" hint="Mean Absolute Error" />
      <Metric label="RMSE" value={metrics.rmse_mw} unit="MW" hint="Root Mean Square Error" />
      <Metric label="MAPE" value={metrics.mape_pct} unit="%" hint="Mean Absolute % Error" />
      <Metric label="Bias" value={metrics.bias_mw} unit="MW" hint="Mean Error (positive = over-forecast)" />
      <Metric label="Max |Error|" value={metrics.max_abs_error_mw} unit="MW" />
      <Metric label="Points" value={metrics.n} unit="" />
      <Metric label="Mean Actual" value={metrics.mean_actual_mw} unit="MW" />
      <Metric label="Mean Forecast" value={metrics.mean_forecast_mw} unit="MW" />
    </div>
  )
}
