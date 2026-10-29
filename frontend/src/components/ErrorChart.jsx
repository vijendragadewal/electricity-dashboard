import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'

export default function ErrorChart({ aligned }) {
  if (!aligned || aligned.length === 0) return null

  const data = aligned.map((d) => ({
    time: new Date(d.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    error: d.error,
  }))

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v) => [`${v} MW`, 'Error (F−A)']}
            contentStyle={{ fontSize: 12 }}
          />
          <ReferenceLine y={0} stroke="#64748b" />
          <Bar dataKey="error" fill="#f97316" name="Error (Forecast − Actual)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
