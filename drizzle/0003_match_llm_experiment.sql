ALTER TABLE "match_queries" ADD COLUMN "llm_eligible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "match_queries" ADD COLUMN "llm_holdout" boolean DEFAULT false NOT NULL;