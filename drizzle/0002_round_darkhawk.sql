CREATE TABLE `mission_activity` (
	`id` int AUTO_INCREMENT NOT NULL,
	`missionId` int NOT NULL,
	`actorId` int,
	`action` varchar(128) NOT NULL,
	`summary` text NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mission_activity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mission_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`missionId` int NOT NULL,
	`uploadedById` int NOT NULL,
	`fileName` varchar(512) NOT NULL,
	`mimeType` varchar(255) NOT NULL,
	`fileKey` varchar(1024) NOT NULL,
	`url` varchar(2048) NOT NULL,
	`sizeBytes` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mission_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mission_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`missionId` int NOT NULL,
	`approvalId` int,
	`recipientId` int,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`status` enum('queued','sent','failed') NOT NULL DEFAULT 'queued',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`deliveredAt` timestamp,
	CONSTRAINT `mission_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `mission_activity_mission_created_idx` ON `mission_activity` (`missionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `mission_attachments_mission_created_idx` ON `mission_attachments` (`missionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `mission_notifications_mission_created_idx` ON `mission_notifications` (`missionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `mission_notifications_approval_idx` ON `mission_notifications` (`approvalId`);