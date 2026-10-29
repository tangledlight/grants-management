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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          applicant_id: string
          decided_at: string | null
          decided_by: string | null
          email: string
          grant_id: string
          id: string
          internal_note: string | null
          name: string
          requested_cents: number
          snapshot: Json
          status: string
          submission_key: string
          submitted_at: string
        }
        Insert: {
          applicant_id: string
          decided_at?: string | null
          decided_by?: string | null
          email: string
          grant_id: string
          id?: string
          internal_note?: string | null
          name: string
          requested_cents: number
          snapshot: Json
          status?: string
          submission_key: string
          submitted_at?: string
        }
        Update: {
          applicant_id?: string
          decided_at?: string | null
          decided_by?: string | null
          email?: string
          grant_id?: string
          id?: string
          internal_note?: string | null
          name?: string
          requested_cents?: number
          snapshot?: Json
          status?: string
          submission_key?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "demo_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "demo_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
      }
      awards: {
        Row: {
          amount_cents: number
          application_id: string
          id: string
        }
        Insert: {
          amount_cents: number
          application_id: string
          id?: string
        }
        Update: {
          amount_cents?: number
          application_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "awards_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_state: {
        Row: {
          generation: number
          id: number
        }
        Insert: {
          generation?: number
          id: number
        }
        Update: {
          generation?: number
          id?: number
        }
        Relationships: []
      }
      demo_users: {
        Row: {
          display_name: string
          id: string
          role: string
        }
        Insert: {
          display_name: string
          id?: string
          role: string
        }
        Update: {
          display_name?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          application_id: string
          id: string
          upload_id: string
        }
        Insert: {
          application_id: string
          id?: string
          upload_id: string
        }
        Update: {
          application_id?: string
          id?: string
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: true
            referencedRelation: "upload_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      grants: {
        Row: {
          budget_cents: number
          created_at: string
          creator_id: string
          description: string
          eligibility: string
          id: string
          requirements: Json
          reviewer_id: string
          revision: number
          status: string
          title: string
        }
        Insert: {
          budget_cents: number
          created_at?: string
          creator_id: string
          description: string
          eligibility: string
          id?: string
          requirements: Json
          reviewer_id: string
          revision?: number
          status: string
          title: string
        }
        Update: {
          budget_cents?: number
          created_at?: string
          creator_id?: string
          description?: string
          eligibility?: string
          id?: string
          requirements?: Json
          reviewer_id?: string
          revision?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "grants_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "demo_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grants_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "demo_users"
            referencedColumns: ["id"]
          },
        ]
      }
      simulated_distributions: {
        Row: {
          amount_cents: number
          award_id: string
          id: string
        }
        Insert: {
          amount_cents: number
          award_id: string
          id?: string
        }
        Update: {
          amount_cents?: number
          award_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulated_distributions_award_id_fkey"
            columns: ["award_id"]
            isOneToOne: true
            referencedRelation: "awards"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_intents: {
        Row: {
          applicant_id: string
          consumed: boolean
          expires_at: string
          filename: string
          generation: number
          grant_id: string
          id: string
          mime: string
          object_key: string
          ready: boolean
          requirement_id: string
          revision: number
          size_bytes: number
        }
        Insert: {
          applicant_id: string
          consumed?: boolean
          expires_at?: string
          filename: string
          generation: number
          grant_id: string
          id?: string
          mime: string
          object_key: string
          ready?: boolean
          requirement_id: string
          revision: number
          size_bytes: number
        }
        Update: {
          applicant_id?: string
          consumed?: boolean
          expires_at?: string
          filename?: string
          generation?: number
          grant_id?: string
          id?: string
          mime?: string
          object_key?: string
          ready?: boolean
          requirement_id?: string
          revision?: number
          size_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "upload_intents_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "demo_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_intents_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      demo_mutate: {
        Args: {
          actor: string
          expected_generation: number
          operation: string
          payload: Json
        }
        Returns: Json
      }
      demo_seed: { Args: never; Returns: undefined }
      demo_snapshot: { Args: { actor: string }; Returns: Json }
      validate_grant: { Args: { p: Json }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

