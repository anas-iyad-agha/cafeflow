ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','cafe_admin','super_admin') NOT NULL DEFAULT 'user';
--> statement-breakpoint
UPDATE `users` SET `role` = 'super_admin' WHERE `role` = 'admin';
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','cafe_admin','super_admin') NOT NULL DEFAULT 'user';
