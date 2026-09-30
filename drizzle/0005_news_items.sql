CREATE TABLE "news_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"source_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"published_at" timestamp with time zone,
	"people" text[] DEFAULT '{}'::text[] NOT NULL,
	"language" text,
	"status" text DEFAULT 'active' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "news_items_url" ON "news_items" USING btree ("url");--> statement-breakpoint
CREATE INDEX "news_items_published_idx" ON "news_items" USING btree ("published_at");