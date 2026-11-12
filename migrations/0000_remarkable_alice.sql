CREATE TABLE `master_items` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`wbs` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `master_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `master_items_plan_idx` ON `master_items` (`plan_id`);--> statement-breakpoint
CREATE TABLE `master_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`total_rows` real DEFAULT 0,
	`updated_at` text,
	`updated_by` text,
	`totales` text
);
--> statement-breakpoint
CREATE TABLE `master_weeks` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`fecha` text NOT NULL,
	`label` text NOT NULL,
	`cerrada` integer DEFAULT false,
	FOREIGN KEY (`plan_id`) REFERENCES `master_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `master_weeks_plan_idx` ON `master_weeks` (`plan_id`);