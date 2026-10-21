export interface Person {
  id: string;
  name: string;
  grade?: number | null;
  books?: string | null;
  notes?: string | null;
  small_notes?: string | null;
}

export interface PersonInput {
  name: string;
  grade: number | null;
  books: string | null;
  notes: string | null;
  small_notes: string | null;
}