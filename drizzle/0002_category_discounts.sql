CREATE TABLE `cafe_category_discounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cafeId` int NOT NULL,
	`category` varchar(80) NOT NULL,
	`discountPercent` int unsigned NOT NULL DEFAULT 0,
	CONSTRAINT `cafe_category_discounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `cafe_category_discounts_cafe_category_unique` UNIQUE(`cafeId`,`category`),
	CONSTRAINT `cafe_category_discounts_percent_range` CHECK(`cafe_category_discounts`.`discountPercent` >= 0 AND `cafe_category_discounts`.`discountPercent` <= 100)
);
--> statement-breakpoint
ALTER TABLE `menu_items` ADD `discountPercent` int unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cafe_category_discounts` ADD CONSTRAINT `cafe_category_discounts_cafeId_cafes_id_fk` FOREIGN KEY (`cafeId`) REFERENCES `cafes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cafe_category_discounts_cafe_idx` ON `cafe_category_discounts` (`cafeId`);--> statement-breakpoint
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_discount_percent_range` CHECK (`menu_items`.`discountPercent` >= 0 AND `menu_items`.`discountPercent` <= 100);