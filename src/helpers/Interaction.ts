import * as types from "../types";
import type { ServerResponse } from "http";

import { Client } from "../Client";
import { EmbedBuilder, ModalBuilder, RowBuilder, SelectBuilder } from "../builders";
import { sendJson } from "./http";

import { moderateTextBasic } from "../moderation";

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

type CommandAutocompleteChoice = {
    name: string;
    value: string;
}


type ResponseData = {
    type: types.ResponseTypes.SEND_MESSAGE | types.ResponseTypes.UPDATE_MESSAGE;
    data: MessageBody;
} | {
    type: types.ResponseTypes.SEND_MESSAGE_DEFERRED | types.ResponseTypes.UPDATE_MESSAGE_DEFERRED;
    data: {
        flags?: number| null;
    };
} | {
    type: types.ResponseTypes.MODAL;
    data: ModalBuilder;
} | {
    type: types.ResponseTypes.AUTOCOMPLETE;
    data: {
        choices: CommandAutocompleteChoice[];
    };
} | {
    type: types.ResponseTypes;
    data?: any;
};

class Interaction {
    // req: types.ExtendedRequest<types.InteractionBody>;
    body: types.InteractionBody;
    res: ServerResponse;
    client: Client;
    id: string;
    application_id: string;
    member: types.GuildMember | null;
    user: types.User;
    message: types.Message;
    token: string;
    type: types.InteractionTypes;
    locale: string | null;
    channelId: string;
    guildId: string | null;

    // used by the internal handler to track if it has been responded to within the 15 seconds
    responded: boolean;
    received_at: Date;

    constructor(body:types.InteractionBody, res:ServerResponse, client:Client) {
        this.body = body;
        this.res = res;
        this.client = client;
        this.id = body.id;
        this.application_id = body.application_id;
        if (body.context === types.InteractionContextType.GUILD) {
            this.member = body.member ?? null;
            this.user = body.member.user;
            this.guildId = body.guild_id;
        } else {
            this.member = null;
            this.user = body.user;
            this.guildId = null;
        };
        this.message = body.message;
        this.token = body.token;
        this.type = body.type;
        this.locale = body.locale ?? null;
        this.channelId = body.channel_id;
        this.responded = false;
        this.received_at = new Date();
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
        if (this.responded) throw new Error("Cannot respond to an interaction twice");
        sendJson(this.res, 200, data);
        this.responded = true;
        const time_since_received = (Date.now() - this.received_at.getTime()) / 1000;
        /* @ts-ignore */
        if (time_since_received > 3) this.client.logToConsole(`Interaction handler for ${this.body.data.custom_id ?? this.body.data.name} took longer than 3 seconds (${time_since_received.toFixed(2)}s) to send an initial response`, "warn");
        const result = await fetch(`https://discord.com/api/webhooks/${this.client.config.application.id}/${this.token}/messages/@original`, {
            method: "GET"
        });
        /* @ts-ignore */
        if (!result.ok) this.client.logToConsole(`Failed to fetch initial response for ${this.body.data.custom_id ?? this.body.data.name} (${result.status})\n${await result.text()}`, "error");
        const reply = await result.json().catch(() => null);
        return reply as types.Message;
    };
};

class TextBasedInteraction extends Interaction {
    type: types.InteractionTypes.APPLICATION_COMMAND | types.InteractionTypes.MESSAGE_COMPONENT | types.InteractionTypes.MODAL_SUBMIT;

    constructor(body:types.InteractionBodyCommand | types.InteractionBodyComponent | types.InteractionBodyModal, res:ServerResponse, client:Client) {
        super(body, res, client);
        this.type = body.type;
    };

    async reply(data:MessageBody, ephemeral?:boolean) {
        data.flags = ephemeral ? 1 << 6 : null
        return await this.respond({ type: types.ResponseTypes.SEND_MESSAGE, data: data });
    }
    async deferReply(ephemeral?:boolean) {
        return await this.respond({ type: types.ResponseTypes.SEND_MESSAGE_DEFERRED, data: { flags: ephemeral ? 1 << 6 : null } });
    };

    async editReply(data:MessageBody) {
        const request = await fetch(`https://discord.com/api/webhooks/${this.client.config.application.id}/${this.token}/messages/@original`, {
            method: "PATCH",
            mode: "cors",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(generateBody(data))
        });
        const result = tryParseJSON(await request.text());
        if (!request.ok) this.handleError(result, {status: request.status, url: request.url, method: "PATCH"}, data);
        return result;
    };
    async followUp(data:MessageBody, ephemeral?:boolean) {
        data.flags = ephemeral ? 1 << 6 : null
        const request = await fetch(`https://discord.com/api/webhooks/${this.client.config.application.id}/${this.token}/`, {
            method: "POST",
            mode: "cors",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(generateBody(data))
        });
        const result = tryParseJSON(await request.text());
        if (!request.ok) this.handleError(result, {status: request.status, url: request.url, method: "POST"}, data);
        return result;
    };
};

class CommandInteraction extends TextBasedInteraction {
    type: types.InteractionTypes.APPLICATION_COMMAND;
    command_name: string;
    target_id: string | null;
    target_member: types.PartialGuildMember | null;
    options: InteractionOptions;

    constructor(body:types.InteractionBodyCommand, res:ServerResponse, client:Client) {
        super(body, res, client);
        this.type = body.type;
        this.command_name = body.data.name;
        this.target_id = body.data.target_id ?? null;
        this.target_member = this.target_id && body.data.resolved?.members ? body.data.resolved?.members[this.target_id] : null;
        this.options = new InteractionOptions(this);
    };

    async modal(data:ModalBuilder) {
        await this.respond({ type: types.ResponseTypes.MODAL, data: data });

        const interaction = this;

        return new Promise<ModalInteraction|null>((resolve) => {
            function handleModalResponse(modal_interaction:ModalInteraction) {
                if (modal_interaction.type === types.InteractionTypes.MODAL_SUBMIT && modal_interaction.custom_id === data.custom_id && modal_interaction.user.id === interaction.user.id) {
                    if (interaction.client.config.moderation?.enabled) {
                        for (const { value } of modal_interaction.options.toArray()) {
                            const moderation_result = moderateTextBasic(value, { enabled_word_lists: interaction.client.config.moderation.enabled_word_lists, disabled_word_lists: interaction.client.config.moderation.disabled_word_lists });
                            if (moderation_result.isProfane) {
                                resolve(null);
                                return interaction.reply({ content: interaction.client.config.moderation?.flagged_response ?? "Your input violates content policy" }, true).catch(() => {
                                    interaction.followUp({ content: interaction.client.config.moderation?.flagged_response ?? "Your input violates content policy" }, true);
                                });
                            }
                        };
                    };
                    resolve(modal_interaction);
                    interaction.client.removeListener("interaction", handleModalResponse);
                };
            };
            this.client.addListener("interaction", handleModalResponse);
            setTimeout(() => {
                interaction.client.removeListener("interaction", handleModalResponse);
                resolve(null);
            }, 1000 * 60 * 15);
        });
    };
};

class AutocompleteInteraction extends Interaction {
    type: types.InteractionTypes.AUTOCOMPLETE;
    command_name: string;
    options: InteractionOptions;
    
    constructor(body:types.InteractionBodyAutocomplete, res:ServerResponse, client:Client) {
        super(body, res, client);
        this.type = body.type;
        this.command_name = body.data.name;
        this.options = new InteractionOptions(this);
    };
    async autocomplete(data:CommandAutocompleteChoice[]) {
        return await this.respond({ type: types.ResponseTypes.AUTOCOMPLETE, data: { choices: data.slice(0, 25) } });
    };
};

class ModalInteraction extends TextBasedInteraction {
    type: types.InteractionTypes.MODAL_SUBMIT;
    custom_id: string;
    options: InteractionOptions;
    
    constructor(body:types.InteractionBodyModal, res:ServerResponse, client:Client) {
        super(body, res, client);
        this.type = body.type;
        this.custom_id = body.data.custom_id;
        this.options = new InteractionOptions(this);
    };

    async update(data:MessageBody) {
        return await this.respond({ type: types.ResponseTypes.UPDATE_MESSAGE, data: data });
    };
    async deferUpdate(ephemeral?:boolean) {
        return await this.respond({ type: types.ResponseTypes.UPDATE_MESSAGE_DEFERRED, data: { flags: ephemeral ? 1 << 6 : null } });
    };
};

class ComponentInteraction extends TextBasedInteraction {
    type: types.InteractionTypes.MESSAGE_COMPONENT;
    custom_id: string;
    options: InteractionOptions;
    
    constructor(body:types.InteractionBodyComponent, res:ServerResponse, client:Client) {
        super(body, res, client);
        this.type = body.type;
        this.custom_id = body.data.custom_id;
        this.options = new InteractionOptions(this);
    };

    async update(data:MessageBody) {
        return await this.respond({ type: types.ResponseTypes.UPDATE_MESSAGE, data: data });
    };
    async deferUpdate(ephemeral?:boolean) {
        return await this.respond({ type: types.ResponseTypes.UPDATE_MESSAGE_DEFERRED, data: { flags: ephemeral ? 1 << 6 : null } });
    };

    async modal(data:ModalBuilder) {
        const response_data = data.toJSON();

        await this.respond({ type: types.ResponseTypes.MODAL, data: response_data });

        const interaction = this;

        return new Promise<ModalInteraction|null>((resolve) => {
            function handleModalResponse(modal_interaction:ModalInteraction) {
                if (modal_interaction.type === types.InteractionTypes.MODAL_SUBMIT && modal_interaction.custom_id === data.custom_id && modal_interaction.user.id === interaction.user.id) {
                    if (interaction.client.config.moderation?.enabled) {
                        for (const { value } of modal_interaction.options.toArray()) {
                            const moderation_result = moderateTextBasic(value, { enabled_word_lists: interaction.client.config.moderation.enabled_word_lists, disabled_word_lists: interaction.client.config.moderation.disabled_word_lists });
                            if (moderation_result.isProfane) {
                                resolve(null);
                                return interaction.reply({ content: interaction.client.config.moderation?.flagged_response ?? "Your input violates content policy" }, true).catch(() => {
                                    interaction.followUp({ content: interaction.client.config.moderation?.flagged_response ?? "Your input violates content policy" }, true);
                                });
                            }
                        };
                    };
                    resolve(modal_interaction);
                    interaction.client.removeListener("interaction", handleModalResponse);
                };
            };
            this.client.addListener("interaction", handleModalResponse);
            setTimeout(() => {
                interaction.client.removeListener("interaction", handleModalResponse);
                resolve(null);
            }, 1000 * 60 * 15);
        });
    };
};

type OptionNameToValueType = {
    textInput: string;
    stringSelect: string[];
    userSelect: (types.PartialGuildMember & { user: types.User })[];
    roleSelect: types.GuildRole[];
    mentionableSelect: ((types.PartialGuildMember & { user: types.User }) | types.GuildRole)[];
    channelSelect: types.PartialChannel[];
    
    radioGroup: string;
    checkboxGroup: string[];
    checkbox: boolean;
    attachment: types.MessageAttachment[];
    
    string: string;
    number: number;
    boolean: boolean;
    user: types.PartialGuildMember & { user: types.User };
    role: types.GuildRole;
    mentionable: (types.PartialGuildMember & { user: types.User }) | types.GuildRole;
    channel: types.PartialChannel;
}

class InteractionOptions {
    options: Map<string, any>;
    values: string[];
    resolved: types.InteractionResolvedData;
    subcommand?: string;
    group?: string;

    private cmd_options: types.CommandInteractionData["options"];
    private raw_options: types.CommandInteractionData["options"];
    private raw_rows: types.ModalInteractionData["components"];

    constructor(interaction: types.Interaction) {
        const interaction_type = interaction.body.type;
        this.options = new Map();
        this.cmd_options = [];
        this.raw_options = [];
        this.values = [];
        this.raw_rows = [];
        if (interaction_type === types.InteractionTypes.APPLICATION_COMMAND || interaction_type === types.InteractionTypes.AUTOCOMPLETE || interaction_type === types.InteractionTypes.MESSAGE_COMPONENT) {
            this.resolved = interaction.body.data.resolved ?? {};
        } else {
            this.resolved = {};
        }

        if (interaction_type == types.InteractionTypes.APPLICATION_COMMAND || interaction_type == types.InteractionTypes.AUTOCOMPLETE) {
            this.raw_options = interaction.body.data.options ?? [];
            this.cmd_options = this.raw_options;
            this.raw_options.forEach(option => {
                if (option.type === types.CommandInteractionDataOptionTypes.SUB_COMMAND_GROUP) {
                    this.group = option.name;
                    this.cmd_options = option.options;
                    option.options.forEach(sub_option => {
                        if (sub_option.type === types.CommandInteractionDataOptionTypes.SUB_COMMAND) {
                            this.subcommand = sub_option.name;
                            this.cmd_options = sub_option.options;
                            sub_option.options.forEach(sub_sub_option => this.options.set(sub_sub_option.name, this.parseCommmandOption(sub_sub_option, this.resolved)));
                        }
                    });
                } else if (option.type === types.CommandInteractionDataOptionTypes.SUB_COMMAND) {
                    this.subcommand = option.name;
                    this.cmd_options = option.options;
                    option.options.forEach(sub_option => this.options.set(sub_option.name, this.parseCommmandOption(sub_option, this.resolved)));
                } else {
                    this.options.set(option.name, this.parseCommmandOption(option, this.resolved));
                }
            })
        } else if (interaction_type === types.InteractionTypes.MESSAGE_COMPONENT && ![types.MessageComponentTypes.ACTION_ROW,types.MessageComponentTypes.BUTTON].includes(interaction.body.data.component_type) ) {
            this.values = interaction.body.data.values;
            const component_type = interaction.body.data.component_type;
            const custom_id = interaction.body.data.custom_id;
            this.values.forEach(value => this.options.set(custom_id, this.parseSelectOption(value, this.resolved, component_type)));
        } else if (interaction_type === types.InteractionTypes.MODAL_SUBMIT) {
            this.raw_rows = interaction.body.data.components;
            this.raw_rows.forEach(row => {
                const component = row.component;
                if (component.type === types.ModalComponentTypes.STRING_SELECT || component.type === types.ModalComponentTypes.MENTIONABLE_SELECT || component.type === types.ModalComponentTypes.ROLE_SELECT || component.type === types.ModalComponentTypes.USER_SELECT) {
                    this.options.set(component.custom_id, component.values.map(x => this.parseSelectOption(x, this.resolved, component.type)));
                } else {
                    /* @ts-ignore */
                    this.options.set(component.custom_id, component.values ?? component.value);
                };
            });
        }
    };

    private parseCommmandOption(option:types.CommandInteractionData["options"][0], resolved:types.InteractionResolvedData) {
        if (option.type === types.CommandInteractionDataOptionTypes.USER) {
            resolved.users ??= {};
            const user = resolved.users[option.value] ?? {id: option.value};
            const member = resolved.members && resolved.members[option.value] ? resolved.members[option.value] : {};
            return {...member, user};
        } else if (option.type === types.CommandInteractionDataOptionTypes.CHANNEL) {
            resolved.channels ??= {};
            const channel = resolved.channels[option.value] ?? {id: option.value};
            return channel;
        } else if (option.type === types.CommandInteractionDataOptionTypes.ROLE) {
            resolved.roles ??= {};
            const role = resolved.roles[option.value] ?? {id: option.value};
            return role;
        } else if (option.type === types.CommandInteractionDataOptionTypes.ATTACHMENT) {
            resolved.attachments ??= {};
            const attachment = resolved.attachments[option.value] ?? {id: option.value};
            return attachment;
        } else if (option.type === types.CommandInteractionDataOptionTypes.STRING || option.type === types.CommandInteractionDataOptionTypes.BOOLEAN || option.type === types.CommandInteractionDataOptionTypes.NUMBER || option.type === types.CommandInteractionDataOptionTypes.INTEGER || option.type === types.CommandInteractionDataOptionTypes.MENTIONABLE) {
            return option.value;
        };
    };
    private parseSelectOption(value:string, resolved:types.InteractionResolvedData, type:types.MessageComponentTypes | types.ModalComponentTypes) {
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

    get<T extends keyof OptionNameToValueType>(name:string): OptionNameToValueType[T] {
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
};

function generateBody(data:MessageBody) {
    return {
        content: data.content ? data.content : "",
        tts: Boolean(data.tts),
        embeds: data.embeds?.map(embed => embed.toJSON()),
        components: data.components?.map(component => component.toJSON()),
        attachments: data.attachments?.length ? data.attachments?.map((file, i) => ({ id: `${i}`, description: file.description })) : null,
    }
};

function tryParseJSON(str:string) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return false;
    }
}


export { CommandInteraction, AutocompleteInteraction, ModalInteraction, ComponentInteraction };