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
    /**
     * Only allows this command to be used by users defined in config.owners
     */
    staff_only?: boolean;
    /**
     * Skips moderation checks for this command
     */
    skip_moderation?: boolean;
    command: CommandBuilder;
    execute: (client: Client, interaction: CommandInteraction) => Promise<void>;
    autocomplete?: (client: Client, interaction: AutocompleteInteraction) => Promise<void>;
}
export type Component = {
    /**
     * The custom ID of the component
     * Please note that anything after the first double underscore is treated as a parameter and is ignored when matching custom IDs
     * e.g. if the custom ID is "my_component__my_parameter", the custom ID `my_component` will be used to find a handler
     */
    custom_id: string;
    type: ComponentTypes;
    /**
     * Only allows this component to be used by users defined in config.owners
     */
    staff_only?: boolean;
    /**
     * Skips moderation checks for this component
     */
    skip_moderation?: boolean;
    execute: (client: Client, interaction: ComponentInteraction) => Promise<void>;
}
export enum ComponentTypes {
    "BUTTON" = 1,
    "STRING_SELECT" = 2,
    "ROLE_SELECT" = 3,
    "USER_SELECT" = 4,
    "CHANNEL_SELECT" = 5,
}