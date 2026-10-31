import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { email, password, legalName, phone } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // If Service Role Key is configured, auto-create & auto-confirm the user directly!
    if (serviceRoleKey) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data, error } = await adminClient.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: legalName || '',
          phone: phone || '',
        },
      });

      if (error) {
        // If user already exists, update password and confirm email
        if (error.message.includes('already registered')) {
          const { data: usersData } = await adminClient.auth.admin.listUsers();
          const existing = usersData?.users?.find((u) => u.email === email.trim());
          if (existing) {
            await adminClient.auth.admin.updateUserById(existing.id, {
              password,
              email_confirm: true,
            });
            return NextResponse.json({
              success: true,
              autoConfirmed: true,
              message: 'Password updated and email confirmed via Admin API.',
            });
          }
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        autoConfirmed: true,
        user: data.user,
        message: 'Account created and auto-confirmed via Supabase Admin API.',
      });
    }

    // Otherwise report that standard signup is used
    return NextResponse.json({
      success: false,
      hasServiceKey: false,
      message: 'Service role key not configured. Using standard client signup.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
