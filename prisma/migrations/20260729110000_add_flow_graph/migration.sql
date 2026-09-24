-- AlterTable: add flowGraph column to Automation for visual flow builder graph persistence
ALTER TABLE `Automation` ADD COLUMN `flowGraph` JSON NULL;
