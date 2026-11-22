CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" text DEFAULT 'recovery' NOT NULL,
	"email" text NOT NULL,
	"person_id" uuid,
	"code_hash" text NOT NULL,
	"salt" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_otps_purpose_check" CHECK ("email_otps"."purpose" in ('recovery')),
	CONSTRAINT "email_otps_attempts_check" CHECK ("email_otps"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "password_set" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_otps" ADD CONSTRAINT "email_otps_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_account" ON "auth_identities" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_person_provider" ON "auth_identities" USING btree ("person_id","provider");--> statement-breakpoint
CREATE INDEX "auth_identities_person" ON "auth_identities" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "email_otps_email_created" ON "email_otps" USING btree ("email","purpose","created_at");--> statement-breakpoint
CREATE INDEX "email_otps_expiry" ON "email_otps" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "email_otps_person" ON "email_otps" USING btree ("person_id");