export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          title: string;
          starts_at: string;
          ends_at: string | null;
          owner_id: string;
        };
        Insert: {
          id?: string;
          title: string;
          starts_at: string;
          ends_at?: string | null;
          owner_id?: string;
        };
        Update: {
          id?: string;
          title?: string;
          starts_at?: string;
          ends_at?: string | null;
          owner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_people_event_owner_fkey';
            columns: ['id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'event_people';
            referencedColumns: ['event_id', 'owner_id'];
          },
        ];
      };
      people: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_people_person_owner_fkey';
            columns: ['id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'event_people';
            referencedColumns: ['person_id', 'owner_id'];
          },
        ];
      };
      event_people: {
        Row: {
          event_id: string;
          person_id: string;
          owner_id: string;
        };
        Insert: {
          event_id: string;
          person_id: string;
          owner_id?: string;
        };
        Update: {
          event_id?: string;
          person_id?: string;
          owner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_people_event_owner_fkey';
            columns: ['event_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id', 'owner_id'];
          },
          {
            foreignKeyName: 'event_people_person_owner_fkey';
            columns: ['person_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['id', 'owner_id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
