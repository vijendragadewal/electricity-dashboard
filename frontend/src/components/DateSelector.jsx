import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setDeliveryDate, fetchDayAhead } from '../store/forecastSlice'

export default function DateSelector() {
  const dispatch = useDispatch()
  const { deliveryDate, loading } = useSelector((s) => s.forecast)

  const handleChange = (e) => {
    const d = e.target.value
    dispatch(setDeliveryDate(d))
    dispatch(fetchDayAhead(d))
  }

  // Generate Jan 2026 options
  const options = []
  for (let day = 1; day <= 31; day++) {
    const d = `2026-01-${String(day).padStart(2, '0')}`
    options.push(d)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm font-medium text-slate-700">Delivery Day (Jan 2026)</label>
      <select
        value={deliveryDate}
        onChange={handleChange}
        disabled={loading}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {options.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      {loading && (
        <span className="text-sm text-slate-500 animate-pulse">Loading accurate data…</span>
      )}
    </div>
  )
}
