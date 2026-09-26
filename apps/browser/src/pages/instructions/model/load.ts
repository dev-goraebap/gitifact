import type { QueryClient } from '@tanstack/react-query';
import { instructionFileOptions, instructionsOptions, primeFrame } from '../../../entities/project';
import { prepareDiagrams } from '../../../shared/ui/document';

/**
 * Primes the instructions screens: the frame, every instruction, and for one instruction the page it opens on, its
 * index or the folder file the address names, with that page's diagrams drawn. `agents` opens AGENTS.md.
 */
export async function loadInstructions(client: QueryClient, open?: { instructionId?: string; file?: string | undefined; agents?: boolean }) {
  const { session } = await primeFrame(client);
  if (!session) return;
  const answer = await client.ensureQueryData(instructionsOptions(session)).catch(() => undefined);
  if (!answer || !open) return;
  if (open.agents) { await prepareDiagrams([answer.agents?.body]); return; }
  const instruction = answer.instructions.find(i => i.id === open.instructionId);
  if (!instruction) return;
  const found = open.file ? instruction.files.find(f => f.path === open.file) : undefined;
  if (!found) { await prepareDiagrams([instruction.body]); return; }
  const file = await client.ensureQueryData(instructionFileOptions(session, instruction.id, found.path, found.size)).catch(() => undefined);
  if (file && found.path.toLowerCase().endsWith('.md')) await prepareDiagrams([file.text]);
}