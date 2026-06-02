export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      events: {
        Row: {
          created_at: string
          event_date: string | null
          event_date_end: string | null
          event_precision: Database["public"]["Enums"]["date_precision"] | null
          event_qualifier: Database["public"]["Enums"]["date_qualifier"] | null
          id: string
          label: string | null
          note: string | null
          person_id: string
          place_id: string | null
          tree_id: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_date?: string | null
          event_date_end?: string | null
          event_precision?: Database["public"]["Enums"]["date_precision"] | null
          event_qualifier?: Database["public"]["Enums"]["date_qualifier"] | null
          id?: string
          label?: string | null
          note?: string | null
          person_id: string
          place_id?: string | null
          tree_id: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_date?: string | null
          event_date_end?: string | null
          event_precision?: Database["public"]["Enums"]["date_precision"] | null
          event_qualifier?: Database["public"]["Enums"]["date_qualifier"] | null
          id?: string
          label?: string | null
          note?: string | null
          person_id?: string
          place_id?: string | null
          tree_id?: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_person_id_tree_id_fkey"
            columns: ["person_id", "tree_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id", "tree_id"]
          },
          {
            foreignKeyName: "events_place_id_tree_id_fkey"
            columns: ["place_id", "tree_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id", "tree_id"]
          },
          {
            foreignKeyName: "events_tree_id_fkey"
            columns: ["tree_id"]
            isOneToOne: false
            referencedRelation: "trees"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["tree_role"]
          tree_id: string
          tree_name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["tree_role"]
          tree_id: string
          tree_name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["tree_role"]
          tree_id?: string
          tree_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_tree_id_fkey"
            columns: ["tree_id"]
            isOneToOne: false
            referencedRelation: "trees"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_child_links: {
        Row: {
          child_id: string
          created_at: string
          id: string
          parent_id: string
          tree_id: string
          updated_at: string
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          parent_id: string
          tree_id: string
          updated_at?: string
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          parent_id?: string
          tree_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_child_links_child_id_tree_id_fkey"
            columns: ["child_id", "tree_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id", "tree_id"]
          },
          {
            foreignKeyName: "parent_child_links_parent_id_tree_id_fkey"
            columns: ["parent_id", "tree_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id", "tree_id"]
          },
          {
            foreignKeyName: "parent_child_links_tree_id_fkey"
            columns: ["tree_id"]
            isOneToOne: false
            referencedRelation: "trees"
            referencedColumns: ["id"]
          },
        ]
      }
      partnerships: {
        Row: {
          created_at: string
          id: string
          partner_a: string
          partner_b: string
          status: Database["public"]["Enums"]["partnership_status"]
          tree_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          partner_a: string
          partner_b: string
          status?: Database["public"]["Enums"]["partnership_status"]
          tree_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          partner_a?: string
          partner_b?: string
          status?: Database["public"]["Enums"]["partnership_status"]
          tree_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnerships_partner_a_tree_id_fkey"
            columns: ["partner_a", "tree_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id", "tree_id"]
          },
          {
            foreignKeyName: "partnerships_partner_b_tree_id_fkey"
            columns: ["partner_b", "tree_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id", "tree_id"]
          },
          {
            foreignKeyName: "partnerships_tree_id_fkey"
            columns: ["tree_id"]
            isOneToOne: false
            referencedRelation: "trees"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          birth_surname: string | null
          created_at: string
          gender: string | null
          given_names: string | null
          id: string
          nickname: string | null
          notes: string | null
          profile_photo_path: string | null
          sex: string | null
          surname: string | null
          tree_id: string
          updated_at: string
        }
        Insert: {
          birth_surname?: string | null
          created_at?: string
          gender?: string | null
          given_names?: string | null
          id?: string
          nickname?: string | null
          notes?: string | null
          profile_photo_path?: string | null
          sex?: string | null
          surname?: string | null
          tree_id: string
          updated_at?: string
        }
        Update: {
          birth_surname?: string | null
          created_at?: string
          gender?: string | null
          given_names?: string | null
          id?: string
          nickname?: string | null
          notes?: string | null
          profile_photo_path?: string | null
          sex?: string | null
          surname?: string | null
          tree_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "persons_tree_id_fkey"
            columns: ["tree_id"]
            isOneToOne: false
            referencedRelation: "trees"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          created_at: string
          historical_name: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          source: Database["public"]["Enums"]["place_source"]
          tree_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          historical_name?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          source?: Database["public"]["Enums"]["place_source"]
          tree_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          historical_name?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          source?: Database["public"]["Enums"]["place_source"]
          tree_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_tree_id_fkey"
            columns: ["tree_id"]
            isOneToOne: false
            referencedRelation: "trees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tree_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["tree_role"]
          tree_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["tree_role"]
          tree_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["tree_role"]
          tree_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tree_members_tree_id_fkey"
            columns: ["tree_id"]
            isOneToOne: false
            referencedRelation: "trees"
            referencedColumns: ["id"]
          },
        ]
      }
      trees: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      date_precision: "day" | "month" | "year"
      date_qualifier:
        | "exact"
        | "about"
        | "before"
        | "after"
        | "between"
        | "estimated"
      event_type:
        | "birth"
        | "death"
        | "marriage"
        | "residence"
        | "occupation"
        | "custom"
      partnership_status: "current" | "former"
      place_source: "geocoded" | "manual"
      tree_role: "owner" | "editor" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      date_precision: ["day", "month", "year"],
      date_qualifier: [
        "exact",
        "about",
        "before",
        "after",
        "between",
        "estimated",
      ],
      event_type: [
        "birth",
        "death",
        "marriage",
        "residence",
        "occupation",
        "custom",
      ],
      partnership_status: ["current", "former"],
      place_source: ["geocoded", "manual"],
      tree_role: ["owner", "editor", "viewer"],
    },
  },
} as const
