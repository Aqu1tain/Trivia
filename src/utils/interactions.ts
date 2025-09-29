import { MessageFlags, MessageFlagsBitField, type MessageFlagsResolvable } from 'discord.js';

type OptionsAvecEphemere<T> = T & { ephemeral?: boolean; flags?: MessageFlagsResolvable };

type OptionsNormalisees<T> = Omit<T, 'ephemeral'> & { flags?: MessageFlagsResolvable };

export function normaliserEphemere<T extends { ephemeral?: boolean; flags?: MessageFlagsResolvable }>(
  options: T,
): OptionsNormalisees<T> {
  const { ephemeral, flags, ...reste } = options as OptionsAvecEphemere<T>;
  if (!ephemeral) {
    return reste as OptionsNormalisees<T>;
  }

  if (typeof flags === 'undefined') {
    return { ...(reste as Record<string, unknown>), flags: MessageFlags.Ephemeral } as OptionsNormalisees<T>;
  }

  const bitfield = new MessageFlagsBitField();
  bitfield.add(flags, MessageFlags.Ephemeral);

  return { ...(reste as Record<string, unknown>), flags: bitfield.bitfield } as OptionsNormalisees<T>;
}
