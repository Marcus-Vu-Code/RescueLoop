CREATE TABLE `rl_email_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`notificationId` text NOT NULL,
	`userId` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`nextAt` text NOT NULL,
	`expiresAt` text NOT NULL,
	`lease` text,
	`providerId` text,
	`lastError` text,
	`sentAt` text,
	FOREIGN KEY (`notificationId`) REFERENCES `rl_notifications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`userId`) REFERENCES `rl_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rl_email_notification` ON `rl_email_outbox` (`notificationId`);--> statement-breakpoint
CREATE INDEX `rl_email_ready` ON `rl_email_outbox` (`status`,`nextAt`);--> statement-breakpoint
CREATE TABLE `rl_email_tokens` (
	`hash` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`purpose` text NOT NULL,
	`expiresAt` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `rl_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rl_email_token_purpose` ON `rl_email_tokens` (`userId`,`purpose`);--> statement-breakpoint
ALTER TABLE `rl_accounts` ADD `emailVerifiedAt` text;--> statement-breakpoint
ALTER TABLE `rl_accounts` ADD `emailEnabled` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER rl_queue_notification_email AFTER INSERT ON rl_notifications
WHEN EXISTS (SELECT 1 FROM rl_accounts a WHERE a.id=NEW.userId AND a.emailVerifiedAt IS NOT NULL AND a.emailEnabled=1 AND COALESCE(json_extract(a.preferences,'$.'||NEW.kind),1)=1)
BEGIN
  INSERT OR IGNORE INTO rl_email_outbox(id,notificationId,userId,status,attempts,nextAt,expiresAt)
  VALUES(NEW.id,NEW.id,NEW.userId,'pending',0,NEW.createdAt,strftime('%Y-%m-%dT%H:%M:%fZ',NEW.createdAt,'+23 hours'));
END;
