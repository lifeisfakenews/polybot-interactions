import * as types from "../types";
import type { ServerResponse } from "http";

import { Client } from "../Client";
import { EmbedBuilder, ModalBuilder, RowBuilder, SelectBuilder } from "../builders";
import { sendJson } from "./http";

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
        choices: types.CommandAutocompleteChoice[];
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
        sendJson(this.res, 200, data);
        const result = await fetch(`https://discord.com/api/webhooks/${this.client.config.application.id}/${this.token}/messages/@original`, {
            method: "GET"
        });
        const reply = await result.json().catch(() => null);
        return reply;
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
    async followUp(data:MessageBody) {
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
                if (modal_interaction.type === types.InteractionTypes.MODAL_SUBMIT && modal_interaction.custom_id === data.data.custom_id && modal_interaction.user.id === interaction.user.id) {
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
    async autocomplete(data:types.CommandAutocompleteChoice[]) {
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
        await this.respond({ type: types.ResponseTypes.MODAL, data: data });

        const interaction = this;

        return new Promise<ModalInteraction|null>((resolve) => {
            function handleModalResponse(modal_interaction:ModalInteraction) {
                if (modal_interaction.type === types.InteractionTypes.MODAL_SUBMIT && modal_interaction.custom_id === data.data.custom_id && modal_interaction.user.id === interaction.user.id) {
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
};


class InteractionOptions {
    options: Map<string, any>;
    values: string[];
    resolved: types.InteractionResolvedData;
    subcommand?: string;
    group?: string;

    private cmd_options: types.CommandOption[];
    private raw_options: types.CommandOption[];
    private raw_rows: types.ModalActionRow[];

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
                if (option.type === types.CommandOptionTypes.SUB_COMMAND_GROUP) {
                    this.group = option.name;
                    this.cmd_options = option.options;
                    option.options.forEach(sub_option => {
                        if (sub_option.type === types.CommandOptionTypes.SUB_COMMAND) {
                            this.subcommand = sub_option.name;
                            this.cmd_options = sub_option.options;
                            sub_option.options.forEach(sub_sub_option => this.options.set(sub_sub_option.name, this.parseCommmandOption(sub_sub_option, this.resolved)));
                        }
                    });
                } else if (option.type === types.CommandOptionTypes.SUB_COMMAND) {
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
                row.components.forEach(component => {
                    if (component.type === types.MessageComponentTypes.TEXT_INPUT) {
                        this.options.set(component.custom_id, component.value);
                    };
                });
            });
        }
    };

    private parseCommmandOption(option:types.CommandOption, resolved:types.InteractionResolvedData) {
        if (option.type === types.CommandOptionTypes.USER) {
            resolved.users ??= {};
            const user = resolved.users[option.value] ?? {id: option.value};
            const member = resolved.members && resolved.members[option.value] ? resolved.members[option.value] : {};
            return {...user, member};
        } else if (option.type === types.CommandOptionTypes.CHANNEL) {
            resolved.channels ??= {};
            const channel = resolved.channels[option.value] ?? {id: option.value};
            return channel;
        } else if (option.type === types.CommandOptionTypes.ROLE) {
            resolved.roles ??= {};
            const role = resolved.roles[option.value] ?? {id: option.value};
            return role;
        } else if (option.type === types.CommandOptionTypes.ATTACHMENT) {
            resolved.attachments ??= {};
            const attachment = resolved.attachments[option.value] ?? {id: option.value};
            return attachment;
        } else if (option.type === types.CommandOptionTypes.STRING || option.type === types.CommandOptionTypes.BOOLEAN || option.type === types.CommandOptionTypes.NUMBER || option.type === types.CommandOptionTypes.INTEGER || option.type === types.CommandOptionTypes.MENTIONABLE) {
            return option.value;
        };
    };
    private parseSelectOption(value:string, resolved:types.InteractionResolvedData, type:types.MessageComponentTypes) {
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