import { readdirSync } from "node:fs";
import { EventEmitter } from "node:events";
import nacl from "tweetnacl";
import { join } from "path";
import http, { IncomingMessage, ServerResponse } from "http";

import { RowBuilder, SelectBuilder, EmbedBuilder } from ".";
import { readJsonBody, sendJson, sendText } from "./helpers/http";

import * as types from "./types";

import { CommandInteraction, AutocompleteInteraction, ModalInteraction, ComponentInteraction } from "./helpers/Interaction";
import { REST } from "./helpers/rest";

type MessageBody = {
    content?: string;
    tts?: boolean;
    embeds?: EmbedBuilder[];
    components?: (RowBuilder|SelectBuilder)[];
    attachments?: types.MessageAttachment[];
    flags?: number | null;
}

export type Config<T = { [key: string]: any }> = {
    application: {
        token: string;
        id: string;
        public_key: string;
    };
    folders?: {
        commands?: string;
        components?: string;
    };
    logging?: {
        webhook_url?: string;
    };
    port: number;
    owners: string[];

    additional: T;
};

type LogTypes = "error" | "reload" | "eval" | "other";
type LogLevel = "error" | "warn" | "info" | "debug";
type LogOptions = {
    cb?: string;
    footer?: string;
    author?: string;
    type?: LogTypes;
}

interface ClientEvents {
    interaction: types.Interaction;
}

const log_formats = {
    "error": { color: 0xEA2920, name: "Client Error", level: "error" },
    "reload": { color: 0x37FB70, name: "Bot Restarted", level: "info" },
    "eval": { color: 0xFF36E1, name: "Code Evalutated", level: "info" },
    "other": { color: 0x00B5AE, name: "Other Log Message", level: "info" },
} as const;

type RouteHandlerCallback = (req: IncomingMessage, res: ServerResponse) => any;

class Client extends EventEmitter {
    config: Config;
    private web_server: http.Server;
    private rest: REST;
    commands: Map<string, types.Command>;
    components: Map<string, types.Component>;
    private users: Map<string, types.User>;
    private guilds: Map<string, types.Guild>;
    private channels: Map<string, types.Channel>;
    private members: Map<string, types.GuildMember>;

    private routes: Map<string, RouteHandlerCallback>;

    constructor(given_config:Config) {
        super();

        this.config = given_config;
        this.rest = new REST(this.config.application.token);
        this.commands = new Map();
        this.components = new Map();
        this.users = new Map();
        this.guilds = new Map();
        this.channels = new Map();
        this.members = new Map();
        this.routes = new Map();

        this.web_server = http.createServer((req, res) => this.handleRequest(req, res));
        this.web_server.listen(this.config.port, () => this.log(`Listening at port: ${this.config.port}`, "reload"));
    };

    async init() {
        if (this.config.folders?.commands) {
            const commandFiles = readdirSync(this.config.folders.commands).filter(file => file.endsWith(".js") || file.endsWith(".ts"));
    
            for (const path of commandFiles) {
                try {
                    const pathname = join(this.config.folders.commands, path);
                    const module = await import(pathname);
                    const command = module.default;
                    this.commands.set(command.command.data.name, command);
                } catch (error:any) {
                    this.log(`Error loading command file \`${path}\`: \`${error}\``, "error");
                }
            };
        }

        if (this.config.folders?.components) {
            const componentFiles = readdirSync(this.config.folders.components).filter(file => file.endsWith(".js") || file.endsWith(".ts"));
    
            for (const path of componentFiles) {
                try {
                    const pathname = join(this.config.folders.components, path);
                    const module = await import(pathname);
                    const component = module.default;
                    this.components.set(component.custom_id, component);
                } catch (error:any) {
                    this.log(`Error loading component file \`${path}\`: \`${error}\``, "error");
                }
            };
        };

        this.registerCommands();
    };

    private async handleRequest(req:IncomingMessage, res:ServerResponse) {
        if (req.method === "POST" && req.url === "/_polybot/interactions") {
            const jsonBody = await readJsonBody<types.InteractionBodyWithPing>(req);
            if (!jsonBody) return sendText(res, 400, "Invalid JSON");

            const signature = req.headers["x-signature-ed25519"]!;
            const timestamp = req.headers["x-signature-timestamp"]!;
            /* @ts-ignore */
            const isVerified = nacl.sign.detached.verify(Buffer.from(`${timestamp}${JSON.stringify(jsonBody)}`), Buffer.from(signature, "hex"), Buffer.from(this.config.application.public_key, "hex"));
            if (!isVerified) return sendText(res, 401, "invalid request signature");
            if (jsonBody.type === types.InteractionTypes.PING) return sendJson(res, 200, { type: types.ResponseTypes.PONG });

            const req2 = req as types.ExtendedRequest<types.InteractionBody>;
            req2.body = jsonBody;

            let interaction;
            if (jsonBody.type === types.InteractionTypes.APPLICATION_COMMAND) interaction = new CommandInteraction(jsonBody, res, this);
            else if (jsonBody.type === types.InteractionTypes.AUTOCOMPLETE) interaction = new AutocompleteInteraction(jsonBody, res, this);
            else if (jsonBody.type === types.InteractionTypes.MESSAGE_COMPONENT) interaction = new ComponentInteraction(jsonBody, res, this);
            else if (jsonBody.type === types.InteractionTypes.MODAL_SUBMIT) interaction = new ModalInteraction(jsonBody, res, this);

            if (!interaction) return;
            if (this.listenerCount("interaction") > 0) {
                this.emit("interaction", interaction);
            } else {
                await this.dispatchInteraction(interaction);
            }
        } else if (req.method && this.routes.has(`${req.method.toLowerCase()}__${req.url}`)) {
            const handler = this.routes.get(`${req.method.toLowerCase()}__${req.url}`)!;
            return await handler(req, res);
        } else {
            return sendText(res, 404, "Not Found");
        };
    };

    async addRouteHandler(path: string, method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH", handler: RouteHandlerCallback) {
        this.routes.set(`${method.toLowerCase()}__${path}`, handler);
    };

    private async dispatchInteraction(interaction: types.Interaction) {
        if (interaction.type === types.InteractionTypes.APPLICATION_COMMAND) {
            try {
                const command = this.commands.get(interaction.command_name);
                if (!command) return await interaction.reply({ content: `No handler found for command ${interaction.command_name}` }, true);
                if (command.staff_only && !this.config.owners.includes(interaction.user.id)) return await interaction.reply({ content: "You don't have permission to use this command!" }, true);

                await command.execute(this, interaction);
            } catch (e:any) {
                const error_id = this.generateSnowflake();
                this.log(`## Command Error\nID: \`${error_id}\`\nCommand: ${interaction.command_name} ${interaction.options && interaction.options.subcommand ? `${interaction.options.group ?? ""} ${interaction.options.subcommand}` : ""}\nUser: ${interaction.user.username} (\`${interaction.user.id}\`)\nOptions: ${interaction.options.toArray().map(x => `- ${x.name}: \`${x.value}\``)}\nError:\n\`\`\`${e.toString()}\`\`\``, "error");
                await interaction.reply({ content: `There was an error while executing this command!\n${this.toRedCodeBlock(e.toString())}\nError ID: \`${error_id}\`` }, true);
            };
        } else if (interaction.type === types.InteractionTypes.AUTOCOMPLETE) {
            try {
                const command = this.commands.get(interaction.command_name);
                if (!command || !command.autocomplete) return await interaction.autocomplete([{ name: "No autocomplete handler has been defined", value: "__error__no_handler" }])
                await command.autocomplete(this, interaction);
            } catch (e:any) {
                const error_id = this.generateSnowflake();
                this.log(`## Autocomplete Error\nID: \`${error_id}\`\nCommand: ${interaction.command_name} ${interaction.options && interaction.options.subcommand ? `${interaction.options.group ?? ""} ${interaction.options.subcommand}` : ""}\nUser: ${interaction.user.username} (\`${interaction.user.id}\`)\nOptions: ${interaction.options.toArray().map(x => `- ${x.name}: \`${x.value}\``)}\nError:\n\`\`\`${e.toString()}\`\`\``, "error");
                await interaction.autocomplete([{ name: `An error occurred while fetching values. ID ${error_id}`, value: `__error__${error_id}` }]);
            };
        } else if (interaction.type === types.InteractionTypes.MESSAGE_COMPONENT) {
            try {
                if (!interaction.custom_id) return await interaction.reply({ content: "Invalid component interaction" }, true);
                const custom_id = interaction.custom_id.split("__")[0];
                const component = this.components.get(custom_id);
                if (!component) return await interaction.reply({ content: `No handler found for ${custom_id}\nNote that anything after double underscores (__) is treated as a parameter and is ignored.` }, true);
                if (component.staff_only && !this.config.owners.includes(interaction.user.id)) return await interaction.reply({ content: "You don't have permission to use this component!" }, true);

                await component.execute(this, interaction);
            } catch (e:any) {
                const error_id = this.generateSnowflake();
                this.log(`## Component Error\nID: \`${error_id}\`\Custom ID: ${interaction.custom_id}\nUser: ${interaction.user.username} (\`${interaction.user.id}\`)\nOptions: ${interaction.options.toArray().map(x => `- ${x.name}: \`${x.value}\``)}\nError:\n\`\`\`${e.toString()}\`\`\``, "error");
                await interaction.reply({ content: `There was an error while executing this command!\n${this.toRedCodeBlock(e.toString())}\nError ID: \`${error_id}\`` }, true);
            };
        };
    };

    emit<K extends keyof ClientEvents>(event: K, payload: ClientEvents[K]): boolean {
        return super.emit(event, payload);
    };
    on<K extends keyof ClientEvents>(event: K, listener: (data: ClientEvents[K]) => void): this {
        return super.on(event, listener);
    };
    once<K extends keyof ClientEvents>(event: K, listener: (data: ClientEvents[K]) => void): this {
        return super.once(event, listener);
    };

    async log(items:any, options?:LogOptions|LogTypes) {
        if (typeof options == "string") options = {type: options};
        const details = log_formats[options?.type ?? "other"];
        if (this.config.logging?.webhook_url) {
            let content = options?.cb ? `\`\`\`${options.cb}\n${items}\n\`\`\`` : `${items}`;
            content = content.replaceAll("/usr/src/app/node_modules/", "@")
            content = content.replaceAll("    at ", "  ")
            const request = await fetch(this.config.logging.webhook_url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: details.name,
                    avatar_url: `https://resources.votemanager.xyz/assets/logs/${options?.type ?? "other"}.png`,
                    embeds: [{
                        color: details.color,
                        description: `${content.length > 2000 ? content.slice(0, 1950) + `\n+${content.length - 1950} more characters` : content}`,
                        footer: options?.footer ? { text: options.footer } : undefined,
                        author: options?.author ? { name: options.author } : undefined,
                    }]
                })
            }).catch(this.logToConsole);

            if (request && !request.ok) {
                this.logToConsole(`Failed to send message to Discord Webhook (${request.status} ${request.statusText}). Response body:`, "error");
                this.logToConsole(await request.text(), "error");
            };
        };

        this.logToConsole(items, details.level);
    };

    private logToConsole(content:string, level:LogLevel = "info") {
        const color = {
            error: "\x1b[31m",
            warn: "\x1b[33m",
            info: "\x1b[36m",
            debug: "\x1b[36m",
        };
        console.log(`${color[level]}[PolyBot]\x1b[0m ${content}`);
    };

    private toRedCodeBlock(text:string) {
        return `\`\`\`ansi\n\u001b[1;31m${text}\n\`\`\``;
    };

    async getUser(userId:string) {
        const userCache = this.users.get(userId);
        if (userCache) return userCache;
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/users/${userId}`, {
            method: "GET",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "Content-Type": "application/json"
            }
        }).catch(e => log(e, "error"));
        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, getUser\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        const userData = await response.json() as types.User;
        this.users.set(userId, userData);
        return userData;
    };

    async getGuild(guildId:string) {
        const guildCache = this.guilds.get(guildId);
        if (guildCache) return guildCache;

        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/guilds/${guildId}`, {
            method: "GET",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "Content-Type": "application/json"
            }
        }).catch(e => log(e, "error"));

        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, getGuild\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        const guildData = await response.json() as types.Guild;
        this.guilds.set(guildId, guildData);
        return guildData;
    };
    async getGuilds() {
        let guilds:types.Guild[] = [], first_pass = true, data:types.Guild[] = [];

        const log = this.log;
        while (first_pass || data[199]) {
            const response = await this.rest.fetch(`https://discord.com/api/users/@me/guilds/${first_pass ? "" : `?after=${data[199].id}`}`, {
                method: "GET",
                headers: {
                    Authorization: `Bot ${this.config.application.token}`,
                    "Content-Type": "application/json"
                },
            }).catch(e => log(e, "error"));
            if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, getGuilds\n${await response.text()}`, "error");this.log(response, "error")};
            if (!response || !response.ok) continue;
            data = await response.json() as types.Guild[];
            guilds = [...guilds, ...data];
            first_pass = false;
        };

        return guilds;
    };

    async getMember(guildId:string, userId:string) {
        const memberCache = this.members.get(`${guildId}_${userId}`);
        if (memberCache && userId !== "959699003010871307") return memberCache;
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/guilds/${guildId}/members/${userId}`, {
            method: "GET",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "Content-Type": "application/json"
            }
        }).catch(e => log(e, "error"));

        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, getMember\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        const userData = await response.json() as types.GuildMember;
        this.members.set(`${guildId}_${userId}`, userData);
        return userData;
    }
    async getMembers(guildId:string) {
        let members:types.GuildMember[] = [], first_pass = true, data:types.GuildMember[] = [];
        const log = this.log;
        while (first_pass || data[199]) {
            const response = await this.rest.fetch(`https://discord.com/api/guilds/${guildId}/members/${first_pass ? "" : `?after=${data[999].user.id}`}`, {
                method: "GET",
                headers: {
                    Authorization: `Bot ${this.config.application.token}`,
                    "Content-Type": "application/json"
                },
            }).catch(e => log(e, "error"));
            if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, getMembers\n${await response.text()}`, "error");this.log(response, "error")};
            if (!response || !response.ok) continue;
            data = await response.json() as types.GuildMember[];
            members = [...members, ...data];
            first_pass = false;
            // await sleep(700);
        };
        return members;
    };

    async getRoles(guildId:string) {
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/guilds/${guildId}/roles`, {
            method: "GET",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "Content-Type": "application/json"
            }
        }).catch(e => log(e, "error"));

        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, getRoles\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        return await response.json() as types.GuildRole[];
    };
    async createRole(name:string, guildId:string, color:number, hoist?:boolean, mentionable?:boolean, permissions?:number, reason?:string) {
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/guilds/${guildId}/roles`, {
            method: "POST",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "X-Audit-Log-Reason": reason ?? "",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                color: color,
                hoist: hoist,
                mentionable: mentionable,
                permissions: permissions,
            })
        }).catch(e => log(e, "error"));

        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, createRole\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        return await response.json() as types.GuildRole;
    };
    async updateRole(roleId:string, guildId:string, name?:string, color?:number, hoist?:boolean, mentionable?:boolean, permissions?:number, reason?:string) {
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/guilds/${guildId}/roles${roleId}`, {
            method: "PATCH",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "X-Audit-Log-Reason": reason ?? "",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                color: color,
                hoist: hoist,
                mentionable: mentionable,
                permissions: permissions,
            })
        }).catch(e => log(e, "error"));

        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, createRole\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        return await response.json() as types.GuildRole;
    };
    async deleteRole(roleId:string, guildId:string, reason?:string) {
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/guilds/${guildId}/roles${roleId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "X-Audit-Log-Reason": reason ?? "",
                "Content-Type": "application/json"
            },
        }).catch(e => log(e, "error"));

        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, deleteRole\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        return await response.json() as types.GuildRole;
    };
    async giveRole(roleId:string, guildId:string, memberId:string, reason?:string) {
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/guilds/${guildId}/members/${memberId}/roles/${roleId}`, {
            method: "PUT",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "X-Audit-Log-Reason": reason ?? "",
                "Content-Type": "application/json"
            },
        }).catch(e => log(e, "error"));

        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, giveRole\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        return await response.json() as types.GuildRole;
    };

    async takeRole(roleId:string, guildId:string, memberId:string, reason?:string) {
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/guilds/${guildId}/members/${memberId}/roles/${roleId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "X-Audit-Log-Reason": reason ?? "",
                "Content-Type": "application/json"
            },
        }).catch(e => log(e, "error"));

        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, takeRole\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        return await response.json() as types.GuildRole;
    };

    async getChannel(channelId:string) {
        const channelCache = this.channels.get(channelId);
        if (channelCache) return channelCache;

        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/channels/${channelId}`, {
            method: "GET",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "Content-Type": "application/json"
            }
        }).catch(e => log(e, "error"));

        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, getChannel\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        const channelData = await response.json() as types.Channel;
        this.channels.set(channelId, channelData);
        return channelData
    };
    async getChannels(guildId:string) {
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/guilds/${guildId}/channels`, {
            method: "GET",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "Content-Type": "application/json"
            }
        }).catch(e => log(e, "error"));

        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, getChannels\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        return await response.json() as types.Channel[];
    };
    async createChannel(name:string, guildId:string, type:types.ChannelTypes, permission_overwrites?:types.ChannelOverwrite[], parent_id?:string, reason?:string) {
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/guilds/${guildId}/channels`, {
            method: "POST",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "X-Audit-Log-Reason": reason ?? "",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                type: type,
                permission_overwrites: permission_overwrites,
                parent_id: parent_id,
            })
        }).catch(e => log(e, "error"));
        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, createChannel\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        return await response.json() as types.Channel;
    };
    async updateChannel(channelId:string, name?:string, permission_overwrites?:types.ChannelOverwrite[], parent_id?:string, reason?:string) {
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/channels/${channelId}`, {
            method: "PATCH",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "X-Audit-Log-Reason": reason ?? "",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                permission_overwrites: permission_overwrites,
                parent_id: parent_id,
            })
        }).catch(e => log(e, "error"));
        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, updateChannel\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        return await response.json() as types.Channel;
    };
    async updateChannelOverwrite(channelId:string, overwriteId:string, type:types.ChannelOverwriteTypes, allow?:number|string, deny?:number|string, reason?:string) {
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/channels/${channelId}/permissions/${overwriteId}`, {
            method: "PUT",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "X-Audit-Log-Reason": reason ?? "",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                type: type,
                allow: allow,
                deny: deny,
            })
        }).catch(e => log(e, "error"));
        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, updateChannelOverwrite\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        return await response.json() as types.Channel;
    };
    async deleteChannel(channelId:string, reason?:string) {
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/channels/${channelId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "X-Audit-Log-Reason": reason ?? "",
                "Content-Type": "application/json"
            },
        }).catch(e => log(e, "error"));
        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, deleteChannel\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        return await response.json() as types.Channel;
    };
    async deleteChannelOverwrite(channelId:string, overwriteId:string, reason?:string) {
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/channels/${channelId}/permissions/${overwriteId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "X-Audit-Log-Reason": reason ?? "",
                "Content-Type": "application/json"
            },
        }).catch(e => log(e, "error"));
        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, deleteChannelOverwrite\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        return await response.json() as types.Channel;
    };

    async createThread(name:string, channelId:string, type:types.ChannelTypes.PRIVATE_THREAD|types.ChannelTypes.PUBLIC_THREAD|types.ChannelTypes.ANNOUNCEMENT_THREAD, message?:MessageBody, reason?:string) {
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/channels/${channelId}/threads`, {
            method: "POST",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "X-Audit-Log-Reason": reason ?? "",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                type: type,
                message: message,
            })
        }).catch(e => log(e, "error"));
        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, createThread\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        return await response.json() as types.Channel;
    };
    async createThreadFromMessage(name:string, channelId:string, messageId:string, reason?:string) {
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/channels/${channelId}/messages/${messageId}/threads` , {
            method: "POST",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "X-Audit-Log-Reason": reason ?? "",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name,
            })
        }).catch(e => log(e, "error"));
        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, createThreadFromMessage\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        return await response.json() as types.Channel;
    };
    async updateThread(channelId:string, name?:string, archived?:boolean, locked?:boolean, applied_tags?:string[], reason?:string) {
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/channels/${channelId}`, {
            method: "PATCH",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "X-Audit-Log-Reason": reason ?? "",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                archived: archived,
                locked: locked,
                applied_tags: applied_tags,
            })
        }).catch(e => log(e, "error"));
        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, updateThread\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        return await response.json() as types.Channel;
    };

    async createMessage(channelId?:string, content?:string, embeds?:EmbedBuilder[], components?:(SelectBuilder|RowBuilder)[], attachments?:types.MessageAttachment[], tts?:boolean) {
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/channels/${channelId}/messages` , {
            method: "POST",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                content: content ? content : "",
                tts: Boolean(tts),
                embeds: embeds?.map(embed => embed.toJSON()),
                components: components?.map(component => component.toJSON()),
                attachments: attachments?.length ? attachments?.map((file, i) => ({ id: `${i}`, description: file.description })) : null,
            })
        }).catch(e => log(e, "error"));
        if (response && !response.ok) {this.log(`Discord API Request failed ${response.status}, sendMessage\n${await response.text()}`, "error");this.log(response, "error")};
        if (!response || !response.ok) return null;
        return await response.json() as types.Message;
    };

    async registerCommands() {
        const commands = Array.from(this.commands.values()).map(x => x.command);

        const response = await this.rest.fetch(`https://discord.com/api/v10/applications/${this.config.application.id}/commands`, {
            method: "PUT",
            headers: {
                Authorization: `Bot ${this.config.application.token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(commands)
        });

        if (!response || response.status !== 200) return await response.text();
        return await response.json();
    };

    getUserAvatar(userId:string, avatarHash?:string|null) {
        /*@ts-ignore*/
        return avatarHash ? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}` : `https://cdn.discordapp.com/embed/avatars/${(userId >> 22) % 6}.png`;
    };
    getUserBanner(userId:string, bannerHash?:string|null) {
        return bannerHash ? `https://cdn.discordapp.com/banners/${userId}/${bannerHash}` : null;
    };

    hasPermission(memberPermissions:number, permission:number) {
        return (memberPermissions & permission) === permission;
    };

    isJSON(data:any) {
        return data !== null && typeof data === "object" && "toJSON" in data;
    };

    snowflakeToDate(snowflake:string) {
        //shout out chatGPT
        const unixTime = (BigInt(snowflake) / BigInt(4194304)) + BigInt(1420070400000);
        return new Date(Number(unixTime));
    };
    generateSnowflake() {
        let timestamp = new Date((Math.floor(Date.now() / 1000)) * 4194304 - 1420070400000);
        return (Math.ceil(timestamp.getTime() * 100)).toString();
    };
};

export { Client };