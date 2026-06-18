import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { supabase } from '../../lib/supabase'
import type { AppUser } from '../../types/models'

interface AuthState {
  user: AppUser | null
  loading: boolean
  error: string | null
  initialized: boolean
}

const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
  initialized: false,
}

export const signIn = createAsyncThunk(
  'auth/signIn',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return rejectWithValue(error.message)

    // Give the session a moment to propagate before querying with RLS
    await new Promise((r) => setTimeout(r, 150))

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*, region:regions(id,name,code,color,total_voters)')
      .eq('auth_id', data.user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Profile query error:', JSON.stringify(profileError))
      return rejectWithValue(`Profile query failed: ${profileError.message}`)
    }
    if (!profile) {
      console.error('No profile row for auth_id:', data.user.id)
      return rejectWithValue('Profile not found. Contact your administrator.')
    }
    return profile as AppUser
  }
)

export const signOut = createAsyncThunk('auth/signOut', async () => {
  await supabase.auth.signOut()
})

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile, error } = await supabase
      .from('users')
      .select('*, region:regions(id,name,code,color,total_voters)')
      .eq('auth_id', user.id)
      .single()

    if (error) return rejectWithValue('Profile load failed')
    return profile as AppUser
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null },
    setInitialized: (state) => { state.initialized = true },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signIn.pending, (state) => { state.loading = true; state.error = null })
      .addCase(signIn.fulfilled, (state, action: PayloadAction<AppUser>) => {
        state.loading = false; state.user = action.payload; state.initialized = true
      })
      .addCase(signIn.rejected, (state, action) => {
        state.loading = false; state.error = action.payload as string; state.initialized = true
      })
      .addCase(signOut.fulfilled, (state) => {
        state.user = null; state.error = null
      })
      .addCase(fetchCurrentUser.pending, (state) => { state.loading = true })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false; state.user = action.payload; state.initialized = true
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.loading = false; state.initialized = true
      })
  },
})

export const { clearError, setInitialized } = authSlice.actions
export default authSlice.reducer
