CREATE TABLE "practice_problems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_slug" text,
	"source_url" text NOT NULL,
	"title" text NOT NULL,
	"difficulty" text,
	"daily_date" date,
	"prompt_markdown" text NOT NULL,
	"examples" jsonb,
	"constraints" jsonb,
	"topic_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"fetched_at" timestamp,
	"imported_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "practice_problems_source_slug_unique" UNIQUE("source","source_slug"),
	CONSTRAINT "practice_problems_source_daily_date_unique" UNIQUE("source","daily_date")
);
--> statement-breakpoint
CREATE TABLE "practice_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"problem_id" uuid NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"code_snapshot" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "practice_progress_user_problem_unique" UNIQUE("user_id","problem_id")
);
--> statement-breakpoint
ALTER TABLE "practice_progress" ADD CONSTRAINT "practice_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_progress" ADD CONSTRAINT "practice_progress_problem_id_practice_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."practice_problems"("id") ON DELETE cascade ON UPDATE no action;