CREATE TABLE `rl_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`displayName` text NOT NULL,
	`passwordHash` text NOT NULL,
	`recoveryHash` text NOT NULL,
	`preferences` text DEFAULT '{"partnership":true,"pickup":true,"message":true}' NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rl_accounts_email` ON `rl_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `rl_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`kg` real NOT NULL,
	`storage` text NOT NULL,
	`diet` text DEFAULT '[]' NOT NULL,
	`allergens` text NOT NULL,
	`pickupLocation` text NOT NULL,
	`startAt` text NOT NULL,
	`endAt` text NOT NULL,
	`verified` integer NOT NULL,
	`status` text NOT NULL,
	`assignedPickupId` text,
	`source` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `rl_organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rl_listing_owner` ON `rl_listings` (`ownerId`);--> statement-breakpoint
CREATE INDEX `rl_listing_available` ON `rl_listings` (`status`,`endAt`);--> statement-breakpoint
CREATE TABLE `rl_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`pickupId` text NOT NULL,
	`authorId` text NOT NULL,
	`body` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`pickupId`) REFERENCES `rl_pickups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`authorId`) REFERENCES `rl_organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rl_message_thread` ON `rl_messages` (`pickupId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `rl_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`eventKey` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`entityId` text NOT NULL,
	`readAt` text,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `rl_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rl_notification_event` ON `rl_notifications` (`userId`,`eventKey`);--> statement-breakpoint
CREATE INDEX `rl_notification_user` ON `rl_notifications` (`userId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `rl_organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`area` text NOT NULL,
	`timezone` text DEFAULT 'America/Los_Angeles' NOT NULL,
	`capacityKg` real DEFAULT 0 NOT NULL,
	`accepting` integer DEFAULT 0 NOT NULL,
	`receivingStart` text DEFAULT '09:00' NOT NULL,
	`receivingEnd` text DEFAULT '18:00' NOT NULL,
	`storage` text DEFAULT '["Chilled","Ambient"]' NOT NULL,
	`categories` text DEFAULT '["Prepared meals","Produce","Bakery","Dairy"]' NOT NULL,
	`requiredDiet` text DEFAULT '' NOT NULL,
	`excludedAllergens` text DEFAULT '[]' NOT NULL,
	`discoverable` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `rl_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rl_organization_owner` ON `rl_organizations` (`ownerId`);--> statement-breakpoint
CREATE INDEX `rl_organization_discovery` ON `rl_organizations` (`discoverable`);--> statement-breakpoint
CREATE TABLE `rl_partnerships` (
	`id` text PRIMARY KEY NOT NULL,
	`orgA` text NOT NULL,
	`orgB` text NOT NULL,
	`requesterId` text NOT NULL,
	`status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`orgA`) REFERENCES `rl_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`orgB`) REFERENCES `rl_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requesterId`) REFERENCES `rl_organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rl_partnership_pair` ON `rl_partnerships` (`orgA`,`orgB`);--> statement-breakpoint
CREATE INDEX `rl_partnership_b` ON `rl_partnerships` (`orgB`);--> statement-breakpoint
CREATE TABLE `rl_pickups` (
	`id` text PRIMARY KEY NOT NULL,
	`listingId` text NOT NULL,
	`donorId` text NOT NULL,
	`receiverId` text NOT NULL,
	`status` text NOT NULL,
	`serviceDay` text NOT NULL,
	`windowStart` text NOT NULL,
	`windowEnd` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`collectedAt` text,
	`receipt` text,
	FOREIGN KEY (`listingId`) REFERENCES `rl_listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`donorId`) REFERENCES `rl_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receiverId`) REFERENCES `rl_organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rl_active_pickup_request` ON `rl_pickups` (`listingId`,`receiverId`) WHERE "rl_pickups"."status" in ('requested','approved');--> statement-breakpoint
CREATE INDEX `rl_pickup_capacity` ON `rl_pickups` (`receiverId`,`serviceDay`,`status`);--> statement-breakpoint
CREATE INDEX `rl_pickup_donor` ON `rl_pickups` (`donorId`);--> statement-breakpoint
CREATE TABLE `rl_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expiresAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rl_rate_expiry` ON `rl_rate_limits` (`expiresAt`);--> statement-breakpoint
CREATE TABLE `rl_sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expiresAt` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `rl_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rl_sessions_user` ON `rl_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `rl_sessions_expiry` ON `rl_sessions` (`expiresAt`);