import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { getDayAhead, getAccuracySummary } from '../services/api'

export const fetchDayAhead = createAsyncThunk(
  'forecast/fetchDayAhead',
  async (deliveryDate, { rejectWithValue }) => {
    try {
      const res = await getDayAhead(deliveryDate)
      return res.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || err.message)
    }
  }
)

export const fetchAccuracySummary = createAsyncThunk(
  'forecast/fetchAccuracySummary',
  async ({ start, end }, { rejectWithValue }) => {
    try {
      const res = await getAccuracySummary(start, end)
      return res.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || err.message)
    }
  }
)

const initialState = {
  deliveryDate: '2026-01-05',
  dayAhead: null,
  summary: null,
  loading: false,
  summaryLoading: false,
  error: null,
  summaryError: null,
}

const forecastSlice = createSlice({
  name: 'forecast',
  initialState,
  reducers: {
    setDeliveryDate: (state, action) => {
      state.deliveryDate = action.payload
    },
    clearError: (state) => {
      state.error = null
      state.summaryError = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDayAhead.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchDayAhead.fulfilled, (state, action) => {
        state.loading = false
        state.dayAhead = action.payload
      })
      .addCase(fetchDayAhead.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(fetchAccuracySummary.pending, (state) => {
        state.summaryLoading = true
        state.summaryError = null
      })
      .addCase(fetchAccuracySummary.fulfilled, (state, action) => {
        state.summaryLoading = false
        state.summary = action.payload
      })
      .addCase(fetchAccuracySummary.rejected, (state, action) => {
        state.summaryLoading = false
        state.summaryError = action.payload
      })
  },
})

export const { setDeliveryDate, clearError } = forecastSlice.actions
export default forecastSlice.reducer
