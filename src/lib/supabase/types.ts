// Placeholder database types.
//
// Replaced by Supabase-generated types in task 1.10 (`supabase gen types typescript`).
// Until tables exist, this is an empty-but-valid schema so the typed clients compile.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
	public: {
		Tables: Record<string, never>;
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
}
