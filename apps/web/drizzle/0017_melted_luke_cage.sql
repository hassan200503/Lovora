CREATE TABLE "short_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"video_key" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "short_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"added_by" uuid NOT NULL,
	"video_key" text NOT NULL,
	"url" text NOT NULL,
	"meta" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "short_reactions" (
	"person_id" uuid NOT NULL,
	"couple_id" uuid NOT NULL,
	"video_key" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "short_reactions_person_id_video_key_kind_pk" PRIMARY KEY("person_id","video_key","kind")
);
--> statement-breakpoint
ALTER TABLE "short_comments" ADD CONSTRAINT "short_comments_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_comments" ADD CONSTRAINT "short_comments_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_added_by_people_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_reactions" ADD CONSTRAINT "short_reactions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_reactions" ADD CONSTRAINT "short_reactions_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "short_comments_couple_video" ON "short_comments" USING btree ("couple_id","video_key","created_at");--> statement-breakpoint
CREATE INDEX "short_comments_person" ON "short_comments" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "short_links_couple_video" ON "short_links" USING btree ("couple_id","video_key");--> statement-breakpoint
CREATE INDEX "short_links_couple_created" ON "short_links" USING btree ("couple_id","created_at");--> statement-breakpoint
CREATE INDEX "short_reactions_couple_video" ON "short_reactions" USING btree ("couple_id","video_key");