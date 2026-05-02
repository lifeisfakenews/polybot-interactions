import { CommandInteraction, AutocompleteInteraction, ModalInteraction, ComponentInteraction } from "../helpers/Interaction";

import type { User, GuildMember, GuildFeatures, GuildRole, Message, MessageAttachment, MessageComponentTypes, ChannelTypes } from "./api";

export type InteractionIntegrationOwners = {
    [T in InteractionIntegrationOwnersTypes]: string
}
export enum InteractionIntegrationOwnersTypes {
    "GUILD_INSTALL" = "0",
    "USER_INSTALL" = "1"
}
export enum InteractionTypes {
    "PING" = 1,
    "APPLICATION_COMMAND" = 2,
    "MESSAGE_COMPONENT" = 3,
    "AUTOCOMPLETE" = 4,
    "MODAL_SUBMIT" = 5,
}
export enum ResponseTypes {
    "PONG" = 1,
    "SEND_MESSAGE" = 4,
    "SEND_MESSAGE_DEFERRED" = 5,
    "UPDATE_MESSAGE_DEFERRED" = 6,
    "UPDATE_MESSAGE" = 7,
    "AUTOCOMPLETE" = 8,
    "MODAL" = 9,
    "PREMIUM_REQUIRED" = 10,
    "LAUNCH_ACTIVITY" = 12,
}
export enum CommandTypes {
    "CHAT_INPUT" = 1,
    "USER" = 2,
    "MESSAGE" = 3,
    "PRIMARY_ENTRY_POINT" = 4,
}
export enum IntegrationTypes {
    "GUILD_INSTALL" = 0,
    "USER_INSTALL" = 1
}
export enum InteractionContextType {
    "GUILD" = 0,
    "BOT_DM" = 1,
    "PRIVATE_CHANNEL" = 2,
}


export type PartialChannel = {
    id: string;
    name: string;
    type: ChannelTypes;
    permissions?: string;
    thread_metadata?: {
        archived: boolean;
        auto_archive_duration: number;
        archive_timestamp: string;
        locked: boolean;
        invitable?: boolean;
    };
    parent_id?: string;
}
export type PartialGuildMember = Omit<GuildMember, "user" | "mute" | "deaf">;

export type InteractionResolvedData = {
    users?: {[key: string]: User};
    members?: {[key: string]: PartialGuildMember};
    roles?: {[key: string]: GuildRole};
    channels?: {[key: string]: PartialChannel};
    messages?: {[key: string]: Message};
    attachments?: {[key: string]: MessageAttachment};
}


export enum CommandInteractionDataOptionTypes {
    "SUB_COMMAND" = 1,
    "SUB_COMMAND_GROUP" = 2,
    "STRING" = 3,
    "INTEGER" = 4,
    "BOOLEAN" = 5,
    "USER" = 6,
    "CHANNEL" = 7,
    "ROLE" = 8,
    "MENTIONABLE" = 9,
    "NUMBER" = 10,
    "ATTACHMENT" = 11,
}

type CommandInteractionDataOptionBase = {
    name: string;
    focused?: boolean;
}
type CommandInteractionDataOptionGroup = CommandInteractionDataOptionBase & {
    type: CommandInteractionDataOptionTypes.SUB_COMMAND_GROUP
    options: CommandInteractionDataOptionSubcommand[];
}
type CommandInteractionDataOptionSubcommand = CommandInteractionDataOptionBase & {
    type: CommandInteractionDataOptionTypes.SUB_COMMAND;
    options: CommandInteractionDataOptionBase & (CommandInteractionDataOptionString[] | CommandInteractionDataOptionNumber[] | CommandInteractionDataOptionBoolean[]);
}
type CommandInteractionDataOptionString = CommandInteractionDataOptionBase & {
    type: CommandInteractionDataOptionTypes.STRING | CommandInteractionDataOptionTypes.MENTIONABLE | CommandInteractionDataOptionTypes.USER | CommandInteractionDataOptionTypes.CHANNEL | CommandInteractionDataOptionTypes.ROLE | CommandInteractionDataOptionTypes.ATTACHMENT;
    value: string;
}
type CommandInteractionDataOptionNumber = CommandInteractionDataOptionBase & {
    type: CommandInteractionDataOptionTypes.INTEGER | CommandInteractionDataOptionTypes.NUMBER;
    value: number;
}
type CommandInteractionDataOptionBoolean = CommandInteractionDataOptionBase & {
    type: CommandInteractionDataOptionTypes.BOOLEAN;
    value: boolean;
}
type CommandInteractionDataOption = CommandInteractionDataOptionSubcommand | CommandInteractionDataOptionGroup | CommandInteractionDataOptionString | CommandInteractionDataOptionNumber | CommandInteractionDataOptionBoolean;

export type CommandInteractionData = {
    id: string;
    name: string;
    type: CommandTypes;
    resolved?: InteractionResolvedData;
    options: CommandInteractionDataOption[];
    guild_id?: string;
    target_id?: string;
}



export type ComponentInteractionData = {
    custom_id: string;
    component_type: MessageComponentTypes;
    values: string[];
    resolved?: InteractionResolvedData;
}



export enum ModalComponentTypes {
    "STRING_SELECT" = 3,
    "TEXT_INPUT" = 4,
    "USER_SELECT" = 5,
    "ROLE_SELECT" = 6,
    "MENTIONABLE_SELECT" = 7,
    "CHANNEL_SELECT" = 8,
    "TEXT_DISPLAY" = 10,
    "LABEL" = 18,
    "FILE_UPLOAD" = 19,
    "RADIO_GROUP" = 21,
    "CHECKBOX_GROUP" = 22,
    "CHECKBOX" = 23,
}

type ModalInteractionDataTextInput = {
    type: ModalComponentTypes.TEXT_INPUT;
    id: number;
    custom_id: string;
    value: string;
}
type ModalInteractionDataStringSelect = {
    type: ModalComponentTypes.STRING_SELECT;
    id: number;
    custom_id: string;
    values: string[];
}
type ModalInteractionDataEntitySelect = {
    type: ModalComponentTypes.USER_SELECT | ModalComponentTypes.ROLE_SELECT | ModalComponentTypes.MENTIONABLE_SELECT | ModalComponentTypes.CHANNEL_SELECT;
    id: number;
    custom_id: string;
    resolved?: InteractionResolvedData;
    values: string[];
}
type ModalInteractionDataFileUpload = {
    type: ModalComponentTypes.FILE_UPLOAD;
    id: number;
    custom_id: string;
    resolved?: InteractionResolvedData;
    /**
     * Array of snowflakes that reference files in `resolved.attachments`
     */
    values: string[];
}

type ModalInteractionDataRadioGroup = {
    type: ModalComponentTypes.RADIO_GROUP;
    id: number;
    custom_id: string;
    value: string | null;
}
type ModalInteractionDataCheckboxGroup = {
    type: ModalComponentTypes.CHECKBOX_GROUP;
    id: number;
    custom_id: string;
    values: string[];
}
type ModalInteractionDataCheckbox = {
    type: ModalComponentTypes.CHECKBOX;
    id: number;
    custom_id: string;
    value: boolean;
}
type ModalInteractionDataLabel = {
    type: ModalComponentTypes.LABEL;
    id: string;
    component: ModalInteractionDataRadioGroup | ModalInteractionDataCheckboxGroup | ModalInteractionDataCheckbox | ModalInteractionDataStringSelect | ModalInteractionDataEntitySelect | ModalInteractionDataTextInput | ModalInteractionDataFileUpload;
}
export type ModalInteractionData = {
    custom_id: string;
    components: ModalInteractionDataLabel[];
}

type InteractionBodyDM = {
    context: InteractionContextType.BOT_DM | InteractionContextType.PRIVATE_CHANNEL;

    user: User;
}
type InteractionBodyGuild = {
    context: InteractionContextType.GUILD;
    guild: {
        features: GuildFeatures[];
        id: string;
        locale: string;
    };
    guild_id: string;
    guild_locale: string;

    member: GuildMember;
}

type InteractionBodyBase = (InteractionBodyDM | InteractionBodyGuild) & {
    app_permissions: string;
    application_id: string;
    attachment_size_limit: number;
    authorizing_integration_owners: InteractionIntegrationOwners;
    channel: {
        flags: number;
        guild_id: string;
        id: string;
        last_message_id: string;
        name: string;
        nsfw: boolean;
        parent_id: string;
        permissions: string;
        position: number;
        rate_limit_per_user: number;
        topic: string | null;
        type: number;
    };
    channel_id: string;
    context: InteractionContextType;
    id: string;
    locale: string;
    message: Message;
    token: string;
    // type: InteractionTypes;
    version: number;
}

export type InteractionBodyPing = { type: InteractionTypes.PING; };
export type InteractionBodyCommand = InteractionBodyBase & { type: InteractionTypes.APPLICATION_COMMAND; data: CommandInteractionData };
export type InteractionBodyAutocomplete = InteractionBodyBase & { type: InteractionTypes.AUTOCOMPLETE; data: CommandInteractionData };
export type InteractionBodyComponent = InteractionBodyBase & { type: InteractionTypes.MESSAGE_COMPONENT; data: ComponentInteractionData };
export type InteractionBodyModal = InteractionBodyBase & { type: InteractionTypes.MODAL_SUBMIT; data: ModalInteractionData };

export type InteractionBody = InteractionBodyCommand | InteractionBodyAutocomplete | InteractionBodyComponent | InteractionBodyModal;
export type InteractionBodyWithPing = InteractionBodyPing | InteractionBody;

export type Interaction = CommandInteraction | AutocompleteInteraction | ModalInteraction | ComponentInteraction;