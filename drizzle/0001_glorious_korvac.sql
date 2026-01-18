CREATE TABLE `athletes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`bodyWeight` decimal(6,2),
	`squat` decimal(6,2),
	`bench` decimal(6,2),
	`deadlift` decimal(6,2),
	`total` decimal(8,2),
	`ohp` decimal(6,2),
	`inclineBench` decimal(6,2),
	`rdl` decimal(6,2),
	`revBandBench` decimal(6,2),
	`revBandSquat` decimal(6,2),
	`revBandDl` decimal(6,2),
	`slingshotBench` decimal(6,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `athletes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `liftRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`athleteId` int NOT NULL,
	`exerciseType` varchar(50) NOT NULL,
	`weight` decimal(6,2) NOT NULL,
	`reps` int DEFAULT 1,
	`recordedDate` date NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `liftRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weightEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`athleteId` int NOT NULL,
	`weight` decimal(6,2) NOT NULL,
	`recordedDate` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weightEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `athleteId` int;--> statement-breakpoint
CREATE INDEX `totalIdx` ON `athletes` (`total`);--> statement-breakpoint
CREATE INDEX `athleteIdx` ON `liftRecords` (`athleteId`);--> statement-breakpoint
CREATE INDEX `exerciseIdx` ON `liftRecords` (`exerciseType`);--> statement-breakpoint
CREATE INDEX `dateIdx` ON `liftRecords` (`recordedDate`);--> statement-breakpoint
CREATE INDEX `athleteIdx` ON `weightEntries` (`athleteId`);--> statement-breakpoint
CREATE INDEX `dateIdx` ON `weightEntries` (`recordedDate`);