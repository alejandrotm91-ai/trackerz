CREATE TABLE `cloud_chunks` (
	`kind` text NOT NULL,
	`plan_id` text NOT NULL,
	`section` text NOT NULL,
	`idx` integer NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`plan_id`, `section`, `idx`)
);
--> statement-breakpoint
CREATE INDEX `cloud_chunks_kind_idx` ON `cloud_chunks` (`kind`);--> statement-breakpoint
CREATE TABLE `cloud_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`meta` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cloud_plans_kind_idx` ON `cloud_plans` (`kind`);--> statement-breakpoint
CREATE TABLE `kv_docs` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
