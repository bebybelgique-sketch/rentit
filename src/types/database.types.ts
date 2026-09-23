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
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          payload: Json
          target_id: string
          target_table: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          payload?: Json
          target_id: string
          target_table: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          payload?: Json
          target_id?: string
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_messages: {
        Row: {
          body: string
          booking_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          booking_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          booking_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_photos: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          phase: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          phase: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          phase?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_photos_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount_paid: number | null
          approved_at: string | null
          auto_closed_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          delivery_fee: number | null
          delivery_requested: boolean
          deposit_amount: number
          deposit_returned: boolean
          end_date: string
          id: string
          insurance_amount: number
          item_id: string
          platform_fee: number
          renter_id: string
          request_message: string | null
          start_date: string
          status: Database["public"]["Enums"]["booking_status"]
          stripe_payment_intent_id: string | null
          total_days: number
          total_price: number
        }
        Insert: {
          amount_paid?: number | null
          approved_at?: string | null
          auto_closed_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          delivery_fee?: number | null
          delivery_requested?: boolean
          deposit_amount?: number
          deposit_returned?: boolean
          end_date: string
          id?: string
          insurance_amount?: number
          item_id: string
          platform_fee?: number
          renter_id: string
          request_message?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_payment_intent_id?: string | null
          total_days?: number
          total_price: number
        }
        Update: {
          amount_paid?: number | null
          approved_at?: string | null
          auto_closed_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          delivery_fee?: number | null
          delivery_requested?: boolean
          deposit_amount?: number
          deposit_returned?: boolean
          end_date?: string
          id?: string
          insurance_amount?: number
          item_id?: string
          platform_fee?: number
          renter_id?: string
          request_message?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_payment_intent_id?: string | null
          total_days?: number
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_errors: {
        Row: {
          count: number
          day: string
          fingerprint: string
          first_seen: string
          kind: string
          lang: string | null
          last_seen: string
          message: string
          path: string
          release: string | null
          stack: string | null
          user_agent: string | null
        }
        Insert: {
          count?: number
          day?: string
          fingerprint: string
          first_seen?: string
          kind: string
          lang?: string | null
          last_seen?: string
          message: string
          path: string
          release?: string | null
          stack?: string | null
          user_agent?: string | null
        }
        Update: {
          count?: number
          day?: string
          fingerprint?: string
          first_seen?: string
          kind?: string
          lang?: string | null
          last_seen?: string
          message?: string
          path?: string
          release?: string | null
          stack?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          meta: Json | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          meta?: Json | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          meta?: Json | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      item_blackouts: {
        Row: {
          created_at: string
          end_date: string
          id: string
          item_id: string
          note: string | null
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          item_id: string
          note?: string | null
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          item_id?: string
          note?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_blackouts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          address: string | null
          available: boolean
          buffer_days: number
          category: string
          condition: Database["public"]["Enums"]["item_condition"]
          created_at: string
          delivery_fee: number | null
          delivery_radius_km: number | null
          deposit: number
          description: string | null
          id: string
          is_business: boolean
          lat: number | null
          late_fee_per_day: number | null
          lng: number | null
          location: unknown
          min_notice_days: number
          owner_id: string
          photos: Json
          price_3days: number | null
          price_per_day: number
          price_week: number | null
          quantity: number
          title: string
        }
        Insert: {
          address?: string | null
          available?: boolean
          buffer_days?: number
          category?: string
          condition?: Database["public"]["Enums"]["item_condition"]
          created_at?: string
          delivery_fee?: number | null
          delivery_radius_km?: number | null
          deposit?: number
          description?: string | null
          id?: string
          is_business?: boolean
          lat?: number | null
          late_fee_per_day?: number | null
          lng?: number | null
          location?: unknown
          min_notice_days?: number
          owner_id: string
          photos?: Json
          price_3days?: number | null
          price_per_day: number
          price_week?: number | null
          quantity?: number
          title: string
        }
        Update: {
          address?: string | null
          available?: boolean
          buffer_days?: number
          category?: string
          condition?: Database["public"]["Enums"]["item_condition"]
          created_at?: string
          delivery_fee?: number | null
          delivery_radius_km?: number | null
          deposit?: number
          description?: string | null
          id?: string
          is_business?: boolean
          lat?: number | null
          late_fee_per_day?: number | null
          lng?: number | null
          location?: unknown
          min_notice_days?: number
          owner_id?: string
          photos?: Json
          price_3days?: number | null
          price_per_day?: number
          price_week?: number | null
          quantity?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          kind: string
          message_id: string | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          kind: string
          message_id?: string | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          kind?: string
          message_id?: string | null
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "booking_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          deposit_amount: number
          id: string
          insurance_amount: number
          platform_fee: number
          rental_amount: number
          status: string
          stripe_payment_intent_id: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          deposit_amount: number
          id?: string
          insurance_amount?: number
          platform_fee: number
          rental_amount: number
          status?: string
          stripe_payment_intent_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          deposit_amount?: number
          id?: string
          insurance_amount?: number
          platform_fee?: number
          rental_amount?: number
          status?: string
          stripe_payment_intent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      push_sent: {
        Row: {
          event_key: string
          sent_at: string
        }
        Insert: {
          event_key: string
          sent_at?: string
        }
        Update: {
          event_key?: string
          sent_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          lang: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          lang?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          lang?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          from_user_id: string
          id: string
          item_id: string
          rating: number
          review_type: string
          to_user_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          from_user_id: string
          id?: string
          item_id: string
          rating: number
          review_type: string
          to_user_id: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          from_user_id?: string
          id?: string
          item_id?: string
          rating?: number
          review_type?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_demands: {
        Row: {
          created_at: string
          id: string
          locale: string | null
          searched_query: string | null
          tool: string
        }
        Insert: {
          created_at?: string
          id?: string
          locale?: string | null
          searched_query?: string | null
          tool: string
        }
        Update: {
          created_at?: string
          id?: string
          locale?: string | null
          searched_query?: string | null
          tool?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          business_name: string | null
          business_plan: string | null
          business_plan_expires_at: string | null
          created_at: string
          full_name: string
          id: string
          is_pro: boolean
          lat: number | null
          lng: number | null
          phone: string | null
          phone_otp: string | null
          phone_otp_attempts: number
          phone_otp_expires_at: string | null
          phone_verified: boolean
          pro_expires_at: string | null
          rating_as_owner: number | null
          rating_as_renter: number | null
          referral_code: string | null
          referred_by: string | null
          role: string
          stripe_customer_id: string | null
          village: string | null
        }
        Insert: {
          avatar_url?: string | null
          business_name?: string | null
          business_plan?: string | null
          business_plan_expires_at?: string | null
          created_at?: string
          full_name?: string
          id: string
          is_pro?: boolean
          lat?: number | null
          lng?: number | null
          phone?: string | null
          phone_otp?: string | null
          phone_otp_attempts?: number
          phone_otp_expires_at?: string | null
          phone_verified?: boolean
          pro_expires_at?: string | null
          rating_as_owner?: number | null
          rating_as_renter?: number | null
          referral_code?: string | null
          referred_by?: string | null
          role?: string
          stripe_customer_id?: string | null
          village?: string | null
        }
        Update: {
          avatar_url?: string | null
          business_name?: string | null
          business_plan?: string | null
          business_plan_expires_at?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_pro?: boolean
          lat?: number | null
          lng?: number | null
          phone?: string | null
          phone_otp?: string | null
          phone_otp_attempts?: number
          phone_otp_expires_at?: string | null
          phone_verified?: boolean
          pro_expires_at?: string | null
          rating_as_owner?: number | null
          rating_as_renter?: number | null
          referral_code?: string | null
          referred_by?: string | null
          role?: string
          stripe_customer_id?: string | null
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      booking_is_completed: { Args: { p_booking_id: string }; Returns: boolean }
      booking_item: { Args: { p_booking_id: string }; Returns: string }
      booking_owner: { Args: { p_booking_id: string }; Returns: string }
      booking_renter: { Args: { p_booking_id: string }; Returns: string }
      browse_items: {
        Args: {
          p_category?: string
          p_end?: string
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_max_price?: number
          p_place?: string
          p_radius_km?: number
          p_search?: string
          p_start?: string
        }
        Returns: {
          address: string
          category: string
          condition: Database["public"]["Enums"]["item_condition"]
          deposit: number
          distance_m: number
          id: string
          lat: number
          lng: number
          owner_full_name: string
          owner_id: string
          owner_is_pro: boolean
          owner_rating: number
          photos: Json
          price_per_day: number
          title: string
        }[]
      }
      get_booked_dates: {
        Args: { p_item_id: string }
        Returns: {
          end_date: string
          start_date: string
        }[]
      }
      is_booking_participant: {
        Args: { p_booking_id: string; p_user_id: string }
        Returns: boolean
      }
      is_booking_photo_participant: {
        Args: { p_name: string }
        Returns: boolean
      }
      item_calendar: {
        Args: { p_from?: string; p_item_id: string; p_to?: string }
        Returns: Json
      }
      item_earliest_start: { Args: { p_item_id: string }; Returns: string }
      item_history: { Args: { p_item_id: string }; Returns: Json }
      items_busy_between: {
        Args: { p_end: string; p_start: string }
        Returns: {
          item_id: string
        }[]
      }
      recompute_user_rating_for: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      record_client_error: {
        Args: {
          p_fingerprint: string
          p_kind: string
          p_lang: string
          p_message: string
          p_path: string
          p_release: string
          p_stack: string
          p_user_agent: string
        }
        Returns: string
      }
      renter_has_pending_request: {
        Args: {
          p_end: string
          p_item_id: string
          p_renter_id: string
          p_start: string
        }
        Returns: boolean
      }
      unavailable_days: {
        Args: {
          p_exclude_booking?: string
          p_from?: string
          p_item_ids?: string[]
          p_to?: string
        }
        Returns: {
          day: string
          item_id: string
          reason: string
        }[]
      }
      unservable_pending_requests: {
        Args: { p_exclude_booking?: string; p_item_id: string }
        Returns: {
          id: string
        }[]
      }
    }
    Enums: {
      booking_status:
        | "pending_approval"
        | "pending_payment"
        | "confirmed"
        | "active"
        | "completed"
        | "cancelled"
        | "disputed"
        | "rejected"
        | "expired"
        | "payment_expired"
      item_condition: "new" | "like_new" | "good" | "fair"
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
      booking_status: [
        "pending_approval",
        "pending_payment",
        "confirmed",
        "active",
        "completed",
        "cancelled",
        "disputed",
        "rejected",
        "expired",
        "payment_expired",
      ],
      item_condition: ["new", "like_new", "good", "fair"],
    },
  },
} as const
