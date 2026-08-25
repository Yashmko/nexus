CREATE TABLE `mission_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`missionId` int NOT NULL,
	`requestedById` int NOT NULL,
	`assignedApproverId` int,
	`type` varchar(128) NOT NULL,
	`summary` text NOT NULL,
	`status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`decisionNote` text,
	`decidedById` int,
	`decidedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mission_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mission_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`missionId` int NOT NULL,
	`userId` int NOT NULL,
	`assignedById` int NOT NULL,
	`role` enum('analyst','reviewer','approver') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mission_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `missions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`missionKey` varchar(128) NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`account` varchar(255) NOT NULL,
	`scope` text NOT NULL,
	`status` enum('active','in_review','paused','complete','archived') NOT NULL DEFAULT 'active',
	`risk` enum('critical','high','medium','low','info') NOT NULL DEFAULT 'info',
	`stage` varchar(64) NOT NULL DEFAULT 'Target',
	`progress` int NOT NULL DEFAULT 0,
	`evidenceCount` int NOT NULL DEFAULT 0,
	`findingCount` int NOT NULL DEFAULT 0,
	`archived` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `missions_id` PRIMARY KEY(`id`),
	CONSTRAINT `missions_missionKey_unique` UNIQUE(`missionKey`)
);
--> statement-breakpoint
CREATE INDEX `mission_approvals_mission_status_idx` ON `mission_approvals` (`missionId`,`status`);--> statement-breakpoint
CREATE INDEX `mission_approvals_approver_status_idx` ON `mission_approvals` (`assignedApproverId`,`status`);--> statement-breakpoint
CREATE INDEX `mission_assignments_mission_user_idx` ON `mission_assignments` (`missionId`,`userId`);--> statement-breakpoint
CREATE INDEX `mission_assignments_user_idx` ON `mission_assignments` (`userId`);--> statement-breakpoint
CREATE INDEX `missions_owner_active_idx` ON `missions` (`ownerId`,`archived`);--> statement-breakpoint
CREATE INDEX `missions_status_risk_idx` ON `missions` (`status`,`risk`);