import type { IncomingMessage } from "http";

import { Client } from "../Client";
import { CommandBuilder } from "../builders";
import { CommandInteraction, AutocompleteInteraction, ComponentInteraction } from "../helpers/Interaction";

export * from "./interaction_response";
export * from "./api";

import { CommandInteractionDataOptionTypes as CommandOptionTypes } from "./interaction_response";
export { CommandOptionTypes };

/**
 * 			FRAMEWORK TYPES
 */
export type ExtendedRequest<T = { [key: string]: any }> = IncomingMessage & {
    body: T;
}

export type Command = {
    visible?: boolean;
    staff_only?: boolean;
    command: CommandBuilder;
    execute: (client: Client, interaction: CommandInteraction) => Promise<void>;
    autocomplete?: (client: Client, interaction: AutocompleteInteraction) => Promise<void>;
}
export type Component = {
    custom_id: string;
    type: ComponentTypes;
    staff_only?: boolean;
    execute: (client: Client, interaction: ComponentInteraction) => Promise<void>;
}
export enum ComponentTypes {
    "BUTTON" = 1,
    "STRING_SELECT" = 2,
    "ROLE_SELECT" = 3,
    "USER_SELECT" = 4,
    "CHANNEL_SELECT" = 5,
}