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
      ai_models: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          min_tier: Database["public"]["Enums"]["subscription_tier"]
          name: string
          tier: Database["public"]["Enums"]["ai_model_tier"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          min_tier?: Database["public"]["Enums"]["subscription_tier"]
          name: string
          tier: Database["public"]["Enums"]["ai_model_tier"]
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          min_tier?: Database["public"]["Enums"]["subscription_tier"]
          name?: string
          tier?: Database["public"]["Enums"]["ai_model_tier"]
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          action_type: Database["public"]["Enums"]["ai_action_type"]
          completion_tokens: number
          created_at: string
          id: string
          model_id: string | null
          prompt_tokens: number
          total_tokens: number
          user_id: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["ai_action_type"]
          completion_tokens?: number
          created_at?: string
          id?: string
          model_id?: string | null
          prompt_tokens?: number
          total_tokens?: number
          user_id?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["ai_action_type"]
          completion_tokens?: number
          created_at?: string
          id?: string
          model_id?: string | null
          prompt_tokens?: number
          total_tokens?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile_info"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_recipes: {
        Row: {
          collection_id: string
          recipe_id: string
        }
        Insert: {
          collection_id: string
          recipe_id: string
        }
        Update: {
          collection_id?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_recipes_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string
          id: string
          is_public: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_public?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_public?: boolean
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile_info"
            referencedColumns: ["id"]
          },
        ]
      }
      cuisines: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          region: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          region?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          region?: string | null
          slug?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile_info"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          aliases: string[]
          category: Database["public"]["Enums"]["food_category"]
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          aliases?: string[]
          category?: Database["public"]["Enums"]["food_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          aliases?: string[]
          category?: Database["public"]["Enums"]["food_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      order_receipts: {
        Row: {
          created_at: string
          currency: string
          external_order_id: string | null
          id: string
          provider: string
          status: Database["public"]["Enums"]["order_status"]
          total_minor: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          external_order_id?: string | null
          id?: string
          provider: string
          status?: Database["public"]["Enums"]["order_status"]
          total_minor?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          external_order_id?: string | null
          id?: string
          provider?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_minor?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile_info"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_model_id: string | null
          avatar_url: string | null
          created_at: string
          dietary_preferences: Database["public"]["Enums"]["dietary_tag"][]
          display_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          tokens_remaining: number
          unit_preference: Database["public"]["Enums"]["unit_preference"]
          updated_at: string
        }
        Insert: {
          ai_model_id?: string | null
          avatar_url?: string | null
          created_at?: string
          dietary_preferences?: Database["public"]["Enums"]["dietary_tag"][]
          display_name?: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          tokens_remaining?: number
          unit_preference?: Database["public"]["Enums"]["unit_preference"]
          updated_at?: string
        }
        Update: {
          ai_model_id?: string | null
          avatar_url?: string | null
          created_at?: string
          dietary_preferences?: Database["public"]["Enums"]["dietary_tag"][]
          display_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          tokens_remaining?: number
          unit_preference?: Database["public"]["Enums"]["unit_preference"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_ai_model_id_fkey"
            columns: ["ai_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          id: string
          ingredient_id: string
          is_optional: boolean
          note: string | null
          position: number
          quantity: number | null
          raw_text: string | null
          recipe_id: string
          unit: string | null
        }
        Insert: {
          id?: string
          ingredient_id: string
          is_optional?: boolean
          note?: string | null
          position: number
          quantity?: number | null
          raw_text?: string | null
          recipe_id: string
          unit?: string | null
        }
        Update: {
          id?: string
          ingredient_id?: string
          is_optional?: boolean
          note?: string | null
          position?: number
          quantity?: number | null
          raw_text?: string | null
          recipe_id?: string
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
            foreignKeyName: "recipe_ingredients_unit_fkey"
            columns: ["unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      recipe_nutrition: {
        Row: {
          calories_per_serving: number | null
          carbs_grams: number | null
          computed_at: string | null
          fat_grams: number | null
          fiber_grams: number | null
          nutrition_source: Database["public"]["Enums"]["nutrition_source"]
          protein_grams: number | null
          recipe_id: string
          sodium_mg: number | null
          sugar_grams: number | null
        }
        Insert: {
          calories_per_serving?: number | null
          carbs_grams?: number | null
          computed_at?: string | null
          fat_grams?: number | null
          fiber_grams?: number | null
          nutrition_source: Database["public"]["Enums"]["nutrition_source"]
          protein_grams?: number | null
          recipe_id: string
          sodium_mg?: number | null
          sugar_grams?: number | null
        }
        Update: {
          calories_per_serving?: number | null
          carbs_grams?: number | null
          computed_at?: string | null
          fat_grams?: number | null
          fiber_grams?: number | null
          nutrition_source?: Database["public"]["Enums"]["nutrition_source"]
          protein_grams?: number | null
          recipe_id?: string
          sodium_mg?: number | null
          sugar_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_nutrition_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: true
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_revisions: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          payload: Json
          recipe_id: string
          status: Database["public"]["Enums"]["moderation_status"]
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          payload: Json
          recipe_id: string
          status?: Database["public"]["Enums"]["moderation_status"]
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          recipe_id?: string
          status?: Database["public"]["Enums"]["moderation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_revisions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_revisions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profile_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_revisions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_steps: {
        Row: {
          estimated_time_minutes: number | null
          id: string
          instruction: string
          position: number
          recipe_id: string
          timer_seconds: number | null
        }
        Insert: {
          estimated_time_minutes?: number | null
          id?: string
          instruction: string
          position: number
          recipe_id: string
          timer_seconds?: number | null
        }
        Update: {
          estimated_time_minutes?: number | null
          id?: string
          instruction?: string
          position?: number
          recipe_id?: string
          timer_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_steps_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          category: Database["public"]["Enums"]["recipe_category"] | null
          cook_time_minutes: number | null
          cooking_method: Database["public"]["Enums"]["cooking_method"] | null
          created_at: string
          cuisine_id: string | null
          description: string
          dietary_tags: Database["public"]["Enums"]["dietary_tag"][]
          difficulty: Database["public"]["Enums"]["difficulty"] | null
          id: string
          image_url: string | null
          is_public: boolean
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          origin: Database["public"]["Enums"]["recipe_origin"]
          original_recipe_id: string | null
          prep_time_minutes: number | null
          rating_avg: number
          review_count: number
          servings: number
          source_url: string | null
          spice_level: Database["public"]["Enums"]["spice_level"] | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["recipe_category"] | null
          cook_time_minutes?: number | null
          cooking_method?: Database["public"]["Enums"]["cooking_method"] | null
          created_at?: string
          cuisine_id?: string | null
          description?: string
          dietary_tags?: Database["public"]["Enums"]["dietary_tag"][]
          difficulty?: Database["public"]["Enums"]["difficulty"] | null
          id?: string
          image_url?: string | null
          is_public?: boolean
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          origin?: Database["public"]["Enums"]["recipe_origin"]
          original_recipe_id?: string | null
          prep_time_minutes?: number | null
          rating_avg?: number
          review_count?: number
          servings: number
          source_url?: string | null
          spice_level?: Database["public"]["Enums"]["spice_level"] | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["recipe_category"] | null
          cook_time_minutes?: number | null
          cooking_method?: Database["public"]["Enums"]["cooking_method"] | null
          created_at?: string
          cuisine_id?: string | null
          description?: string
          dietary_tags?: Database["public"]["Enums"]["dietary_tag"][]
          difficulty?: Database["public"]["Enums"]["difficulty"] | null
          id?: string
          image_url?: string | null
          is_public?: boolean
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          origin?: Database["public"]["Enums"]["recipe_origin"]
          original_recipe_id?: string | null
          prep_time_minutes?: number | null
          rating_avg?: number
          review_count?: number
          servings?: number
          source_url?: string | null
          spice_level?: Database["public"]["Enums"]["spice_level"] | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_cuisine_id_fkey"
            columns: ["cuisine_id"]
            isOneToOne: false
            referencedRelation: "cuisines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_original_recipe_id_fkey"
            columns: ["original_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile_info"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          recipe_id: string | null
          reporter_id: string | null
          review_id: string | null
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          recipe_id?: string | null
          reporter_id?: string | null
          review_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          recipe_id?: string | null
          reporter_id?: string | null
          review_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profile_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string
          created_at: string
          depth: number
          id: string
          image_url: string | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          parent_review_id: string | null
          rating: number | null
          recipe_id: string
          root_review_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          comment?: string
          created_at?: string
          depth?: number
          id?: string
          image_url?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          parent_review_id?: string | null
          rating?: number | null
          recipe_id: string
          root_review_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string
          depth?: number
          id?: string
          image_url?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          parent_review_id?: string | null
          rating?: number | null
          recipe_id?: string
          root_review_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_parent_review_id_fkey"
            columns: ["parent_review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile_info"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          ai_actions_per_day: number | null
          created_at: string
          currency: string
          description: string
          id: string
          is_active: boolean
          name: string
          price_minor: number
          tokens_per_month: number | null
        }
        Insert: {
          ai_actions_per_day?: number | null
          created_at?: string
          currency?: string
          description?: string
          id?: string
          is_active?: boolean
          name: string
          price_minor: number
          tokens_per_month?: number | null
        }
        Update: {
          ai_actions_per_day?: number | null
          created_at?: string
          currency?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          price_minor?: number
          tokens_per_month?: number | null
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string | null
          sender_role: Database["public"]["Enums"]["app_role"]
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role?: Database["public"]["Enums"]["app_role"]
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role?: Database["public"]["Enums"]["app_role"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profile_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assignee_id: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          created_at: string
          description: string
          id: string
          severity: Database["public"]["Enums"]["severity"]
          status: Database["public"]["Enums"]["support_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignee_id?: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          description: string
          id?: string
          severity: Database["public"]["Enums"]["severity"]
          status?: Database["public"]["Enums"]["support_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignee_id?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          description?: string
          id?: string
          severity?: Database["public"]["Enums"]["severity"]
          status?: Database["public"]["Enums"]["support_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "public_profile_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile_info"
            referencedColumns: ["id"]
          },
        ]
      }
      token_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          external_ref: string | null
          id: string
          related_usage_id: string | null
          type: Database["public"]["Enums"]["token_transaction_type"]
          user_id: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          external_ref?: string | null
          id?: string
          related_usage_id?: string | null
          type: Database["public"]["Enums"]["token_transaction_type"]
          user_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          external_ref?: string | null
          id?: string
          related_usage_id?: string | null
          type?: Database["public"]["Enums"]["token_transaction_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_transactions_related_usage_id_fkey"
            columns: ["related_usage_id"]
            isOneToOne: false
            referencedRelation: "ai_usage_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile_info"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          code: string
          dimension: Database["public"]["Enums"]["unit_dimension"]
          factor_to_base: number
          is_active: boolean
          is_metric: boolean | null
          name: string
        }
        Insert: {
          code: string
          dimension: Database["public"]["Enums"]["unit_dimension"]
          factor_to_base: number
          is_active?: boolean
          is_metric?: boolean | null
          name: string
        }
        Update: {
          code?: string
          dimension?: Database["public"]["Enums"]["unit_dimension"]
          factor_to_base?: number
          is_active?: boolean
          is_metric?: boolean | null
          name?: string
        }
        Relationships: []
      }
      user_backups: {
        Row: {
          created_at: string
          data: string
          id: string
          kdf_params: Json
          kdf_salt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          kdf_params: Json
          kdf_salt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          kdf_params?: Json
          kdf_salt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_backups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_backups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profile_info"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string
          id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profile_info"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_metrics_ai_actions_daily: {
        Row: {
          actions: number | null
          day: string | null
        }
        Relationships: []
      }
      admin_metrics_daily_signups: {
        Row: {
          day: string | null
          signups: number | null
        }
        Relationships: []
      }
      admin_metrics_moderation_queue: {
        Row: {
          pending_recipes: number | null
          pending_revisions: number | null
        }
        Relationships: []
      }
      admin_metrics_moderator_workload: {
        Row: {
          assignee: string | null
          open_tickets: number | null
        }
        Relationships: []
      }
      admin_metrics_recipe_origin_breakdown: {
        Row: {
          origin: Database["public"]["Enums"]["recipe_origin"] | null
          recipes: number | null
        }
        Relationships: []
      }
      admin_metrics_token_consumption_daily: {
        Row: {
          day: string | null
          tokens_consumed: number | null
          transactions: number | null
        }
        Relationships: []
      }
      public_profile_info: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_set_cuisine_active: {
        Args: { p_active: boolean; p_cuisine: string }
        Returns: undefined
      }
      admin_upsert_cuisine: {
        Args: { p_name: string; p_region?: string; p_slug: string }
        Returns: string
      }
      apply_token_transaction: {
        Args: {
          p_amount: number
          p_description?: string
          p_external_ref?: string
          p_type: Database["public"]["Enums"]["token_transaction_type"]
          p_user_id: string
        }
        Returns: number
      }
      can_edit_recipe: { Args: { p_recipe: string }; Returns: boolean }
      can_post_review: { Args: { p_recipe: string }; Returns: boolean }
      collection_is_readable: { Args: { p_col: string }; Returns: boolean }
      complete_ai_usage: {
        Args: {
          p_completion_tokens: number
          p_description?: string
          p_model_id: string
          p_prompt_tokens: number
          p_token_cost: number
          p_usage_id: string
        }
        Returns: number
      }
      delete_support_ticket: { Args: { p_ticket: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      owns_collection: { Args: { p_col: string }; Returns: boolean }
      recipe_is_publicly_visible: {
        Args: { p_recipe: string }
        Returns: boolean
      }
      reserve_ai_usage: {
        Args: {
          p_action: Database["public"]["Enums"]["ai_action_type"]
          p_daily_cap: number
          p_user_id: string
        }
        Returns: string
      }
      set_recipe_moderation: {
        Args: {
          p_recipe: string
          p_status: Database["public"]["Enums"]["moderation_status"]
        }
        Returns: undefined
      }
      set_report_status: {
        Args: {
          p_report: string
          p_status: Database["public"]["Enums"]["report_status"]
        }
        Returns: undefined
      }
      set_revision_status: {
        Args: {
          p_revision: string
          p_status: Database["public"]["Enums"]["moderation_status"]
        }
        Returns: undefined
      }
      sweep_abandoned_ai_usage: {
        Args: { p_older_than?: string }
        Returns: number
      }
      update_support_ticket: {
        Args: {
          p_assignee?: string
          p_status?: Database["public"]["Enums"]["support_status"]
          p_ticket: string
        }
        Returns: undefined
      }
    }
    Enums: {
      ai_action_type:
        | "generate_recipe"
        | "edit_recipe"
        | "nutrition_analysis"
        | "substitute_ingredient"
        | "recommend"
        | "chat"
      ai_model_tier: "economy" | "advanced"
      app_role: "user" | "moderator" | "admin"
      cooking_method:
        | "baked"
        | "roasted"
        | "grilled"
        | "fried"
        | "deep_fried"
        | "steamed"
        | "boiled"
        | "braised"
        | "sauteed"
        | "stir_fried"
        | "pressure_cooked"
        | "slow_cooked"
        | "raw"
        | "other"
      dietary_tag:
        | "vegetarian"
        | "vegan"
        | "pescatarian"
        | "gluten_free"
        | "dairy_free"
        | "nut_free"
        | "egg_free"
        | "halal"
        | "kosher"
        | "low_carb"
        | "keto"
        | "paleo"
        | "sugar_free"
        | "other"
      difficulty: "easy" | "medium" | "hard"
      food_category:
        | "produce"
        | "dairy"
        | "meat"
        | "seafood"
        | "grains"
        | "pantry"
        | "spices"
        | "frozen"
        | "bakery"
        | "beverages"
        | "other"
      meal_type: "breakfast" | "lunch" | "dinner" | "snack"
      moderation_status: "pending" | "approved" | "flagged" | "rejected"
      nutrition_source: "usda" | "ai_estimated" | "user_provided" | "imported"
      order_status: "draft" | "placed" | "confirmed" | "delivered" | "canceled"
      recipe_category:
        | "appetizer"
        | "soup"
        | "salad"
        | "main_course"
        | "side_dish"
        | "dessert"
        | "breakfast"
        | "snack"
        | "beverage"
        | "sauce"
        | "other"
      recipe_origin: "manual" | "scraped" | "ai_generated"
      report_status: "open" | "reviewed" | "actioned" | "dismissed"
      severity: "low" | "medium" | "high"
      spice_level: "mild" | "medium" | "hot" | "very_hot"
      subscription_status: "active" | "canceled" | "past_due" | "expired"
      subscription_tier: "free" | "premium"
      support_status: "open" | "in_progress" | "resolved"
      ticket_category: "bug" | "recipe" | "billing" | "feature"
      token_transaction_type:
        | "monthly_grant"
        | "purchase"
        | "consumption"
        | "expiry"
      unit_dimension: "mass" | "volume" | "count"
      unit_preference: "metric" | "imperial"
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
      ai_action_type: [
        "generate_recipe",
        "edit_recipe",
        "nutrition_analysis",
        "substitute_ingredient",
        "recommend",
        "chat",
      ],
      ai_model_tier: ["economy", "advanced"],
      app_role: ["user", "moderator", "admin"],
      cooking_method: [
        "baked",
        "roasted",
        "grilled",
        "fried",
        "deep_fried",
        "steamed",
        "boiled",
        "braised",
        "sauteed",
        "stir_fried",
        "pressure_cooked",
        "slow_cooked",
        "raw",
        "other",
      ],
      dietary_tag: [
        "vegetarian",
        "vegan",
        "pescatarian",
        "gluten_free",
        "dairy_free",
        "nut_free",
        "egg_free",
        "halal",
        "kosher",
        "low_carb",
        "keto",
        "paleo",
        "sugar_free",
        "other",
      ],
      difficulty: ["easy", "medium", "hard"],
      food_category: [
        "produce",
        "dairy",
        "meat",
        "seafood",
        "grains",
        "pantry",
        "spices",
        "frozen",
        "bakery",
        "beverages",
        "other",
      ],
      meal_type: ["breakfast", "lunch", "dinner", "snack"],
      moderation_status: ["pending", "approved", "flagged", "rejected"],
      nutrition_source: ["usda", "ai_estimated", "user_provided", "imported"],
      order_status: ["draft", "placed", "confirmed", "delivered", "canceled"],
      recipe_category: [
        "appetizer",
        "soup",
        "salad",
        "main_course",
        "side_dish",
        "dessert",
        "breakfast",
        "snack",
        "beverage",
        "sauce",
        "other",
      ],
      recipe_origin: ["manual", "scraped", "ai_generated"],
      report_status: ["open", "reviewed", "actioned", "dismissed"],
      severity: ["low", "medium", "high"],
      spice_level: ["mild", "medium", "hot", "very_hot"],
      subscription_status: ["active", "canceled", "past_due", "expired"],
      subscription_tier: ["free", "premium"],
      support_status: ["open", "in_progress", "resolved"],
      ticket_category: ["bug", "recipe", "billing", "feature"],
      token_transaction_type: [
        "monthly_grant",
        "purchase",
        "consumption",
        "expiry",
      ],
      unit_dimension: ["mass", "volume", "count"],
      unit_preference: ["metric", "imperial"],
    },
  },
} as const
