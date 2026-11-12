CREATE TABLE `gestiona_docs` (
	`coleccion` text NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`coleccion`, `id`)
);
