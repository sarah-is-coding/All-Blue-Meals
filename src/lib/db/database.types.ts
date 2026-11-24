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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ingredient_aliases: {
        Row: {
          alias_key: string
          alias_name: string
          created_at: string
          id: string
          ingredient_id: string
          source: string
          status: string
        }
        Insert: {
          alias_key: string
          alias_name: string
          created_at?: string
          id?: string
          ingredient_id: string
          source: string
          status?: string
        }
        Update: {
          alias_key?: string
          alias_name?: string
          created_at?: string
          id?: string
          ingredient_id?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_aliases_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_categories: {
        Row: {
          description: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          description: string
          id: string
          name: string
          sort_order: number
        }
        Update: {
          description?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          category: string
          created_at: string
          default_unit: string | null
          id: string
          name: string
          name_key: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_unit?: string | null
          id?: string
          name: string
          name_key: string
        }
        Update: {
          category?: string
          created_at?: string
          default_unit?: string | null
          id?: string
          name?: string
          name_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "ingredient_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_meals: {
        Row: {
          created_at: string
          id: string
          meal_type: string
          notes: string | null
          planned_for: string
          recipe_id: string | null
          servings_override: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meal_type: string
          notes?: string | null
          planned_for: string
          recipe_id?: string | null
          servings_override?: number | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          meal_type?: string
          notes?: string | null
          planned_for?: string
          recipe_id?: string | null
          servings_override?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_meals_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          plan_cadence_count: number
          plan_cadence_unit: string
          user_id: string
          week_starts_on: number
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          plan_cadence_count?: number
          plan_cadence_unit?: string
          user_id: string
          week_starts_on?: number
        }
        Update: {
          created_at?: string
          display_name?: string | null
          plan_cadence_count?: number
          plan_cadence_unit?: string
          user_id?: string
          week_starts_on?: number
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          notes: string | null
          position: number
          quantity: string | null
          quantity_numeric: number | null
          recipe_id: string
          substitute_for: string | null
          unit: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          notes?: string | null
          position?: number
          quantity?: string | null
          quantity_numeric?: number | null
          recipe_id: string
          substitute_for?: string | null
          unit?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          notes?: string | null
          position?: number
          quantity?: string | null
          quantity_numeric?: number | null
          recipe_id?: string
          substitute_for?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_substitute_for_fkey"
            columns: ["recipe_id", "substitute_for"]
            isOneToOne: false
            referencedRelation: "recipe_ingredients"
            referencedColumns: ["recipe_id", "id"]
          },
        ]
      }
      recipe_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          recipe_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          recipe_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          recipe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_notes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          cook_minutes: number | null
          created_at: string
          description: string | null
          id: string
          instructions: string | null
          prep_minutes: number | null
          rating: number | null
          servings: number | null
          source_url: string | null
          tags: string[] | null
          tags_lower: string[] | null
          title: string
          user_id: string
        }
        Insert: {
          cook_minutes?: number | null
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          prep_minutes?: number | null
          rating?: number | null
          servings?: number | null
          source_url?: string | null
          tags?: string[] | null
          tags_lower?: string[] | null
          title: string
          user_id: string
        }
        Update: {
          cook_minutes?: number | null
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          prep_minutes?: number | null
          rating?: number | null
          servings?: number | null
          source_url?: string | null
          tags?: string[] | null
          tags_lower?: string[] | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_plan_meals: {
        Row: {
          day_offset: number
          id: string
          meal_type: string
          recipe_id: string | null
          saved_plan_id: string
          servings_override: number | null
        }
        Insert: {
          day_offset: number
          id?: string
          meal_type: string
          recipe_id?: string | null
          saved_plan_id: string
          servings_override?: number | null
        }
        Update: {
          day_offset?: number
          id?: string
          meal_type?: string
          recipe_id?: string | null
          saved_plan_id?: string
          servings_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_plan_meals_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_plan_meals_saved_plan_id_fkey"
            columns: ["saved_plan_id"]
            isOneToOne: false
            referencedRelation: "saved_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_plans: {
        Row: {
          created_at: string
          id: string
          name: string
          source_end_date: string
          source_start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          source_end_date: string
          source_start_date: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          source_end_date?: string
          source_start_date?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_ingredient_alias: {
        Args: {
          p_alias_key: string
          p_alias_name: string
          p_category: string
          p_ingredient_id: string
        }
        Returns: boolean
      }
      ingredient_name_words: { Args: { p_name: string }; Returns: string[] }
      ingredient_word_forms: { Args: { p_word: string }; Returns: string[] }
      lowercase_tags: { Args: { p_tags: string[] }; Returns: string[] }
      save_recipe_ingredients: {
        Args: { p_recipe_id: string; p_rows: Json }
        Returns: undefined
      }
      upgrade_ingredient_category: {
        Args: { p_category: string; p_ingredient_id: string }
        Returns: undefined
      }
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
