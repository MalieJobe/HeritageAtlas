// Database types.
//
// Hand-maintained for now; task 1.10 wires up `supabase gen types typescript` to
// regenerate this file from the live schema. Keep in sync with supabase/migrations/.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
	public: {
		Tables: {
			profiles: {
				Row: {
					id: string;
					display_name: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id: string;
					display_name?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					display_name?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
}
