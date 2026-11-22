ALTER TABLE "room_state" ADD COLUMN "queue_data" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "room_state"
SET "queue_data" = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('kind', 'media', 'id', q::text) ORDER BY ord)
   FROM unnest("queue") WITH ORDINALITY AS t(q, ord)),
  '[]'::jsonb
)
WHERE cardinality("queue") > 0;