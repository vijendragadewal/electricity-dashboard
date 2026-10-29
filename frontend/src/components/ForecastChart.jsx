import React from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

export default function ForecastChart({ aligned }) {
  if (!aligned || aligned.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-500">
        No aligned forecast vs actual points to chart
      </div>
    )
  }

  const data = aligned.map((d) => ({
    time: new Date(d.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    fullTime: d.startTime,
    forecast: d.forecast,
    actual: d.actual,
    error: d.error,
  }))

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            label={{ value: 'MW', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value, name) => [value != null ? `${value} MW` : '—', name]}
            labelFormatter={(label) => `Time: ${label}`}
          />
          <Legend />
          <Line type="monotone" dataKey="forecast" stroke="#0284c7" strokeWidth={2} dot={false} name="Forecast" />
          <Line type="monotone" dataKey="actual" stroke="#16a34a" strokeWidth={2} dot={false} name="Actual" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
