import { z } from 'zod';

export const contractVersionSchema = z.literal(1);

export type ContractVersion = z.infer<typeof contractVersionSchema>;

export const contractVersion: ContractVersion = 1;
