import {
  ComponentData,
  createContainer,
  isAttachment,
  withProperties,
} from "@magicyan/discord";
import { MessageFlags } from "discord.js";

type UnusedProps =
  | "content"
  | "embeds"
  | "components"
  | "ephemeral"
  | "fetchReply";

type ResFunction = <R>(...components: ComponentData[]) => R & {
  with<R>(options: Partial<Omit<R, UnusedProps>>): R;
};

type Res = Record<keyof typeof constants.colors, ResFunction>;
const defaultFlags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

function resolveFlags(flags: unknown): number {
  if (typeof flags === "number") {
    return flags | MessageFlags.IsComponentsV2;
  }

  if (Array.isArray(flags)) {
    return flags.reduce((acc, flag) => {
      if (typeof flag === "number") return acc | flag;
      return acc;
    }, MessageFlags.IsComponentsV2);
  }

  return defaultFlags;
}

export const res: Res = Object.entries(constants.colors).reduce(
  (acc, [key, color]) => ({
    ...acc,
    [key]: function (...components: ComponentData[]) {
      const container = createContainer(color, components);
      const files = components.filter(isAttachment);
      const defaults = {
        files,
        flags: defaultFlags,
        components: [container],
        content: null,
        embeds: [],
        withComponents: true,
      };
      const withFunc = (options: Record<string, unknown>) => {
        if ("flags" in options) {
          options.flags = resolveFlags(options.flags);
        }
        if ("files" in options && Array.isArray(options.files)) {
          options.files = [...files, ...options.files];
        }
        return { ...defaults, ...options };
      };
      return withProperties(defaults, { with: withFunc });
    },
  }),
  {} as Res,
);
