import { SlashCommand } from './types';
import type { SliceSet } from './storeTypes';

interface SlashCommandsSlice {
  slashCommands: SlashCommand[];
  setSlashCommands: (commands: SlashCommand[]) => void;
}

const createSlashCommandsSlice = (set: SliceSet): SlashCommandsSlice => ({
  slashCommands: [],
  setSlashCommands: (commands) => set({ slashCommands: commands }),
});

export { type SlashCommandsSlice, createSlashCommandsSlice };
