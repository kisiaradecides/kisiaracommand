import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the caller is authenticated and is aspirant/super_user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use anon client to verify the calling user's role
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller }, error: callerErr } = await anonClient.auth.getUser()
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check caller's role from the users table
    const { data: callerProfile } = await anonClient
      .from('users')
      .select('role')
      .eq('auth_id', caller.id)
      .single()

    if (!callerProfile || !['aspirant', 'super_user'].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: insufficient role' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse the request body
    const body = await req.json()
    const {
      email, full_name, role, region_id, phone, gender,
      estimated_influence, loyalty_rating, networks,
      private_notes, home_location,
    } = body

    if (!email || !full_name || !role) {
      return new Response(JSON.stringify({ error: 'email, full_name and role are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use service role client for admin operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Derive redirectTo from the Origin header of the request so the invite
    // email links back to whichever host triggered it — localhost or network IP.
    // Falls back to the SITE_URL secret, then localhost.
    const origin = req.headers.get('Origin') ?? req.headers.get('Referer')
    let redirectBase = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'
    if (origin) {
      try {
        const url = new URL(origin)
        // Only trust http/https origins, not extension:// etc.
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          redirectBase = url.origin
        }
      } catch {
        // ignore malformed origin
      }
    }

    // Invite the user — Supabase sends them an email with a magic link
    // deno-lint-ignore prefer-const
    let { data: invited, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name },
        redirectTo: `${redirectBase}/login`,
      }
    )

    if (inviteErr) {
      // User already exists — resend the invite instead of failing
      const alreadyExists =
        inviteErr.message.toLowerCase().includes('already been registered') ||
        inviteErr.message.toLowerCase().includes('already exists') ||
        inviteErr.status === 422

      if (alreadyExists) {
        // Check if profile row already exists
        const { data: existing } = await adminClient
          .from('users')
          .select('id')
          .eq('email', email)
          .maybeSingle()

        if (existing) {
          return new Response(
            JSON.stringify({ error: 'A member with this email already exists. Use Edit to update their profile.' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Auth user exists but no profile — look up auth user and create profile
        const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers()
        const existingAuth = authUsers.find((u) => u.email === email)
        if (!existingAuth) {
          return new Response(JSON.stringify({ error: inviteErr.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        invited = { user: existingAuth } as never
      } else {
        return new Response(JSON.stringify({ error: inviteErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Insert the users table profile row
    const { error: profileErr } = await adminClient.from('users').insert({
      auth_id: invited.user.id,
      email,
      full_name,
      role,
      region_id: region_id ?? null,
      phone: phone || null,
      gender: gender || null,
      estimated_influence: estimated_influence ?? 0,
      loyalty_rating: loyalty_rating ?? null,
      networks: networks ?? null,
      private_notes: private_notes || null,
      home_location: home_location ?? null,
      is_active: true,
    })

    if (profileErr) {
      // Roll back — delete the auth user if profile insert failed
      await adminClient.auth.admin.deleteUser(invited.user.id)
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ success: true, userId: invited.user.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
