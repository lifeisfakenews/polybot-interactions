import * as types from "../types";
import type { Request, Response } from "express";

import { EmbedBuilder, ModalBuilder, RowBuilder, Client, SelectBuilder } from "./";


type ErrorRequest = {
    status: number;
    url: string;
    method: string;
}

type MessageBody = {
    content?: string;
    tts?: boolean;
    embeds?: EmbedBuilder[];
    components?: (RowBuilder|SelectBuilder)[];
    attachments?: types.MessageAttachment[];
    flags?: number | null;
}
type AutocompleteChoice = {
    name: string;
    value: string;
}

enum OptionTypes {
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

type BaseOption = {
    name: string;
    focused?: boolean;
}
type Option = OptionSubcommand | OptionGroup | OptionString | OptionNumber | OptionBoolean;

type OptionGroup = BaseOption & {
    type: OptionTypes.SUB_COMMAND_GROUP
    options: OptionSubcommand[];
}
type OptionSubcommand = BaseOption & {
    type: OptionTypes.SUB_COMMAND;
    options: BaseOption & (OptionString[] | OptionNumber[] | OptionBoolean[]);
}
type OptionString = BaseOption & {
    type: OptionTypes.STRING | OptionTypes.MENTIONABLE | OptionTypes.USER | OptionTypes.CHANNEL | OptionTypes.ROLE | OptionTypes.ATTACHMENT;
    value: string;
}
type OptionNumber = BaseOption & {
    type: OptionTypes.INTEGER | OptionTypes.NUMBER;
    value: number;
}
type OptionBoolean = BaseOption & {
    type: OptionTypes.BOOLEAN;
    value: boolean;
}

type TextInput = {
    type: types.MessageComponentTypes.TEXT_INPUT;
    custom_id: string;
    style: TextInputStyles;
    label: string;
    min_length?: number;
    max_length?: number;
    required?: boolean;
    value?: string;
    placeholder?: string;
}
enum TextInputStyles {
    "SHORT" = 1,
    "PARAGRAPH" = 2,
}
type ModalActionRow = {
    type: types.MessageComponentTypes.ACTION_ROW;
    components: TextInput[];
}

export enum InteractionTypes {
    "PING" = 1,
    "APPLICATION_COMMAND" = 2,
    "MESSAGE_COMPONENT" = 3,
    "APPLICATION_COMMAND_AUTOCOMPLETE" = 4,
    "MODAL_SUBMIT" = 5,
}

export enum ResponseTypes {
    "PONG" = 1,
    "SEND_MESSAGE" = 4,
    "SEND_MESSAGE_DEFERRED" = 5,
    "UPDATE_MESSAGE_DEFERRED" = 6,
    "UPDATE_MESSAGE" = 7,
    "APPLICATION_COMMAND_AUTOCOMPLETE_RESULT" = 8,
    "MODAL" = 9,
    "PREMIUM_REQUIRED" = 10,
    "LAUNCH_ACTIVITY" = 12,
}


type PartialChannel = {
    id: string;
    name: string;
    type: types.ChannelTypes;
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
type PartialGuildMember = Omit<types.GuildMember, "user" | "mute" | "deaf">;

type ResolvedData = {
    users?: {[key: string]: types.User};
    members?: {[key: string]: PartialGuildMember};
    roles?: {[key: string]: types.GuildRole};
    channels?: {[key: string]: PartialChannel};
    messages?: {[key: string]: types.Message};
    attachments?: {[key: string]: types.MessageAttachment};
}


type ResponseData = {
    type: ResponseTypes.SEND_MESSAGE | ResponseTypes.UPDATE_MESSAGE;
    data: MessageBody;
} | {
    type: ResponseTypes.SEND_MESSAGE_DEFERRED | ResponseTypes.UPDATE_MESSAGE_DEFERRED;
    data: {
        flags?: number| null;
    };
} | {
    type: ResponseTypes.MODAL;
    data: ModalBuilder;
} | {
    type: ResponseTypes.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT;
    data: {
        choices: AutocompleteChoice[];
    };
} | {
    type: ResponseTypes;
    data?: any;
};

class Interaction {
    req: Request;
    res: Response;
    client: Client;
    id: string;
    application_id: string;
    member: types.GuildMember | null;
    user: types.User;
    message: types.Message;
    token: string;
    type: InteractionTypes;
    locale: string | null;
    channelId: string;
    guildId: string;
    custom_id: string | null;
    commandName: string;
    targetId: string | null;
    targetMember: types.GuildMember | null;
    options: InteractionOptions;

    constructor(req:Request, res:Response, client:Client) {
        this.req = req;
        this.res = res;
        this.client = client;
        this.id = req.body.id;
        this.application_id = req.body.application_id,
        this.member = req.body.member ?? null;
        this.user = req.body?.member?.user ?? req.body.user;
        this.message = req.body.message;
        this.token = req.body.token;
        this.type = req.body.type;
        this.locale = req.body.locale ?? null;
        this.channelId = req.body.channel_id;
        this.guildId = req.body.guild_id;
        this.custom_id = req.body.data.custom_id ?? null;
        this.commandName = req.body.data.name ?? null;
        this.targetId = req.body.data.target_id ?? null;
        this.targetMember = req.body.data.resolved?.members ?? {};
        this.options = new InteractionOptions(this);
    };

    generateBody(data:MessageBody) {
        return {
            content: data.content ? data.content : "",
            tts: Boolean(data.tts),
            embeds: data.embeds?.map(embed => embed.toJSON()),
            components: data.components?.map(component => component.toJSON()),
            attachments: data.attachments?.length ? data.attachments?.map((file, i) => ({ id: `${i}`, description: file.description })) : null,
        }
    };

    async handleError(result:any, request:ErrorRequest, data:{[key:string]:any}) {
        const bad_data = result ? Object.keys(result).filter(x => data[x]).map(x => `### \`${x}\`\n\`\`\`json\n${JSON.stringify(this.client.isJSON(data[x]) ? data[x].toJSON() : data[x], null, 2)}\n\`\`\``) : [];
        this.client.log(`${request.method} \`${request.url}\` failed with status ${request.status}\n\n## Error\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n## Data\n${bad_data.length ? bad_data.join("\n") : `\`\`\`json\n${JSON.stringify(data, null, 4)}\n\`\`\``}`, "error");
        await fetch(request.url, {
            method: request.method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                content: "Something went wrong while trying to process your request\nIf this error persists, please contact the developers",
            }),
        });
    };
    async respond(data: ResponseData) {
        this.res.send(data);
        const result = await fetch(`https://discord.com/api/webhooks/${this.client.config.id}/${this.token}/messages/@original`, {
            method: "GET"
        });
        const reply = await result.json().catch(() => null);
        return reply;
    };

    async reply(data:MessageBody, ephemeral?:boolean) {
        data.flags = ephemeral ? 1 << 6 : null
        return await this.respond({ type: ResponseTypes.SEND_MESSAGE, data: data });
    }
    async update(data:MessageBody) {
        return await this.respond({ type: ResponseTypes.UPDATE_MESSAGE, data: data });
    }
    async deferReply(ephemeral?:boolean) {
        return await this.respond({ type: ResponseTypes.SEND_MESSAGE_DEFERRED, data: { flags: ephemeral ? 1 << 6 : null } });
    };
    async deferUpdate(ephemeral?:boolean) {
        return await this.respond({ type: ResponseTypes.UPDATE_MESSAGE_DEFERRED, data: { flags: ephemeral ? 1 << 6 : null } });
    };
    async autocomplete(data:AutocompleteChoice[]) {
        return await this.respond({ type: ResponseTypes.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT, data: { choices: data } });
    };
    async modal(data:ModalBuilder) {
        await this.respond({ type: ResponseTypes.MODAL, data: data });

        const interaction = this;

        return new Promise<Interaction|null>((resolve) => {
            function handleModalResponse(modal_interaction:Interaction) {
                if (modal_interaction.type === InteractionTypes.MODAL_SUBMIT && modal_interaction.custom_id === data.data.custom_id && modal_interaction.user.id === interaction.user.id) {
                    resolve(modal_interaction);
                    interaction.client.removeListener("interaction", handleModalResponse);
                };
            };
            this.client.addListener("interaction", handleModalResponse);
            setTimeout(() => {
                interaction.client.removeListener("interaction", handleModalResponse);
                resolve(null);
            }, 240_000);
        });
    };

    async editReply(data:MessageBody) {
        const request = await fetch(`https://discord.com/api/webhooks/${this.client.config.id}/${this.token}/messages/@original`, {
            method: "PATCH",
            mode: "cors",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(this.generateBody(data))
        });
        const result = tryParseJSON(await request.text());
        if (!request.ok) this.handleError(result, {status: request.status, url: request.url, method: "PATCH"}, data);
        return result;
    };
    async followUp(data:MessageBody) {
        const request = await fetch(`https://discord.com/api/webhooks/${this.client.config.id}/${this.token}/`, {
            method: "POST",
            mode: "cors",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(this.generateBody(data))
        });
        const result = tryParseJSON(await request.text());
        if (!request.ok) this.handleError(result, {status: request.status, url: request.url, method: "POST"}, data);
        return result;
    };
};
class InteractionOptions {
    options: Map<string, any>;
    cmd_options: Option[];
    raw_options: Option[];
    values: string[];
    raw_rows: ModalActionRow[];
    resolved: ResolvedData;
    subcommand?: string;
    group?: string;

    constructor(interaction: Interaction) {
        this.options = new Map();
        this.cmd_options = [];
        this.raw_options = [];
        this.values = [];
        this.raw_rows = [];
        this.resolved = interaction.req.body.data.resolved ?? {};

        if (interaction.type == InteractionTypes.APPLICATION_COMMAND || interaction.type == InteractionTypes.APPLICATION_COMMAND_AUTOCOMPLETE) {
            this.raw_options = interaction.req.body.data.options ?? [];
            this.cmd_options = this.raw_options;
            this.raw_options.forEach(option => {
                if (option.type === OptionTypes.SUB_COMMAND_GROUP) {
                    this.group = option.name;
                    this.cmd_options = option.options;
                    option.options.forEach(sub_option => {
                        if (sub_option.type === OptionTypes.SUB_COMMAND) {
                            this.subcommand = sub_option.name;
                            this.cmd_options = sub_option.options;
                            sub_option.options.forEach(sub_sub_option => this.options.set(sub_sub_option.name, this.parseCommmandOption(sub_sub_option, this.resolved)));
                        }
                    });
                } else if (option.type === OptionTypes.SUB_COMMAND) {
                    this.subcommand = option.name;
                    this.cmd_options = option.options;
                    option.options.forEach(sub_option => this.options.set(sub_option.name, this.parseCommmandOption(sub_option, this.resolved)));
                } else {
                    this.options.set(option.name, this.parseCommmandOption(option, this.resolved));
                }
            })
        } else if (interaction.type === InteractionTypes.MESSAGE_COMPONENT && ![types.MessageComponentTypes.ACTION_ROW,types.MessageComponentTypes.BUTTON].includes(interaction.req.body.data.component_type) ) {
            this.values = interaction.req.body.data.values;
            this.values.forEach(value => this.options.set(interaction.custom_id!, this.parseSelectOption(value, this.resolved, interaction.req.body.data.component_type)));
        } else if (interaction.type === InteractionTypes.MODAL_SUBMIT) {
            this.raw_rows = interaction.req.body.data.components;
            this.raw_rows.forEach(row => {
                row.components.forEach(component => {
                    if (component.type === types.MessageComponentTypes.TEXT_INPUT) {
                        this.options.set(component.custom_id, component.value);
                    };
                });
            });
        }
    };

    parseCommmandOption(option:Option, resolved:ResolvedData) {
        if (option.type === OptionTypes.USER) {
            resolved.users ??= {};
            const user = resolved.users[option.value] ?? {id: option.value};
            const member = resolved.members && resolved.members[option.value] ? resolved.members[option.value] : {};
            return {...user, member};
        } else if (option.type === OptionTypes.CHANNEL) {
            resolved.channels ??= {};
            const channel = resolved.channels[option.value] ?? {id: option.value};
            return channel;
        } else if (option.type === OptionTypes.ROLE) {
            resolved.roles ??= {};
            const role = resolved.roles[option.value] ?? {id: option.value};
            return role;
        } else if (option.type === OptionTypes.ATTACHMENT) {
            resolved.attachments ??= {};
            const attachment = resolved.attachments[option.value] ?? {id: option.value};
            return attachment;
        } else if (option.type === OptionTypes.STRING || option.type === OptionTypes.BOOLEAN || option.type === OptionTypes.NUMBER || option.type === OptionTypes.INTEGER || option.type === OptionTypes.MENTIONABLE) {
            return option.value;
        };
    };
    parseSelectOption(value:string, resolved:ResolvedData, type:types.MessageComponentTypes) {
        if (type === types.MessageComponentTypes.USER_SELECT) {
            resolved.users ??= {};
            const user = resolved.users[value] ?? {id: value};
            const member = resolved.members && resolved.members[value] ? resolved.members[value] : {};
            return {...user, member};
        } else if (type === types.MessageComponentTypes.CHANNEL_SELECT) {
            resolved.channels ??= {};
            const channel = resolved.channels[value] ?? {id: value};
            return channel;
        } else if (type === types.MessageComponentTypes.ROLE_SELECT) {
            resolved.roles ??= {};
            const role = resolved.roles[value] ?? {id: value};
            return role;
        } else if (type === types.MessageComponentTypes.STRING_SELECT || type === types.MessageComponentTypes.MENTIONABLE_SELECT) {
            return value;
        };
    };

    get(name:string) {
        return this.options.get(name);
    }
    getAll() {
        return this.options;
    }
    toArray() {
        type OptionItem = {
            name: string;
            value: string;
        }
        const options:OptionItem[] = [];
        this.options.keys().forEach((key) => {
            options.push({
                name: key,
                value: this.options.get(key)
            });
        });
        return options;
    }
    first() {
        return this.options.values().next().value;
    }
    focused() {
        return this.cmd_options.find((x) => x.focused);
    }
}

function tryParseJSON(str:string) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return false;
    }
}


export { Interaction };