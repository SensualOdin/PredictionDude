CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"sent_at" timestamp with time zone DEFAULT now(),
	"clicked" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bet_id" uuid NOT NULL,
	"thesis_correct" boolean,
	"reasoning" text,
	"patterns" text[],
	"proposed_update" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_ticker" text NOT NULL,
	"recommendation_id" uuid,
	"mode" text NOT NULL,
	"side" text NOT NULL,
	"action" text NOT NULL,
	"entry_price" numeric(6, 4) NOT NULL,
	"contracts" integer NOT NULL,
	"total_cost" numeric(10, 4),
	"kalshi_order_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"outcome" text,
	"exit_price" numeric(6, 4),
	"pnl" numeric(10, 4),
	"placed_at" timestamp with time zone DEFAULT now(),
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticker" text NOT NULL,
	"event_ticker" text,
	"series_ticker" text,
	"title" text NOT NULL,
	"category" text,
	"status" text DEFAULT 'open' NOT NULL,
	"yes_price" numeric(6, 4),
	"volume_24h" integer,
	"close_time" timestamp with time zone,
	"result" text,
	"settled_at" timestamp with time zone,
	"raw_data" jsonb,
	"last_synced" timestamp with time zone DEFAULT now(),
	CONSTRAINT "markets_ticker_unique" UNIQUE("ticker")
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_ticker" text NOT NULL,
	"strategy_id" uuid,
	"recommendation" text NOT NULL,
	"confidence" integer NOT NULL,
	"suggested_size" integer,
	"reasoning" text,
	"key_risk" text,
	"data_sources" text[],
	"external_context" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"notified" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" serial NOT NULL,
	"name" text,
	"rules" jsonb NOT NULL,
	"parent_id" uuid,
	"change_reason" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_recommendation_id_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."recommendations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_market_ticker_markets_ticker_fk" FOREIGN KEY ("market_ticker") REFERENCES "public"."markets"("ticker") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_recommendation_id_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."recommendations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_market_ticker_markets_ticker_fk" FOREIGN KEY ("market_ticker") REFERENCES "public"."markets"("ticker") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE no action ON UPDATE no action;