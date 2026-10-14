import { InjectionToken } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../models/database.types';
import { environment } from '../../environments/environment';

export type SupabaseClientFactory = () => Promise<SupabaseClient<Database>>;

export const SUPABASE_CLIENT = new InjectionToken<SupabaseClientFactory>(
  'SUPABASE_CLIENT',
  {
    providedIn: 'root',
    factory: () => {
      let clientPromise: Promise<SupabaseClient<Database>> | undefined;
      return () => {
        if (!environment.supabaseUrl || !environment.supabasePublishableKey) {
          return Promise.reject(
            new Error(
              'Supabase is not configured. Set supabaseUrl and supabasePublishableKey in src/environments/environment.ts.',
            ),
          );
        }

        clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
          createClient<Database>(
            environment.supabaseUrl,
            environment.supabasePublishableKey,
          ),
        );
        return clientPromise;
      };
    },
  },
);
