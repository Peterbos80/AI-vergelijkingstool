ALTER TABLE "agent_configs" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_configs" ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL;