ALTER TABLE "tools" ADD COLUMN "logo" jsonb;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "discovery" jsonb;--> statement-breakpoint
-- Tool scout: candidates recorded before persons' GitHub repositories and pages on
-- platforms were skipped may hold a user name (personal data). They are removed,
-- with the dossier in their inbox items; organisations' projects are found again
-- within an hour by the new discovery.
UPDATE "review_items"
   SET "payload" = jsonb_build_object('candidateId', "payload"->'candidateId', 'removed', true),
       "status" = CASE WHEN "status" = 'pending' THEN 'expired' ELSE "status" END,
       "resolution" = CASE WHEN "status" = 'pending' THEN 'candidate removed: it may have held a GitHub user name' ELSE "resolution" END,
       "updated_at" = now()
 WHERE "kind" = 'new_tool' AND "payload"->>'candidateId' IN (
       SELECT "id"::text FROM "tool_candidates"
        WHERE "status" <> 'promoted'
          AND (("source" = 'github' AND NOT ("signals" ? 'githubLicense')) OR ("source" <> 'github' AND "domain" LIKE '%/%') OR "domain" IN ('github.io', 'gitlab.io')));
--> statement-breakpoint
DELETE FROM "tool_candidates"
 WHERE "status" <> 'promoted'
   AND (("source" = 'github' AND NOT ("signals" ? 'githubLicense')) OR ("source" <> 'github' AND "domain" LIKE '%/%') OR "domain" IN ('github.io', 'gitlab.io'));
