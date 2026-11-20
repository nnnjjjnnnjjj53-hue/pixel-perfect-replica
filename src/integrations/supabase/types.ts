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
      consultation_requests: {
        Row: {
          created_at: string
          customer_note: string | null
          frame_id: string | null
          id: string
          lens_config: Json
          prescription_path: string | null
          share_id: string | null
          status: string
          store_id: string
          total_price: number
        }
        Insert: {
          created_at?: string
          customer_note?: string | null
          frame_id?: string | null
          id?: string
          lens_config?: Json
          prescription_path?: string | null
          share_id?: string | null
          status?: string
          store_id: string
          total_price?: number
        }
        Update: {
          created_at?: string
          customer_note?: string | null
          frame_id?: string | null
          id?: string
          lens_config?: Json
          prescription_path?: string | null
          share_id?: string | null
          status?: string
          store_id?: string
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "consultation_requests_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "frames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_requests_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "tryon_shares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      frames: {
        Row: {
          category: string
          created_at: string
          description: string
          frame_color: string
          id: string
          image_path: string | null
          is_active: boolean
          kind: string
          lens_tint: string | null
          material: string
          model_path: string | null
          name: string
          price: number
          shape: string
          sku: string
          store_id: string
          suits_face_shapes: string[]
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          frame_color?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          kind?: string
          lens_tint?: string | null
          material?: string
          model_path?: string | null
          name: string
          price?: number
          shape?: string
          sku?: string
          store_id: string
          suits_face_shapes?: string[]
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          frame_color?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          kind?: string
          lens_tint?: string | null
          material?: string
          model_path?: string | null
          name?: string
          price?: number
          shape?: string
          sku?: string
          store_id?: string
          suits_face_shapes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "frames_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          method: string
          months: number
          notes: string
          paid_at: string | null
          plan_id: string | null
          reference: string
          status: string
          store_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          method?: string
          months?: number
          notes?: string
          paid_at?: string | null
          plan_id?: string | null
          reference?: string
          status?: string
          store_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string
          months?: number
          notes?: string
          paid_at?: string | null
          plan_id?: string | null
          reference?: string
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      lens_options: {
        Row: {
          code: string
          description: string
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          step: string
          store_id: string
        }
        Insert: {
          code: string
          description?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
          step: string
          store_id: string
        }
        Update: {
          code?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          step?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lens_options_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          currency: string
          description: string
          features: string[]
          frame_limit: number
          id: string
          is_active: boolean
          is_featured: boolean
          name: string
          price_monthly: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string
          features?: string[]
          frame_limit?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name: string
          price_monthly?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string
          features?: string[]
          frame_limit?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name?: string
          price_monthly?: number
          sort_order?: number
        }
        Relationships: []
      }
      share_votes: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          share_id: string
          vote: string
          voter_name: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          share_id: string
          vote: string
          voter_name?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          share_id?: string
          vote?: string
          voter_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_votes_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "tryon_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          brand_color: string
          created_at: string
          id: string
          logo_path: string | null
          name: string
          owner_id: string | null
          plan_id: string | null
          slug: string
          status: string
          subscription_expires_at: string | null
          tagline: string
          whatsapp_number: string
        }
        Insert: {
          brand_color?: string
          created_at?: string
          id?: string
          logo_path?: string | null
          name: string
          owner_id?: string | null
          plan_id?: string | null
          slug: string
          status?: string
          subscription_expires_at?: string | null
          tagline?: string
          whatsapp_number?: string
        }
        Update: {
          brand_color?: string
          created_at?: string
          id?: string
          logo_path?: string | null
          name?: string
          owner_id?: string | null
          plan_id?: string | null
          slug?: string
          status?: string
          subscription_expires_at?: string | null
          tagline?: string
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tryon_events: {
        Row: {
          created_at: string
          event: string
          face_shape: string | null
          frame_id: string | null
          id: number
          store_id: string
        }
        Insert: {
          created_at?: string
          event: string
          face_shape?: string | null
          frame_id?: string | null
          id?: never
          store_id: string
        }
        Update: {
          created_at?: string
          event?: string
          face_shape?: string | null
          frame_id?: string | null
          id?: never
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tryon_events_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "frames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tryon_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      tryon_shares: {
        Row: {
          created_at: string
          customer_name: string | null
          face_shape: string | null
          frame_id: string | null
          front_path: string
          id: string
          side_path: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          face_shape?: string | null
          frame_id?: string | null
          front_path: string
          id: string
          side_path?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          face_shape?: string | null
          frame_id?: string | null
          front_path?: string
          id?: string
          side_path?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tryon_shares_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "frames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tryon_shares_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_tryon_share: { Args: { _id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_store: { Args: { _store_id: string }; Returns: boolean }
      seed_store_lens_options: {
        Args: { _store_id: string }
        Returns: undefined
      }
      store_is_live: { Args: { _store_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "store_owner"
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
    Enums: {
      app_role: ["super_admin", "store_owner"],
    },
  },
} as const
