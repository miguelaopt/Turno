// Tipos da base de dados no formato de `supabase gen types typescript`.
//
// Escritos à mão a partir de supabase/migrations/*.sql
// porque esta sessão não tinha um Supabase a correr. Depois de aplicar a
// migração, regenerar com:
//
//   pnpm --filter @turno/shared gen:types        (Supabase local)
//
// e confirmar que o diff só tem diferenças de formatação.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Tables: {
      notifications: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['notification_kind'];
          read_at: string | null;
          store_id: string;
          swap_request_id: string | null;
          title: string;
          urgent: boolean;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          kind: Database['public']['Enums']['notification_kind'];
          read_at?: string | null;
          store_id: string;
          swap_request_id?: string | null;
          title: string;
          urgent?: boolean;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['notification_kind'];
          read_at?: string | null;
          store_id?: string;
          swap_request_id?: string | null;
          title?: string;
          urgent?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_swap_request_id_fkey';
            columns: ['swap_request_id'];
            isOneToOne: false;
            referencedRelation: 'swap_requests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          role: Database['public']['Enums']['user_role'];
          store_id: string;
          updated_at: string;
          weekly_hours: number;
        };
        Insert: {
          created_at?: string;
          id: string;
          name: string;
          role?: Database['public']['Enums']['user_role'];
          store_id: string;
          updated_at?: string;
          weekly_hours?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          role?: Database['public']['Enums']['user_role'];
          store_id?: string;
          updated_at?: string;
          weekly_hours?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      push_tokens: {
        Row: {
          created_at: string;
          id: string;
          platform: Database['public']['Enums']['push_platform'];
          token: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          platform: Database['public']['Enums']['push_platform'];
          token: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          platform?: Database['public']['Enums']['push_platform'];
          token?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      shifts: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          source: Database['public']['Enums']['shift_source'];
          starts_at: string;
          store_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          source?: Database['public']['Enums']['shift_source'];
          starts_at: string;
          store_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          source?: Database['public']['Enums']['shift_source'];
          starts_at?: string;
          store_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shifts_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shifts_user_store_fk';
            columns: ['user_id', 'store_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'store_id'];
          },
        ];
      };
      stores: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      swap_request_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: number;
          kind: Database['public']['Enums']['swap_event_kind'];
          note: string | null;
          store_id: string;
          swap_request_id: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: never;
          kind: Database['public']['Enums']['swap_event_kind'];
          note?: string | null;
          store_id: string;
          swap_request_id: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: never;
          kind?: Database['public']['Enums']['swap_event_kind'];
          note?: string | null;
          store_id?: string;
          swap_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'swap_request_events_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'swap_request_events_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'swap_request_events_swap_request_id_fkey';
            columns: ['swap_request_id'];
            isOneToOne: false;
            referencedRelation: 'swap_requests';
            referencedColumns: ['id'];
          },
        ];
      };
      swap_requests: {
        Row: {
          accepted_by: string | null;
          created_at: string;
          decided_by: string | null;
          id: string;
          note: string | null;
          requester_id: string;
          shift_id: string;
          status: Database['public']['Enums']['swap_status'];
          store_id: string;
          type: Database['public']['Enums']['swap_type'];
          updated_at: string;
          accepted_at: string | null;
          decided_at: string | null;
          decision_note: string | null;
          mpi_updated_at: string | null;
          mpi_updated_by: string | null;
          offered_shift_id: string | null;
        };
        Insert: {
          accepted_by?: string | null;
          created_at?: string;
          decided_by?: string | null;
          id?: string;
          note?: string | null;
          requester_id: string;
          shift_id: string;
          status?: Database['public']['Enums']['swap_status'];
          store_id: string;
          type: Database['public']['Enums']['swap_type'];
          updated_at?: string;
          accepted_at?: string | null;
          decided_at?: string | null;
          decision_note?: string | null;
          mpi_updated_at?: string | null;
          mpi_updated_by?: string | null;
          offered_shift_id?: string | null;
        };
        Update: {
          accepted_by?: string | null;
          created_at?: string;
          decided_by?: string | null;
          id?: string;
          note?: string | null;
          requester_id?: string;
          shift_id?: string;
          status?: Database['public']['Enums']['swap_status'];
          store_id?: string;
          type?: Database['public']['Enums']['swap_type'];
          updated_at?: string;
          accepted_at?: string | null;
          decided_at?: string | null;
          decision_note?: string | null;
          mpi_updated_at?: string | null;
          mpi_updated_by?: string | null;
          offered_shift_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'swap_requests_accepted_by_fkey';
            columns: ['accepted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'swap_requests_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'swap_requests_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'swap_requests_mpi_updated_by_fkey';
            columns: ['mpi_updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'swap_requests_offered_shift_store_fk';
            columns: ['offered_shift_id', 'store_id'];
            isOneToOne: false;
            referencedRelation: 'shifts';
            referencedColumns: ['id', 'store_id'];
          },
          {
            foreignKeyName: 'swap_requests_shift_store_fk';
            columns: ['shift_id', 'store_id'];
            isOneToOne: false;
            referencedRelation: 'shifts';
            referencedColumns: ['id', 'store_id'];
          },
          {
            foreignKeyName: 'swap_requests_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      mark_swap_mpi_updated: {
        Args: { p_request_id: string };
        Returns: Database['public']['Tables']['swap_requests']['Row'];
      };
      register_push_token: {
        Args: {
          p_platform: Database['public']['Enums']['push_platform'];
          p_token: string;
        };
        Returns: undefined;
      };
      transition_swap_request: {
        Args: {
          p_note?: string;
          p_offered_shift_id?: string;
          p_request_id: string;
          p_status: Database['public']['Enums']['swap_status'];
        };
        Returns: Database['public']['Tables']['swap_requests']['Row'];
      };
      unregister_push_token: {
        Args: { p_token: string };
        Returns: undefined;
      };
    };
    Enums: {
      notification_kind:
        | 'swap_open'
        | 'swap_accepted'
        | 'swap_to_decide'
        | 'swap_approved'
        | 'swap_rejected'
        | 'swap_cancelled';
      push_platform: 'ios' | 'android' | 'web';
      shift_source: 'manual' | 'screenshot';
      swap_event_kind:
        'created' | 'accepted' | 'approved' | 'rejected' | 'cancelled' | 'mpi_updated';
      swap_status: 'open' | 'accepted' | 'approved' | 'rejected' | 'cancelled';
      swap_type: 'swap' | 'give' | 'cover';
      user_role: 'worker' | 'manager';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

export const Constants = {
  public: {
    Enums: {
      notification_kind: [
        'swap_open',
        'swap_accepted',
        'swap_to_decide',
        'swap_approved',
        'swap_rejected',
        'swap_cancelled',
      ],
      push_platform: ['ios', 'android', 'web'],
      shift_source: ['manual', 'screenshot'],
      swap_event_kind: ['created', 'accepted', 'approved', 'rejected', 'cancelled', 'mpi_updated'],
      swap_status: ['open', 'accepted', 'approved', 'rejected', 'cancelled'],
      swap_type: ['swap', 'give', 'cover'],
      user_role: ['worker', 'manager'],
    },
  },
} as const;
