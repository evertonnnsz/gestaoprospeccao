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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      campanhas_anuncios: {
        Row: {
          campaign_name: string | null
          clicks: number
          client_id: string
          conversations_started: number
          created_at: string
          custom_metrics: Json | null
          id: string
          impressions: number
          investment: number
          leads_generated: number
          notes: string | null
          period_end: string
          period_start: string
          platform: Database["public"]["Enums"]["ad_platform"]
          source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_name?: string | null
          clicks?: number
          client_id: string
          conversations_started?: number
          created_at?: string
          custom_metrics?: Json | null
          id?: string
          impressions?: number
          investment?: number
          leads_generated?: number
          notes?: string | null
          period_end: string
          period_start: string
          platform: Database["public"]["Enums"]["ad_platform"]
          source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_name?: string | null
          clicks?: number
          client_id?: string
          conversations_started?: number
          created_at?: string
          custom_metrics?: Json | null
          id?: string
          impressions?: number
          investment?: number
          leads_generated?: number
          notes?: string | null
          period_end?: string
          period_start?: string
          platform?: Database["public"]["Enums"]["ad_platform"]
          source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_anuncios_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          contract_duration_months: number | null
          contract_url: string | null
          created_at: string
          id: string
          lead_id: string
          monthly_payment_status: string | null
          notes: string | null
          payment_due_date: string | null
          project_start_date: string | null
          project_value: number | null
          services: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_duration_months?: number | null
          contract_url?: string | null
          created_at?: string
          id?: string
          lead_id: string
          monthly_payment_status?: string | null
          notes?: string | null
          payment_due_date?: string | null
          project_start_date?: string | null
          project_value?: number | null
          services?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_duration_months?: number | null
          contract_url?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          monthly_payment_status?: string | null
          notes?: string | null
          payment_due_date?: string | null
          project_start_date?: string | null
          project_value?: number | null
          services?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          client_id: string | null
          created_at: string
          description: string
          id: string
          notes: string | null
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["expense_category"]
          client_id?: string | null
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          transaction_date?: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          client_id?: string | null
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          transaction_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          approach_date: string | null
          company_name: string
          contact_name: string | null
          created_at: string | null
          follow_up_1: string | null
          follow_up_2: string | null
          follow_up_3: string | null
          id: string
          instagram: string | null
          last_contact: string | null
          lead_source: string | null
          next_action: string | null
          observations: string | null
          responded: boolean | null
          segment: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
          updated_at: string | null
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          approach_date?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string | null
          follow_up_1?: string | null
          follow_up_2?: string | null
          follow_up_3?: string | null
          id?: string
          instagram?: string | null
          last_contact?: string | null
          lead_source?: string | null
          next_action?: string | null
          observations?: string | null
          responded?: boolean | null
          segment?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          updated_at?: string | null
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          approach_date?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string | null
          follow_up_1?: string | null
          follow_up_2?: string | null
          follow_up_3?: string | null
          id?: string
          instagram?: string | null
          last_contact?: string | null
          lead_source?: string | null
          next_action?: string | null
          observations?: string | null
          responded?: boolean | null
          segment?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          updated_at?: string | null
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_logo_url: string | null
          company_name: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_approved: boolean | null
          theme_color: string | null
          updated_at: string | null
        }
        Insert: {
          company_logo_url?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_approved?: boolean | null
          theme_color?: string | null
          updated_at?: string | null
        }
        Update: {
          company_logo_url?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean | null
          theme_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      ad_platform: "meta_ads" | "google_ads"
      app_role: "admin" | "user"
      expense_category:
        | "marketing"
        | "salarios"
        | "aluguel"
        | "ferramentas"
        | "impostos"
        | "outros"
      lead_status:
        | "lead_coletado"
        | "contato_iniciado"
        | "visualizou_nao_respondeu"
        | "interesse_demonstrado"
        | "agendou_reuniao"
        | "reuniao_realizada"
        | "proposta_enviada"
        | "em_negociacao"
        | "fechado"
        | "sem_interesse"
        | "lead_perdido"
      transaction_type: "income" | "expense"
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
      ad_platform: ["meta_ads", "google_ads"],
      app_role: ["admin", "user"],
      expense_category: [
        "marketing",
        "salarios",
        "aluguel",
        "ferramentas",
        "impostos",
        "outros",
      ],
      lead_status: [
        "lead_coletado",
        "contato_iniciado",
        "visualizou_nao_respondeu",
        "interesse_demonstrado",
        "agendou_reuniao",
        "reuniao_realizada",
        "proposta_enviada",
        "em_negociacao",
        "fechado",
        "sem_interesse",
        "lead_perdido",
      ],
      transaction_type: ["income", "expense"],
    },
  },
} as const
