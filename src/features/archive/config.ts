import z from '@deepseek-ai/schemastery';

export const configFields = {
  archiveManagerEnabled: z.boolean().default(false).volatile(),
  // Automatic archiving is one preference: `0` means never, so there is no
  // second switch to keep in sync with the threshold.
  autoArchiveDays: z.number().default(0).volatile(),
  // Internal Host policy state: ids that were already auto-archived once, so a
  // session the user unarchives is never hidden again behind their back.
  autoArchivedSessions: z.array(z.string()).default([]).volatile(),
};
