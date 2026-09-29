CREATE TABLE "admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "affiliate_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"program_id" uuid,
	"url_template" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"last_checked_at" timestamp with time zone,
	"last_status" integer
);
--> statement-breakpoint
CREATE TABLE "affiliate_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"network" text NOT NULL,
	"status" text DEFAULT 'researching' NOT NULL,
	"commission_type" text DEFAULT 'unknown' NOT NULL,
	"commission_value" real,
	"commission_duration_months" integer,
	"cookie_days" integer,
	"program_url" text,
	"terms_url" text,
	"info_source_url" text,
	"info_status" text DEFAULT 'unverified' NOT NULL,
	"notes" text,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"agent" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"tool_id" uuid,
	"field" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"source_url" text,
	"confidence" integer,
	"decision" text DEFAULT 'info' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reverted_at" timestamp with time zone,
	"reverted_by" text
);
--> statement-breakpoint
CREATE TABLE "agent_configs" (
	"agent" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"schedule" text NOT NULL,
	"autonomy" text DEFAULT 'auto' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "capabilities" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capability_i18n" (
	"capability_id" text NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"synonyms" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "capability_i18n_capability_id_locale_pk" PRIMARY KEY("capability_id","locale")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"icon" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_i18n" (
	"category_id" text NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	CONSTRAINT "category_i18n_category_id_locale_pk" PRIMARY KEY("category_id","locale")
);
--> statement-breakpoint
CREATE TABLE "change_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid,
	"kind" text NOT NULL,
	"title" jsonb NOT NULL,
	"summary" jsonb,
	"old_value" jsonb,
	"new_value" jsonb,
	"source_id" uuid,
	"source_url" text,
	"source_type" text,
	"occurred_at" timestamp with time zone,
	"occurred_precision" text DEFAULT 'day' NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"detected_by" text NOT NULL,
	"confidence" integer NOT NULL,
	"significance" integer DEFAULT 50 NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"dedupe_key" text
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"click_id" text,
	"program_id" uuid,
	"tool_id" uuid,
	"external_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"body_text" text NOT NULL,
	"body_html" text,
	"kind" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "error_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"scope" text NOT NULL,
	"agent" text,
	"message" text NOT NULL,
	"detail" jsonb,
	"fingerprint" text NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"path" text,
	"page_type" text,
	"locale" text,
	"entity_id" text,
	"visitor_hash" text,
	"referrer_domain" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"device" text,
	"country" text,
	"props" jsonb
);
--> statement-breakpoint
CREATE TABLE "facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"status" text NOT NULL,
	"confidence" integer NOT NULL,
	"source_id" uuid,
	"extra_source_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"evidence" text,
	"method" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"created_by" text NOT NULL,
	"review_status" text DEFAULT 'published' NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"day" date NOT NULL,
	"quote" text NOT NULL,
	"rate" numeric(14, 6) NOT NULL,
	"source_url" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_day_quote_pk" PRIMARY KEY("day","quote")
);
--> statement-breakpoint
CREATE TABLE "health_checks" (
	"key" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"detail" jsonb,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_ok_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text,
	"company_size" text,
	"message" text,
	"locale" text NOT NULL,
	"stack_id" uuid,
	"consent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"value_cents" integer,
	"currency" text DEFAULT 'EUR',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_usage" (
	"day" date NOT NULL,
	"purpose" text NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"est_cost_micros" integer DEFAULT 0 NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "llm_usage_day_purpose_pk" PRIMARY KEY("day","purpose")
);
--> statement-breakpoint
CREATE TABLE "match_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"locale" text NOT NULL,
	"query_scrubbed" text,
	"query_hash" text NOT NULL,
	"engine" text NOT NULL,
	"task_id" text,
	"capability_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"constraints" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" integer NOT NULL,
	"clarified" boolean DEFAULT false NOT NULL,
	"result_tool_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"visitor_hash" text,
	"latency_ms" integer
);
--> statement-breakpoint
CREATE TABLE "outbound_clicks" (
	"id" text PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"tool_id" uuid NOT NULL,
	"link_kind" text NOT NULL,
	"affiliate_link_id" uuid,
	"page_path" text,
	"page_type" text,
	"locale" text,
	"position" integer,
	"match_query_id" uuid,
	"visitor_hash" text,
	"referrer_domain" text,
	"device" text
);
--> statement-breakpoint
CREATE TABLE "pending_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"key" text NOT NULL,
	"proposed_value" jsonb NOT NULL,
	"value_hash" text NOT NULL,
	"source_id" uuid,
	"evidence" text,
	"confidence" integer NOT NULL,
	"observations" integer DEFAULT 1 NOT NULL,
	"first_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"agent" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"slot" text NOT NULL,
	"message" jsonb NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"price_cents" integer,
	"currency" text DEFAULT 'EUR',
	"status" text DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"plan_key" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"price_cents" integer,
	"currency" text,
	"billing_period" text DEFAULT 'month' NOT NULL,
	"price_unit" text DEFAULT 'flat' NOT NULL,
	"monthly_equivalent_cents" integer,
	"annual_monthly_cents" integer,
	"is_free" boolean DEFAULT false NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"quota" text,
	"status" text NOT NULL,
	"confidence" integer NOT NULL,
	"source_id" uuid,
	"extra_source_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"evidence" text,
	"method" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"created_by" text NOT NULL,
	"review_status" text DEFAULT 'published' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"data" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"emailed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "revenue_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"day" date NOT NULL,
	"description" text,
	"tool_id" uuid,
	"lead_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"severity" text DEFAULT 'p3' NOT NULL,
	"category" text DEFAULT 'data' NOT NULL,
	"tool_id" uuid,
	"title" text NOT NULL,
	"reason_code" text,
	"payload" jsonb NOT NULL,
	"impact" jsonb,
	"confidence" integer,
	"priority" integer DEFAULT 50 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"default_action" text,
	"due_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"group_key" text,
	"group_count" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"run_id" uuid,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"resolution" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "social_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"metric" text NOT NULL,
	"value" real NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"url" text
);
--> statement-breakpoint
CREATE TABLE "source_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"http_status" integer,
	"content_hash" text,
	"text_length" integer,
	"text" text,
	"changed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"source_type" text NOT NULL,
	"title" text,
	"publisher" text,
	"tool_id" uuid,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_status" integer,
	"last_error" text,
	"last_content_hash" text,
	"robots_allowed" boolean,
	"fetch_mode" text DEFAULT 'http' NOT NULL,
	"check_interval_hours" integer DEFAULT 24 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	CONSTRAINT "sources_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "stack_items" (
	"stack_id" uuid NOT NULL,
	"tool_id" uuid NOT NULL,
	"step_key" text DEFAULT 'general' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "stack_items_stack_id_tool_id_step_key_pk" PRIMARY KEY("stack_id","tool_id","step_key")
);
--> statement-breakpoint
CREATE TABLE "stacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"edit_token_hash" text NOT NULL,
	"title" text,
	"locale" text NOT NULL,
	"origin" text NOT NULL,
	"task_id" text,
	"query_text" text,
	"constraints" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stacks_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"locale" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"confirm_token_hash" text,
	"unsubscribe_token" text NOT NULL,
	"consent_text" text NOT NULL,
	"consent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"source" text NOT NULL,
	"newsletter" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscribers_email_unique" UNIQUE("email"),
	CONSTRAINT "subscribers_unsubscribe_token_unique" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
CREATE TABLE "task_i18n" (
	"task_id" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text,
	"intent_phrases" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "task_i18n_task_id_locale_pk" PRIMARY KEY("task_id","locale")
);
--> statement-breakpoint
CREATE TABLE "task_step_i18n" (
	"step_id" integer NOT NULL,
	"locale" text NOT NULL,
	"label" text NOT NULL,
	"hint" text,
	CONSTRAINT "task_step_i18n_step_id_locale_pk" PRIMARY KEY("step_id","locale")
);
--> statement-breakpoint
CREATE TABLE "task_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"position" integer NOT NULL,
	"key" text NOT NULL,
	"capability_ids" text[] NOT NULL,
	"required" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"duplicate_of_tool_id" uuid,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "tool_capabilities" (
	"tool_id" uuid NOT NULL,
	"capability_id" text NOT NULL,
	"strength" text DEFAULT 'primary' NOT NULL,
	"note" text,
	CONSTRAINT "tool_capabilities_tool_id_capability_id_pk" PRIMARY KEY("tool_id","capability_id")
);
--> statement-breakpoint
CREATE TABLE "tool_i18n" (
	"tool_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"tagline" text NOT NULL,
	"description" text NOT NULL,
	"best_for" text[] DEFAULT '{}'::text[] NOT NULL,
	"not_for" text[] DEFAULT '{}'::text[] NOT NULL,
	"limitations" text[] DEFAULT '{}'::text[] NOT NULL,
	"content_status" text DEFAULT 'editorial' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tool_i18n_tool_id_locale_pk" PRIMARY KEY("tool_id","locale")
);
--> statement-breakpoint
CREATE TABLE "tool_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"related_tool_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source" text DEFAULT 'editorial' NOT NULL,
	"score" real,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"website_url" text NOT NULL,
	"pricing_url" text,
	"changelog_url" text,
	"rss_url" text,
	"github_repo" text,
	"youtube_channel_id" text,
	"company_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"launch_year" integer,
	"skill_level" text DEFAULT 'beginner' NOT NULL,
	"audience" text[] DEFAULT '{}'::text[] NOT NULL,
	"platforms" text[] DEFAULT '{}'::text[] NOT NULL,
	"pricing_model" text DEFAULT 'unknown' NOT NULL,
	"has_free_tier" boolean,
	"has_free_trial" boolean,
	"pricing_public" boolean,
	"api_available" boolean,
	"open_source" boolean,
	"self_hostable" boolean,
	"supports_dutch" boolean,
	"eu_data_residency" boolean,
	"gdpr_dpa" boolean,
	"trains_on_user_data" text,
	"commercial_use_free_tier" boolean,
	"watermark_free_tier" boolean,
	"model_dependencies" text[] DEFAULT '{}'::text[] NOT NULL,
	"entry_price_cents" integer,
	"entry_price_currency" text,
	"entry_price_period" text,
	"entry_plan_name" text,
	"confidence" integer DEFAULT 0 NOT NULL,
	"freshness" text DEFAULT 'unknown' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_changed_at" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"price_checked_at" timestamp with time zone,
	"website_checked_at" timestamp with time zone,
	"features_checked_at" timestamp with time zone,
	"social_checked_at" timestamp with time zone,
	"video_checked_at" timestamp with time zone,
	"website_status" text DEFAULT 'unknown' NOT NULL,
	"unreachable_since" timestamp with time zone,
	"quarantine_until" timestamp with time zone,
	"quality_score" integer DEFAULT 0 NOT NULL,
	"quality_issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"indexable" jsonb DEFAULT '{"tool":false,"pricing":false,"alternatives":false}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"provider" text DEFAULT 'youtube' NOT NULL,
	"video_id" text NOT NULL,
	"title" text NOT NULL,
	"channel_title" text,
	"channel_id" text,
	"kind" text NOT NULL,
	"published_at" timestamp with time zone,
	"language" text,
	"source" text NOT NULL,
	"source_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"relevance" real DEFAULT 0.5 NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscriber_id" uuid NOT NULL,
	"stack_id" uuid,
	"tool_id" uuid,
	"frequency" text DEFAULT 'weekly' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_notified_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_program_id_affiliate_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."affiliate_programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_programs" ADD CONSTRAINT "affiliate_programs_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capabilities" ADD CONSTRAINT "capabilities_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_i18n" ADD CONSTRAINT "capability_i18n_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_i18n" ADD CONSTRAINT "category_i18n_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_events" ADD CONSTRAINT "change_events_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_events" ADD CONSTRAINT "change_events_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_program_id_affiliate_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."affiliate_programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facts" ADD CONSTRAINT "facts_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facts" ADD CONSTRAINT "facts_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_stack_id_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."stacks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_clicks" ADD CONSTRAINT "outbound_clicks_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_clicks" ADD CONSTRAINT "outbound_clicks_affiliate_link_id_affiliate_links_id_fk" FOREIGN KEY ("affiliate_link_id") REFERENCES "public"."affiliate_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_changes" ADD CONSTRAINT "pending_changes_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_changes" ADD CONSTRAINT "pending_changes_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_plans" ADD CONSTRAINT "pricing_plans_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_plans" ADD CONSTRAINT "pricing_plans_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_signals" ADD CONSTRAINT "social_signals_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_snapshots" ADD CONSTRAINT "source_snapshots_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stack_items" ADD CONSTRAINT "stack_items_stack_id_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."stacks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stack_items" ADD CONSTRAINT "stack_items_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stacks" ADD CONSTRAINT "stacks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_i18n" ADD CONSTRAINT "task_i18n_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_step_i18n" ADD CONSTRAINT "task_step_i18n_step_id_task_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."task_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_steps" ADD CONSTRAINT "task_steps_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_candidates" ADD CONSTRAINT "tool_candidates_duplicate_of_tool_id_tools_id_fk" FOREIGN KEY ("duplicate_of_tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_capabilities" ADD CONSTRAINT "tool_capabilities_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_capabilities" ADD CONSTRAINT "tool_capabilities_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_i18n" ADD CONSTRAINT "tool_i18n_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_relations" ADD CONSTRAINT "tool_relations_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_relations" ADD CONSTRAINT "tool_relations_related_tool_id_tools_id_fk" FOREIGN KEY ("related_tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_stack_id_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."stacks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_actions_run_idx" ON "agent_actions" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "agent_actions_created_idx" ON "agent_actions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "agent_runs_agent_idx" ON "agent_runs" USING btree ("agent","started_at");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "capability_i18n_locale_slug" ON "capability_i18n" USING btree ("locale","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "category_i18n_locale_slug" ON "category_i18n" USING btree ("locale","slug");--> statement-breakpoint
CREATE INDEX "change_events_feed_idx" ON "change_events" USING btree ("status","detected_at");--> statement-breakpoint
CREATE INDEX "change_events_tool_idx" ON "change_events" USING btree ("tool_id","detected_at");--> statement-breakpoint
CREATE UNIQUE INDEX "change_events_dedupe" ON "change_events" USING btree ("dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "conversions_external" ON "conversions" USING btree ("program_id","external_id");--> statement-breakpoint
CREATE INDEX "conversions_click_idx" ON "conversions" USING btree ("click_id");--> statement-breakpoint
CREATE INDEX "email_outbox_status_idx" ON "email_outbox" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "error_log_fingerprint_day" ON "error_log" USING btree ("fingerprint","day");--> statement-breakpoint
CREATE INDEX "error_log_at_idx" ON "error_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "events_ts_idx" ON "events" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "events_type_ts_idx" ON "events" USING btree ("type","ts");--> statement-breakpoint
CREATE INDEX "events_page_type_ts_idx" ON "events" USING btree ("page_type","ts");--> statement-breakpoint
CREATE INDEX "facts_current_idx" ON "facts" USING btree ("tool_id","key") WHERE "facts"."valid_to" IS NULL;--> statement-breakpoint
CREATE INDEX "facts_tool_history_idx" ON "facts" USING btree ("tool_id","key","valid_from");--> statement-breakpoint
CREATE INDEX "match_queries_ts_idx" ON "match_queries" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "match_queries_task_idx" ON "match_queries" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "outbound_clicks_ts_idx" ON "outbound_clicks" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "outbound_clicks_tool_idx" ON "outbound_clicks" USING btree ("tool_id","ts");--> statement-breakpoint
CREATE INDEX "outbound_clicks_page_idx" ON "outbound_clicks" USING btree ("page_path");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_changes_open" ON "pending_changes" USING btree ("tool_id","key","value_hash","status");--> statement-breakpoint
CREATE INDEX "pricing_plans_current_idx" ON "pricing_plans" USING btree ("tool_id") WHERE "pricing_plans"."valid_to" IS NULL;--> statement-breakpoint
CREATE INDEX "pricing_plans_history_idx" ON "pricing_plans" USING btree ("tool_id","plan_key","valid_from");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_period" ON "reports" USING btree ("kind","period_start");--> statement-breakpoint
CREATE INDEX "review_items_queue_idx" ON "review_items" USING btree ("status","severity","priority");--> statement-breakpoint
CREATE INDEX "review_items_due_idx" ON "review_items" USING btree ("status","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_items_dedupe" ON "review_items" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "social_signals_series_idx" ON "social_signals" USING btree ("tool_id","provider","metric","observed_at");--> statement-breakpoint
CREATE INDEX "source_snapshots_source_idx" ON "source_snapshots" USING btree ("source_id","fetched_at");--> statement-breakpoint
CREATE INDEX "sources_tool_idx" ON "sources" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "sources_domain_idx" ON "sources" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "stack_items_tool_idx" ON "stack_items" USING btree ("tool_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_i18n_locale_slug" ON "task_i18n" USING btree ("locale","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "task_steps_task_key" ON "task_steps" USING btree ("task_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_candidates_domain" ON "tool_candidates" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "tool_capabilities_cap_idx" ON "tool_capabilities" USING btree ("capability_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_relations_unique" ON "tool_relations" USING btree ("tool_id","related_tool_id","kind");--> statement-breakpoint
CREATE INDEX "tools_published_idx" ON "tools" USING btree ("published");--> statement-breakpoint
CREATE INDEX "tools_company_idx" ON "tools" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "videos_unique" ON "videos" USING btree ("provider","video_id","tool_id");--> statement-breakpoint
CREATE INDEX "watches_subscriber_idx" ON "watches" USING btree ("subscriber_id");