import { readdirSync } from "node:fs";
import { EventEmitter } from "node:events";
import nacl from "tweetnacl";
import { join } from "path";
import http, { IncomingMessage, ServerResponse } from "http";

import { RowBuilder, SelectBuilder, EmbedBuilder } from ".";
import { readJsonBody, sendJson, sendText, serveStatic, attachResponseHelpers, type ExpressLikeResponse, attachRequestHelpers, type ExpressLikeRequest, matchRoute } from "./helpers/http";

import * as types from "./types";
import type { 
    User, Guild, GuildMember, GuildRole, Channel, ChannelOverwrite, ChannelOverwriteTypes, ChannelTypes, Message, MessageAttachment,
    GuildBan, GuildInvite, AuditLog, Emoji
} from "./types";

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

export type Config<T = { [key: string]: any }> = T & {
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
    web_server: {
        port: number;
        interactions_endpoint?: string;
        publicDir?: string;
    };
    owners: string[];
};

type LogTypes = "error" | "reload" | "eval" | "other";
type LogLevel = "error" | "warn" | "info" | "debug";
type LogOptions = {
    codeblock?: string;
    footer?: string;
    author?: string;
    type?: LogTypes;
    show_full_module_paths?: boolean;
}

interface ClientEvents {
    interaction: types.Interaction;
}

const log_formats = {
    "error": { color: 0xEA2920, name: "Client Error", level: "error" },
    "warn": { color: 0xFFB300, name: "Client Warning", level: "warn" },
    "reload": { color: 0x37FB70, name: "Bot Restarted", level: "info" },
    "eval": { color: 0xFF36E1, name: "Code Evalutated", level: "info" },
    "other": { color: 0x00B5AE, name: "Other Log Message", level: "info" },
} as const;

type RouteHandlerCallback = (req: ExpressLikeRequest, res: ExpressLikeResponse) => any;

class Client extends EventEmitter {
    config: Config;
    private web_server: http.Server;
    private rest: REST;
    commands: Map<string, types.Command>;
    components: Map<string, types.Component>;
    private users: Map<string, User>;
    private guilds: Map<string, Guild>;
    private channels: Map<string, types.Channel>;
    private members: Map<string, GuildMember>;
    private snowflake_increment: number;

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
        this.web_server.listen(this.config.web_server.port, () => this.log(`Listening at port: ${this.config.web_server.port}`, "reload"));

        this.snowflake_increment = 0;
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
        if (req.method === "POST" && req.url === (this.config.web_server.interactions_endpoint ?? "/_polybot/interactions")) {
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
            };
            return;
        };
        if (!req.method) return;

        for (const [key, handler] of this.routes.entries()) {
            const [method, pattern] = key.split("__");
            if (method !== req.method.toLowerCase()) continue;

            const params = matchRoute(pattern, (req.url || "").split("?")[0]);
            if (params !== false) {
                return await handler(await attachRequestHelpers(req, params), attachResponseHelpers(res));
            }
        }
        
        if ((req.method === "GET" || req.method === "HEAD") && this.config.web_server.publicDir) return serveStatic(this.config.web_server.publicDir, req, res);

        return sendText(res, 404, "Not Found");
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

                setTimeout(() => {
                    if (!interaction.responded) this.logToConsole(`3s timeout reached for command ${interaction.command_name} with no response`, "warn");
                }, 3000);
                await command.execute(this, interaction);
            } catch (e:any) {
                const error_id = this.generateSnowflake();
                this.log(`## Command Error\nID: \`${error_id}\`\nCommand: ${interaction.command_name} ${interaction.options && interaction.options.subcommand ? `${interaction.options.group ?? ""} ${interaction.options.subcommand}` : ""}\nUser: ${interaction.user.username} (\`${interaction.user.id}\`)\nOptions: ${interaction.options.toArray().map(x => `- ${x.name}: \`${x.value}\``)}\nError:\n\`\`\`${e.toString()}\`\`\`${e.stack ? `\n\`\`\`\n${e.stack}\n\`\`\`` : ""}`, "error");
                await interaction.reply({ content: `There was an error while executing this command!\n${this.toRedCodeBlock(e.toString())}\nError ID: \`${error_id}\`` }, true);
            };
        } else if (interaction.type === types.InteractionTypes.AUTOCOMPLETE) {
            try {
                const command = this.commands.get(interaction.command_name);
                if (!command || !command.autocomplete) return await interaction.autocomplete([{ name: "No autocomplete handler has been defined", value: "__error__no_handler" }])
                if (command.staff_only && !this.config.owners.includes(interaction.user.id)) return await interaction.autocomplete([{ name: "You don't have permission to use this command!", value: "__error__no_permission" }]);

                setTimeout(() => {
                    if (!interaction.responded) this.logToConsole(`3s timeout reached for autocomplete ${interaction.command_name} with no response`, "warn");
                }, 3000);
                await command.autocomplete(this, interaction);
            } catch (e:any) {
                const error_id = this.generateSnowflake();
                this.log(`## Autocomplete Error\nID: \`${error_id}\`\nCommand: ${interaction.command_name} ${interaction.options && interaction.options.subcommand ? `${interaction.options.group ?? ""} ${interaction.options.subcommand}` : ""}\nUser: ${interaction.user.username} (\`${interaction.user.id}\`)\nOptions: ${interaction.options.toArray().map(x => `- ${x.name}: \`${x.value}\``)}\nError:\n\`\`\`${e.toString()}\`\`\`${e.stack ? `\n\`\`\`\n${e.stack}\n\`\`\`` : ""}`, "error");
                await interaction.autocomplete([{ name: `An error occurred while fetching values. ID ${error_id}`, value: `__error__${error_id}` }]);
            };
        } else if (interaction.type === types.InteractionTypes.MESSAGE_COMPONENT) {
            try {
                if (!interaction.custom_id) return await interaction.reply({ content: "Invalid component interaction" }, true);
                const custom_id = interaction.custom_id.split("__")[0];
                const component = this.components.get(custom_id);
                if (!component) return await interaction.reply({ content: `No handler found for ${custom_id}\nNote that anything after double underscores (__) is treated as a parameter and is ignored when matching custom IDs.` }, true);
                if (component.staff_only && !this.config.owners.includes(interaction.user.id)) return await interaction.reply({ content: "You don't have permission to use this component!" }, true);

                setTimeout(() => {
                    if (!interaction.responded) this.logToConsole(`3s timeout reached for command ${interaction.custom_id} with no response`, "warn");
                }, 3000);
                await component.execute(this, interaction);
            } catch (e:any) {
                const error_id = this.generateSnowflake();
                this.log(`## Component Error\nID: \`${error_id}\`\nCustom ID: ${interaction.custom_id}\nUser: ${interaction.user.username} (\`${interaction.user.id}\`)\nOptions: ${interaction.options.toArray().map(x => `- ${x.name}: \`${x.value}\``)}\nError:\n\`\`\`${e.toString()}\`\`\`${e.stack ? `\n\`\`\`\n${e.stack}\n\`\`\`` : ""}`, "error");
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

        this.logToConsole(items, details.level);
        if (this.config.logging?.webhook_url) {
            let content = options?.codeblock ? `\`\`\`${options.codeblock}\n${items}\n\`\`\`` : `${items}`;
            if (!options?.show_full_module_paths) {
                content = content.replaceAll("/usr/src/app/node_modules/", "%")
                content = content.replaceAll("    at ", "  ")
            };

            const user = await this.getUser({ user_id: this.config.application.id }).catch(() => null);
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
                        author: options?.author ? { name: options.author } : user ? { text: `${user.username}#${user.discriminator}`, icon_url: this.getUserAvatar(user.id, user.avatar) } : undefined,
                    }]
                })
            }).catch(this.logToConsole);

            if (request && !request.ok) {
                this.logToConsole(`Failed to send message to Discord Webhook (${request.status} ${request.statusText}). Response body:`, "error");
                this.logToConsole(await request.text(), "error");
            };
        };

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

    private async sendDiscordRequest<T>(method: string, url: string, body?: any, reason?: string) {
        const logToConsole = this.logToConsole;
        const headers: Record<string, string> = {
            Authorization: `Bot ${this.config.application.token}`,
            "Content-Type": "application/json"
        };
        if (reason) {
            headers["X-Audit-Log-Reason"] = reason;
        }
        const response = await this.rest.fetch(`https://discord.com/api/v10/${url}`, {
            method: method,
            headers,
            body: body && method !== "GET" ? JSON.stringify(body) : undefined
        }).catch(e => {
            this.log(`Discord API Request threw an error (${method} \`${url}\`)`, "error");
            console.log(e);
        });

        const allowed_error_codes = [404];
        if (!response) return null;
        if (response.ok) {
            return await response.json() as T;
        } else if (allowed_error_codes.includes(response.status)) {
            this.logToConsole(`Discord API Request failed ${response.status}, \`${url}\`\n${await response.text()}`, "error");
            return null;
        } else {
            const text = await response.json().then(x => JSON.stringify(x, null, 2)).catch(async() => await response.text());
            this.log(`Discord API Request failed ${response.status}, \`${url}\`\n\`\`\`\n${text}\n\`\`\``, "error");
            return null;
        };
    };

    async getUser({ user_id }: { user_id: string }) {
        const user_cache = this.users.get(user_id);
        if (user_cache) return user_cache;
        const user_data = await this.sendDiscordRequest<User>("GET", `users/${user_id}`);
        if (!user_data) return null;
        this.users.set(user_id, user_data);
        return user_data;
    };

    async getGuild({ guild_id }: { guild_id: string }) {
        const guild_cache = this.guilds.get(guild_id);
        if (guild_cache) return guild_cache;

        const guild_data = await this.sendDiscordRequest<Guild>("GET", `guilds/${guild_id}`);
        if (!guild_data) return null;
        this.guilds.set(guild_id, guild_data);
        return guild_data;
    };

    async getGuilds() {
        let guilds: Guild[] = [], first_pass = true, data: Guild[] = [];
        while (first_pass || data[199]) {
            const request = await this.sendDiscordRequest<Guild[]>("GET", `users/@me/guilds/${first_pass ? "" : `?after=${data[199].id}`}`);
            if (!request) continue;
            data = request;
            guilds = [...guilds, ...data];
            first_pass = false;
        }
        return guilds;
    };

    async getMember({ guild_id, user_id }: { guild_id: string, user_id: string }) {
        const member_cache = this.members.get(`${guild_id}_${user_id}`);
        if (member_cache) return member_cache;
        const member_data = await this.sendDiscordRequest<GuildMember>("GET", `guilds/${guild_id}/members/${user_id}`);
        if (!member_data) return null;
        this.members.set(`${guild_id}_${user_id}`, member_data);
        return member_data;
    };

    async getMembers({ guild_id }: { guild_id: string }) {
        let members: GuildMember[] = [], first_pass = true, data: GuildMember[] = [];
        while (first_pass || data[199]) {
            const request = await this.sendDiscordRequest<GuildMember[]>("GET", `guilds/${guild_id}/members${first_pass ? "" : `?after=${data[199].user.id}`}`);
            if (!request) continue;
            data = request;
            members = [...members, ...data];
            first_pass = false;
        }
        return members;
    };

    async getBans({ guild_id }: { guild_id: string }) {
        return await this.sendDiscordRequest<GuildBan[]>("GET", `guilds/${guild_id}/bans`);
    };
    async banMember({ guild_id, user_id, delete_message_days, reason }: { guild_id: string, user_id: string, delete_message_days?: number, reason?: string }) {
        return await this.sendDiscordRequest<void>("PUT", `guilds/${guild_id}/bans/${user_id}`, delete_message_days ? { delete_message_days } : undefined, reason);
    };
    async unbanMember({ guild_id, user_id, reason }: { guild_id: string, user_id: string, reason?: string }) {
        return await this.sendDiscordRequest<void>("DELETE", `guilds/${guild_id}/bans/${user_id}`, undefined, reason);
    };

    async getGuildInvites({ guild_id }: { guild_id: string }) {
        return await this.sendDiscordRequest<GuildInvite[]>("GET", `guilds/${guild_id}/invites`);
    };
    async createGuildInvite({ channel_id, max_age, max_uses, temporary, unique, reason }: { channel_id: string, max_age?: number, max_uses?: number, temporary?: boolean, unique?: boolean, reason?: string }) {
        return await this.sendDiscordRequest<GuildInvite>("POST", `channels/${channel_id}/invites`, { max_age, max_uses, temporary, unique }, reason);
    };

    async getAuditLogs({ guild_id, user_id, action_type, before, limit }: { guild_id: string, user_id?: string, action_type?: number, before?: string, limit?: number }) {
        const params = [
            user_id ? `user_id=${user_id}` : "",
            action_type ? `action_type=${action_type}` : "",
            before ? `before=${before}` : "",
            limit ? `limit=${limit}` : ""
        ].filter(Boolean).join("&");
        return await this.sendDiscordRequest<AuditLog>("GET", `guilds/${guild_id}/audit-logs${params ? "?" + params : ""}`);
    };

    async editMember({ guild_id, user_id, ...data }: { guild_id: string, user_id: string, nick?: string, roles?: string[], mute?: boolean, deaf?: boolean, channel_id?: string, communication_disabled_until?: string, reason?: string }) {
        const { reason, ...body } = data;
        return await this.sendDiscordRequest<GuildMember>("PATCH", `guilds/${guild_id}/members/${user_id}`, body, reason);
    };
    async kickMember({ guild_id, user_id, reason }: { guild_id: string, user_id: string, reason?: string }) {
        return await this.sendDiscordRequest<void>("DELETE", `guilds/${guild_id}/members/${user_id}`, undefined, reason);
    };
    async pruneMembers({ guild_id, days, compute_prune_count, include_roles, reason }: { guild_id: string, days?: number, compute_prune_count?: boolean, include_roles?: string[], reason?: string }) {
        return await this.sendDiscordRequest<{ pruned: number }>("POST", `guilds/${guild_id}/prune`, { days, compute_prune_count, include_roles }, reason);
    };

    async getRoles({ guild_id }: { guild_id: string }) {
        return await this.sendDiscordRequest<GuildRole[]>("GET", `guilds/${guild_id}/roles`);
    };

    async createRole({ name, guild_id, color, hoist, mentionable, permissions, reason }: { name: string, guild_id: string, color: number, hoist?: boolean, mentionable?: boolean, permissions?: number, reason?: string }) {
        return await this.sendDiscordRequest<GuildRole>("POST", `guilds/${guild_id}/roles`, {
            name, color, hoist, mentionable, permissions
        }, reason);
    };

    async updateRole({ role_id, guild_id, name, color, hoist, mentionable, permissions, reason }: { role_id: string, guild_id: string, name?: string, color?: number, hoist?: boolean, mentionable?: boolean, permissions?: number, reason?: string }) {
        return await this.sendDiscordRequest<GuildRole>("PATCH", `guilds/${guild_id}/roles/${role_id}`, {
            name, color, hoist, mentionable, permissions
        }, reason);
    };

    async deleteRole({ role_id, guild_id, reason }: { role_id: string, guild_id: string, reason?: string }) {
        return await this.sendDiscordRequest<GuildRole>("DELETE", `guilds/${guild_id}/roles/${role_id}`, undefined, reason);
    };

    async giveMemberRole({ role_id, guild_id, member_id, reason }: { role_id: string, guild_id: string, member_id: string, reason?: string }) {
        return await this.sendDiscordRequest<GuildRole>("PUT", `guilds/${guild_id}/members/${member_id}/roles/${role_id}`, undefined, reason);
    };

    async removeMemberRole({ role_id, guild_id, member_id, reason }: { role_id: string, guild_id: string, member_id: string, reason?: string }) {
        return await this.sendDiscordRequest<GuildRole>("DELETE", `guilds/${guild_id}/members/${member_id}/roles/${role_id}`, undefined, reason);
    };


    async getChannel({ channel_id }: { channel_id: string }) {
        const channelCache = this.channels.get(channel_id);
        if (channelCache) return channelCache;
        const channelData = await this.sendDiscordRequest<Channel>("GET", `channels/${channel_id}`);
        if (!channelData) return null;
        this.channels.set(channel_id, channelData);
        return channelData;
    };

    async getChannels({ guild_id }: { guild_id: string }) {
        return await this.sendDiscordRequest<Channel[]>("GET", `guilds/${guild_id}/channels`);
    };

    async createChannel({ name, guild_id, type, permission_overwrites, parent_id, reason }: { name: string, guild_id: string, type: ChannelTypes, permission_overwrites?: ChannelOverwrite[], parent_id?: string, reason?: string }) {
        return await this.sendDiscordRequest<Channel>("POST", `guilds/${guild_id}/channels`, {
            name, type, permission_overwrites, parent_id
        }, reason);
    };

    async updateChannel({ channel_id, name, permission_overwrites, parent_id, reason }: { channel_id: string, name?: string, permission_overwrites?: ChannelOverwrite[], parent_id?: string, reason?: string }) {
        return await this.sendDiscordRequest<Channel>("PATCH", `channels/${channel_id}`, {
            name, permission_overwrites, parent_id
        }, reason);
    };

    async deleteChannel({ channel_id, reason }: { channel_id: string, reason?: string }) {
        return await this.sendDiscordRequest<Channel>("DELETE", `channels/${channel_id}`, undefined, reason);
    };

    async followChannel({ channel_id, webhook_channel_id, reason }: { channel_id: string, webhook_channel_id: string, reason?: string }) {
        return await this.sendDiscordRequest<{ channel_id: string, webhook_id: string }>("POST", `channels/${channel_id}/followers`, { webhook_channel_id }, reason);
    };

    async updateChannelOverwrite({ channel_id, overwrite_id, type, allow, deny, reason }: { channel_id: string, overwrite_id: string, type: ChannelOverwriteTypes, allow?: number | string, deny?: number | string, reason?: string }) {
        return await this.sendDiscordRequest<Channel>("PUT", `channels/${channel_id}/permissions/${overwrite_id}`, {
            type, allow, deny
        }, reason);
    };

    async deleteChannelOverwrite({ channel_id, overwrite_id, reason }: { channel_id: string, overwrite_id: string, reason?: string }) {
        return await this.sendDiscordRequest<Channel>("DELETE", `channels/${channel_id}/permissions/${overwrite_id}`, undefined, reason);
    };


    async createThread({ name, channel_id, type, message, reason }: { name: string, channel_id: string, type: ChannelTypes.PRIVATE_THREAD | ChannelTypes.PUBLIC_THREAD | ChannelTypes.ANNOUNCEMENT_THREAD, message?: MessageBody, reason?: string }) {
        return await this.sendDiscordRequest<Channel>("POST", `channels/${channel_id}/threads`, {
            name, type, message
        }, reason);
    };

    async createThreadFromMessage({ name, channel_id, message_id, reason }: { name: string, channel_id: string, message_id: string, reason?: string }) {
        return await this.sendDiscordRequest<Channel>("POST", `channels/${channel_id}/messages/${message_id}/threads`, {
            name
        }, reason);
    };

    async updateThread({ channel_id, name, archived, locked, applied_tags, reason }: { channel_id: string, name?: string, archived?: boolean, locked?: boolean, applied_tags?: string[], reason?: string }) {
        return await this.sendDiscordRequest<Channel>("PATCH", `channels/${channel_id}`, {
            name, archived, locked, applied_tags
        }, reason);
    };

    async createMessage({ channel_id, content, embeds, components, attachments, tts }: { channel_id: string, content?: string, embeds?: EmbedBuilder[], components?: (SelectBuilder | RowBuilder)[], attachments?: MessageAttachment[], tts?: boolean }) {
        return await this.sendDiscordRequest<Message>("POST", `channels/${channel_id}/messages`, {
            content: content ?? "",
            tts: Boolean(tts),
            embeds: embeds?.map(embed => embed.toJSON()),
            components: components?.map(component => component.toJSON()),
            attachments: attachments?.length ? attachments?.map((file, i) => ({ id: `${i}`, description: file.description })) : null,
        });
    };

    async createDirectMessage({ user_id, content, embeds, components, attachments, tts }: { user_id: string, content?: string, embeds?: EmbedBuilder[], components?: (SelectBuilder | RowBuilder)[], attachments?: MessageAttachment[], tts?: boolean }) {
        const channel = await this.sendDiscordRequest<{ id: string }>("POST", `users/@me/channels`, { recipient_id: user_id });
        if (!channel) return null;
        return await this.sendDiscordRequest<Message>("POST", `channels/${channel.id}/messages`, {
            content: content ?? "",
            tts: Boolean(tts),
            embeds: embeds?.map(embed => embed.toJSON()),
            components: components?.map(component => component.toJSON()),
            attachments: attachments?.length ? attachments?.map((file, i) => ({ id: `${i}`, description: file.description })) : null,
        });
    };

    async getMessages({ channel_id, limit, around, before, after }: { channel_id: string, limit?: number, around?: string, before?: string, after?: string }) {
        const params = [
            limit ? `limit=${limit}` : "",
            around ? `around=${around}` : "",
            before ? `before=${before}` : "",
            after ? `after=${after}` : ""
        ].filter(Boolean).join("&");
        return await this.sendDiscordRequest<Message[]>("GET", `channels/${channel_id}/messages${params ? "?" + params : ""}`);
    };
    async getMessage({ channel_id, message_id }: { channel_id: string, message_id: string }) {
        return await this.sendDiscordRequest<Message>("GET", `channels/${channel_id}/messages/${message_id}`);
    };
    async deleteMessage({ channel_id, message_id, reason }: { channel_id: string, message_id: string, reason?: string }) {
        return await this.sendDiscordRequest<void>("DELETE", `channels/${channel_id}/messages/${message_id}`, undefined, reason);
    };
    async editMessage({ channel_id, message_id, content, embeds, components, reason }: { channel_id: string, message_id: string, content?: string, embeds?: EmbedBuilder[], components?: (SelectBuilder | RowBuilder)[], reason?: string }) {
        const body: any = {};
        if (content !== undefined) body.content = content;
        if (embeds !== undefined) body.embeds = embeds.map(e => e.toJSON());
        if (components !== undefined) body.components = components.map(c => c.toJSON());
        return await this.sendDiscordRequest<Message>("PATCH", `channels/${channel_id}/messages/${message_id}`, body, reason);
    };

    async addReaction({ channel_id, message_id, emoji }: { channel_id: string, message_id: string, emoji: string }) {
        return await this.sendDiscordRequest<void>("PUT", `channels/${channel_id}/messages/${message_id}/reactions/${encodeURIComponent(emoji)}/@me`);
    };
    async removeReaction({ channel_id, message_id, emoji }: { channel_id: string, message_id: string, emoji: string }) {
        return await this.sendDiscordRequest<void>("DELETE", `channels/${channel_id}/messages/${message_id}/reactions/${encodeURIComponent(emoji)}/@me`);
    };
    async crosspostMessage({ channel_id, message_id }: { channel_id: string, message_id: string }) {
        return await this.sendDiscordRequest<Message>("POST", `channels/${channel_id}/messages/${message_id}/crosspost`);
    };

    async getEmojis({ guild_id }: { guild_id: string }) {
        return await this.sendDiscordRequest<Emoji[]>("GET", `guilds/${guild_id}/emojis`);
    };
    async createEmoji({ guild_id, name, image, roles, reason }: { guild_id: string, name: string, image: string, roles?: string[], reason?: string }) {
        return await this.sendDiscordRequest<Emoji>("POST", `guilds/${guild_id}/emojis`, { name, image, roles }, reason);
    };
    async editEmoji({ guild_id, emoji_id, name, roles, reason }: { guild_id: string, emoji_id: string, name?: string, roles?: string[], reason?: string }) {
        return await this.sendDiscordRequest<Emoji>("PATCH", `guilds/${guild_id}/emojis/${emoji_id}`, { name, roles }, reason);
    };
    async deleteEmoji({ guild_id, emoji_id, reason }: { guild_id: string, emoji_id: string, reason?: string }) {
        return await this.sendDiscordRequest<void>("DELETE", `guilds/${guild_id}/emojis/${emoji_id}`, undefined, reason);
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
        const unix_time = (BigInt(snowflake) >> BigInt(22)) + BigInt(1420070400000);
        return new Date(Number(unix_time));
    };
    generateSnowflake() {
        const discord_epoch = 1420070400000n;
        const timestamp = BigInt(Date.now() - Number(discord_epoch));
        const worker_id = BigInt(this.config.application.id) % BigInt(1024);
        const increment = BigInt(this.snowflake_increment++ & 0xFFF); // 12 bits

        const snowflake = (timestamp << 22n) | (worker_id << 12n) | increment;

        if (this.snowflake_increment >= 4096) this.snowflake_increment = 0; // wrap after 4096

        return snowflake.toString();
    };
};

export { Client };