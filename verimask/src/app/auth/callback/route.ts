import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore in Server Component/Route handler
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.session) {
      // Sync Google user profile locally if needed
      try {
        const user = data.session.user;
        if (user && (user.email || user.user_metadata?.full_name)) {
          const fs = await import('fs');
          const path = await import('path');
          const profilePath = path.join(process.cwd(), '.data', 'userProfile.json');
          if (fs.existsSync(profilePath)) {
            const raw = fs.readFileSync(profilePath, 'utf8');
            try {
              const profile = JSON.parse(raw);
              profile.email = user.email || profile.email;
              profile.legalName = user.user_metadata?.full_name || user.user_metadata?.name || profile.legalName || 'Google User';
              fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
            } catch {}
          }
        }
      } catch {}

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // return the user to the login page with an error parameter
  return NextResponse.redirect(`${origin}/?error=oauth_exchange_failed`);
}
