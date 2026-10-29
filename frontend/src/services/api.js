import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 120000, // forecasts can take time
})

export const getDayAhead = (deliveryDate) =>
  api.get('/api/day-ahead', { params: { delivery_date: deliveryDate } })

export const getAccuracySummary = (start, end) =>
  api.get('/api/accuracy-summary', { params: { start, end } })

export const getActuals = (start, end) =>
  api.get('/api/actuals', { params: { start, end } })

export const getHealth = () => api.get('/health')

export default api
