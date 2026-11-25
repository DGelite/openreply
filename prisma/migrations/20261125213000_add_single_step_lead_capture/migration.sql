-- AlterTable: add singleStepLeadCapture and leadPromptBoth to Automation for single-step name+phone collection
ALTER TABLE `Automation`
  ADD COLUMN `singleStepLeadCapture` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `leadPromptBoth` TEXT NULL;
