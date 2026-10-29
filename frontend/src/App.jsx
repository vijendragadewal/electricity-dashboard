import  { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchDayAhead, fetchAccuracySummary } from './store/forecastSlice'
import DateSelector from './components/DateSelector'
import MetricsCard from './components/MetricsCard'
import ForecastChart from './components/ForecastChart'
import ErrorChart from './components/ErrorChart'
import SummaryTable from './components/SummaryTable'

function App() {
  const dispatch = useDispatch()
  const {
    deliveryDate,
    dayAhead,
    summary,
    loading,
    summaryLoading,
    error,
    summaryError,
  } = useSelector((s) => s.forecast)

  useEffect(() => {
    dispatch(fetchDayAhead(deliveryDate))
    dispatch(fetchAccuracySummary({ start: '2026-01-01', end: '2026-01-07' }))
  }, [dispatch])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-brand-800 text-white shadow">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <h1 className="text-xl font-semibold tracking-tight">
            PowerPredict
          </h1>
          <p className="mt-1 text-sm text-brand-100">
            Day-ahead market decision support · National wind (Elexon BMRS) · January 2026 pilot
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-8">
        {/* Purpose */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800">Purpose</h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            This pilot tool helps the procurement team understand the latest wind generation forecasts
            available when making day-ahead market purchase decisions, and quantifies forecast error
            so decisions can explicitly account for uncertainty. Data is restricted to national wind
            actuals (FUELHH) and forecasts (WINDFOR) from Elexon for January 2026.
          </p>
        </section>

        {/* Day selector + single-day analysis */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-800">
              Day-Ahead Forecast vs Actual
            </h2>
            <DateSelector />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {typeof error === 'string' ? error : JSON.stringify(error)}
            </div>
          )}

          {dayAhead && (
            <>
              <div className="text-sm text-slate-600">
                <span className="font-medium">Selected publish time used for decision:</span>{' '}
                {dayAhead.selectedPublishTime
                  ? new Date(dayAhead.selectedPublishTime).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC'
                  : 'None found'}
                {dayAhead.message && dayAhead.message !== 'OK' && (
                  <span className="ml-2 text-amber-600">({dayAhead.message})</span>
                )}
              </div>

              <MetricsCard metrics={dayAhead.metrics} />

              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">Forecast vs Actual (aligned)</h3>
                <ForecastChart aligned={dayAhead.aligned} />
              </div>

              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">Error (Forecast − Actual)</h3>
                <ErrorChart aligned={dayAhead.aligned} />
              </div>
            </>
          )}

          {loading && !dayAhead && (
            <div className="py-12 text-center text-slate-500">Fetching and aligning data…</div>
          )}
        </section>

        {/* Multi-day accuracy summary */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-800">
            Quantitative Accuracy Summary (1–7 Jan 2026)
          </h2>
          <p className="text-sm text-slate-600">
            For each delivery day the latest forecast published before that day is selected
            (simulating the information set available for day-ahead decisions) and compared
            with realised FUELHH wind generation. Metrics are computed only on overlapping timestamps.
          </p>

          {summaryError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {typeof summaryError === 'string' ? summaryError : JSON.stringify(summaryError)}
            </div>
          )}

          {summaryLoading && (
            <div className="py-8 text-center text-slate-500 animate-pulse">
              Computing multi-day accuracy metrics…
            </div>
          )}

          {summary && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-xs text-slate-500">Overall Mean MAE</div>
                  <div className="text-lg font-semibold">{summary.overall?.mean_mae_mw ?? '—'} MW</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-xs text-slate-500">Overall Mean RMSE</div>
                  <div className="text-lg font-semibold">{summary.overall?.mean_rmse_mw ?? '—'} MW</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-xs text-slate-500">Overall Mean MAPE</div>
                  <div className="text-lg font-semibold">{summary.overall?.mean_mape_pct ?? '—'} %</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-xs text-slate-500">Overall Mean Bias</div>
                  <div className="text-lg font-semibold">{summary.overall?.mean_bias_mw ?? '—'} MW</div>
                </div>
              </div>
              <SummaryTable daily={summary.daily} />
            </>
          )}
        </section>

        {/* Methodology note */}
        <section className="bg-slate-100 rounded-xl border border-slate-200 p-5 text-sm text-slate-600 space-y-2">
          <h3 className="font-semibold text-slate-800">Methodology (accuracy focus)</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Actuals: Elexon FUELHH, fuelType = WIND, 30-minute resolution.</li>
            <li>Forecasts: Elexon WINDFOR. For each delivery day D the latest publishTime strictly before 00:00 UTC of D is selected.</li>
            <li>Alignment: forecast timestamps rounded to nearest 30 min and inner-joined with actuals on startTime.</li>
            <li>Error = Forecast − Actual. MAE, RMSE, MAPE and Bias are calculated on the aligned series only.</li>
            <li>Scope deliberately limited to national wind and January 2026 as required by the pilot brief.</li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Pilot product · Data source: Elexon Insights (BMRS) · Built for accuracy over presentation
      </footer>
    </div>
  )
}

export default App
