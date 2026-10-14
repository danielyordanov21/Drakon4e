export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          title: string;
          starts_at: string;
          ends_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          starts_at: string;
          ends_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          starts_at?: string;
          ends_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'event_people_event_id_fkey';
            columns: ['id'];
            isOneToOne: false;
            referencedRelation: 'event_people';
            referencedColumns: ['event_id'];
          },
        ];
      };
      people: {
        Row: {
          id: string;
          name: string;
        };
        Insert: {
          id?: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_people_person_id_fkey';
            columns: ['id'];
            isOneToOne: false;
            referencedRelation: 'event_people';
            referencedColumns: ['person_id'];
          },
        ];
      };
      event_people: {
        Row: {
          event_id: string;
          person_id: string;
        };
        Insert: {
          event_id: string;
          person_id: string;
        };
        Update: {
          event_id?: string;
          person_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_people_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_people_person_id_fkey';
            columns: ['person_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['id'];
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
