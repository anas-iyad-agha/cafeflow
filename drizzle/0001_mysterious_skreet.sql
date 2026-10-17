CREATE TABLE `cafes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int,
	`name` varchar(120) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`address` varchar(320) NOT NULL,
	`phone` varchar(80) NOT NULL,
	`hours` varchar(200) NOT NULL,
	`imageUrl` text NOT NULL,
	`isOpen` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cafes_id` PRIMARY KEY(`id`),
	CONSTRAINT `cafes_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cafeId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text NOT NULL,
	`priceCents` int unsigned NOT NULL,
	`category` varchar(80) NOT NULL,
	`imageUrl` text NOT NULL,
	`available` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `menu_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicToken` varchar(128) NOT NULL,
	`cafeId` int NOT NULL,
	`idempotencyKey` varchar(128) NOT NULL,
	`customerName` varchar(120) NOT NULL,
	`serviceType` enum('dine-in','takeaway') NOT NULL,
	`tableNumber` varchar(32),
	`notes` text NOT NULL,
	`status` enum('new','preparing','ready','completed','cancelled') NOT NULL DEFAULT 'new',
	`totalCents` int unsigned NOT NULL,
	`items` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_public_token_unique` UNIQUE(`publicToken`),
	CONSTRAINT `orders_cafe_idempotency_unique` UNIQUE(`cafeId`,`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `cafes` ADD CONSTRAINT `cafes_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_cafeId_cafes_id_fk` FOREIGN KEY (`cafeId`) REFERENCES `cafes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_cafeId_cafes_id_fk` FOREIGN KEY (`cafeId`) REFERENCES `cafes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cafes_owner_idx` ON `cafes` (`ownerId`);--> statement-breakpoint
CREATE INDEX `menu_items_cafe_idx` ON `menu_items` (`cafeId`);--> statement-breakpoint
CREATE INDEX `orders_cafe_created_idx` ON `orders` (`cafeId`,`createdAt`);