/**
 * Supabase database types.
 *
 * Hand-written to match migrations 0001–0007. Regenerate from the
 * live schema whenever it drifts:
 *
 *   supabase gen types typescript --local > src/types/database.ts
 *
 * Keep this file in sync with supabase/migrations/*.sql. The app
 * layer imports Row/Insert/Update from here via the typed Supabase
 * client, so mismatches surface at compile time.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkspaceRole = "owner" | "admin" | "member";
export type WorkspacePlanDb =
  | "free"
  | "starter"
  | "growth"
  | "business";

export type FormStatus = "draft" | "published" | "archived";
export type FormFieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "dropdown"
  | "checkbox"
  | "radio"
  | "date"
  | "file";

export type LeadSourceChannel =
  | "meta_ads"
  | "google_ads"
  | "google_organic"
  | "organic"
  | "direct"
  | "email"
  | "referral"
  | "other";
export type LeadSourceConfidence = "high" | "medium" | "low";

export type IntegrationProvider = "google" | "microsoft" | "stripe";
export type IntegrationStatus =
  | "active"
  | "expired"
  | "revoked"
  | "error";

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: WorkspacePlanDb;
          stripe_customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          plan?: WorkspacePlanDb;
          stripe_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          plan?: WorkspacePlanDb;
          stripe_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          joined_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role?: WorkspaceRole;
          joined_at?: string;
        };
        Update: {
          workspace_id?: string;
          user_id?: string;
          role?: WorkspaceRole;
          joined_at?: string;
        };
        Relationships: [];
      };
      forms: {
        Row: {
          id: string;
          workspace_id: string;
          title: string;
          slug: string;
          status: FormStatus;
          theme: Json;
          submit_button_label: string;
          success_message: string;
          auto_reply_enabled: boolean;
          auto_reply_template: string | null;
          connected_inbox_id: string | null;
          created_at: string;
          updated_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          title: string;
          slug: string;
          status?: FormStatus;
          theme?: Json;
          submit_button_label?: string;
          success_message?: string;
          auto_reply_enabled?: boolean;
          auto_reply_template?: string | null;
          connected_inbox_id?: string | null;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          title?: string;
          slug?: string;
          status?: FormStatus;
          theme?: Json;
          submit_button_label?: string;
          success_message?: string;
          auto_reply_enabled?: boolean;
          auto_reply_template?: string | null;
          connected_inbox_id?: string | null;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
        };
        Relationships: [];
      };
      form_fields: {
        Row: {
          id: string;
          form_id: string;
          workspace_id: string;
          type: FormFieldType;
          label: string;
          placeholder: string | null;
          help_text: string | null;
          required: boolean;
          options: Json;
          step_index: number;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          form_id: string;
          workspace_id: string;
          type: FormFieldType;
          label: string;
          placeholder?: string | null;
          help_text?: string | null;
          required?: boolean;
          options?: Json;
          step_index?: number;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          form_id?: string;
          workspace_id?: string;
          type?: FormFieldType;
          label?: string;
          placeholder?: string | null;
          help_text?: string | null;
          required?: boolean;
          options?: Json;
          step_index?: number;
          display_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      form_versions: {
        Row: {
          id: string;
          form_id: string;
          workspace_id: string;
          version: number;
          snapshot: Json;
          published_by: string | null;
          published_at: string;
        };
        Insert: {
          id?: string;
          form_id: string;
          workspace_id: string;
          version: number;
          snapshot: Json;
          published_by?: string | null;
          published_at?: string;
        };
        Update: {
          id?: string;
          form_id?: string;
          workspace_id?: string;
          version?: number;
          snapshot?: Json;
          published_by?: string | null;
          published_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          workspace_id: string;
          form_id: string;
          values: Json;
          email: string | null;
          name: string | null;
          phone: string | null;
          source_channel: LeadSourceChannel;
          source_label: string;
          source_campaign: string | null;
          source_referrer_host: string | null;
          source_explanation: string;
          source_confidence: LeadSourceConfidence;
          attribution_raw: Json;
          ip_hash: string | null;
          country: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          form_id: string;
          values?: Json;
          email?: string | null;
          name?: string | null;
          phone?: string | null;
          source_channel: LeadSourceChannel;
          source_label: string;
          source_campaign?: string | null;
          source_referrer_host?: string | null;
          source_explanation: string;
          source_confidence: LeadSourceConfidence;
          attribution_raw: Json;
          ip_hash?: string | null;
          country?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          form_id?: string;
          values?: Json;
          email?: string | null;
          name?: string | null;
          phone?: string | null;
          source_channel?: LeadSourceChannel;
          source_label?: string;
          source_campaign?: string | null;
          source_referrer_host?: string | null;
          source_explanation?: string;
          source_confidence?: LeadSourceConfidence;
          attribution_raw?: Json;
          ip_hash?: string | null;
          country?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      integrations: {
        Row: {
          id: string;
          workspace_id: string;
          provider: IntegrationProvider;
          provider_account_id: string | null;
          account_email: string | null;
          scopes: string[];
          access_token_encrypted: string | null;
          refresh_token_encrypted: string | null;
          token_expires_at: string | null;
          status: IntegrationStatus;
          last_error: string | null;
          connected_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          provider: IntegrationProvider;
          provider_account_id?: string | null;
          account_email?: string | null;
          scopes?: string[];
          access_token_encrypted?: string | null;
          refresh_token_encrypted?: string | null;
          token_expires_at?: string | null;
          status?: IntegrationStatus;
          last_error?: string | null;
          connected_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          provider?: IntegrationProvider;
          provider_account_id?: string | null;
          account_email?: string | null;
          scopes?: string[];
          access_token_encrypted?: string | null;
          refresh_token_encrypted?: string | null;
          token_expires_at?: string | null;
          status?: IntegrationStatus;
          last_error?: string | null;
          connected_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          workspace_id: string | null;
          actor_user_id: string | null;
          action: string;
          resource_type: string | null;
          resource_id: string | null;
          metadata: Json;
          ip_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          workspace_id?: string | null;
          actor_user_id?: string | null;
          action: string;
          resource_type?: string | null;
          resource_id?: string | null;
          metadata?: Json;
          ip_hash?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          workspace_id?: string | null;
          actor_user_id?: string | null;
          action?: string;
          resource_type?: string | null;
          resource_id?: string | null;
          metadata?: Json;
          ip_hash?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_workspace_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      is_workspace_member: {
        Args: { _workspace_id: string; _user_id: string };
        Returns: boolean;
      };
      custom_access_token_hook: {
        Args: { event: Json };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
