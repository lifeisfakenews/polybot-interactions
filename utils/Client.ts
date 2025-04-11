import { readdirSync } from "node:fs";
import { EventEmitter } from "node:events";
import cookieparser from "cookie-parser";
import express from "express";
import nacl from "tweetnacl";
import { join } from "path";

import { RowBuilder, SelectBuilder, EmbedBuilder } from "./";

import type * as types from "../types";

import { Interaction, REST } from ".";

import config from "../config.json";

type MessageBody = {
    content?: string;
    tts?: boolean;
    embeds?: EmbedBuilder[];
    components?: (RowBuilder|SelectBuilder)[];
    attachments?: types.MessageAttachment[];
    flags?: number | null;
}

// export type Config = {
//     token: string;
//     id: string;
//     port: number;
//     public_key: string;
//     mongodb: string;
//     embedColor: string;
//     webhook: string;
//     owners: string[];

//     [key: string]: any;
// }

type LogTypes = "error" | "reload" | "eval" | "other";
type LogOptions = {
    cb?: string;
    footer?: string;
    author?: string;
    type?: LogTypes;
}

interface ClientEvents {
    interaction: Interaction;
}

class Client extends EventEmitter {
    config: typeof config;
    commands_folder?: string;
    components_folder?: string;
    web_server: express.Express;
    rest: REST;
    commands: Map<string, types.ExportedCommand>;
    components: Map<string, types.ExportedComponent>;
    users: Map<string, types.User>;
    guilds: Map<string, types.Guild>;
    channels: Map<string, types.Channel>;
    members: Map<string, types.GuildMember>;
    user: Promise<types.User>;
    ;
    constructor(given_config:(typeof config), options:{commands_folder?:string, components_folder?:string}) {
        super();

        this.config = given_config;
        this.commands_folder = options.commands_folder;
        this.components_folder = options.components_folder;
        this.web_server = express();
        this.rest = new REST(this.config.token);
        this.commands = new Map();
        this.components = new Map();
        this.users = new Map();
        this.guilds = new Map();
        this.channels = new Map();
        this.members = new Map();
        this.user = this.getUser(this.config.id) as Promise<types.User>;

        this.web_server.use((req, res, next) => {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "*");
            res.header("Access-Control-Allow-Methods", "*");
            res.header("Access-Control-Allow-Credentials", "true");
            next();
        });

        this.web_server.use(express.text(), express.json(), express.urlencoded(), cookieparser());
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
        const log_formats = {
            "error": { color: 0xEA2920, name: "Client Error" },
            "reload": { color: 0x37FB70, name: "Bot Restarted" },
            "eval": { color: 0xFF36E1, name: "Code Evalutated" },
            "other": { color: 0x00B5AE, name: "Other Log Message" },
        }
        const webhook_data = log_formats[options?.type ?? "other"] ?? log_formats.other;
        let content = options?.cb ? `\`\`\`${options.cb}\n${items}\n\`\`\`` : `${items}`;
        content = content.replaceAll("/usr/src/app/node_modules/", "@")
        content = content.replaceAll("    at ", "  ")
        const request = await fetch(this.config.webhook, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: webhook_data.name,
                avatar_url: `https://resources.votemanager.xyz/assets/logs/${options?.type ?? "other"}.png`,
                embeds: [{
                    color: webhook_data.color,
                    description: `${content.length > 2000 ? content.slice(0, 1950) + `\n+${content.length - 1950} more characters` : content}`,
                    footer: options?.footer ? { text: options.footer } : undefined,
                    author: options?.author ? { name: options.author } : undefined,
                }]
            })
        }).catch(console.log);
        console.log(new Date().toISOString());
        console.log(items);

        if (!request || !request.ok) {
            if (request) {
                console.log(`SENDING LOG MESSAGE TO DISCORD FAILED: ${request.status} ${request.statusText}`);
                console.log(`DISCORD REPSONSE BODY:\n${await request.text()}`);
            }
            console.log(`ORIGINAL LOG MESSAGE:\n${items}`);
        };
        console.log("--------------------------------------------------------------------------------");
    };

    async getUser(userId:string) {
        const userCache = this.users.get(userId);
        if (userCache) return userCache;
        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/users/${userId}`, {
            method: "GET",
            headers: {
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                    Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                    Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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
                Authorization: `Bot ${this.config.token}`,
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

        const log = this.log;
        const response = await this.rest.fetch(`https://discord.com/api/v10/applications/${this.config.id}/commands`, {
            method: "PUT",
            headers: {
                Authorization: `Bot ${this.config.token}`,
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

    toRedCodeBlock(text:string) {
        return `\`\`\`ansi\n\u001b[1;31m${text}\n\`\`\``;
    };

    async initialize() {
        if (this.commands_folder) {
            const commandFiles = readdirSync(this.commands_folder).filter(file => file.endsWith(".js") || file.endsWith(".ts"));
    
            for (const path of commandFiles) {
                try {
                    const pathname = join(this.commands_folder, path);
                    const module = await import(pathname);
                    const command = module.default;
                    this.commands.set(command.command.data.name, command);
                } catch (error:any) {
                    this.log(`Error loading command file \`${path}\`: \`${error}\``, "error");
                }
            };
        }

        if (this.components_folder) {
            const componentFiles = readdirSync(this.components_folder).filter(file => file.endsWith(".js") || file.endsWith(".ts"));
    
            for (const path of componentFiles) {
                try {
                    const pathname = join(this.components_folder, path);
                    const module = await import(pathname);
                    const component = module.default;
                    this.components.set(component.custom_id, component);
                } catch (error:any) {
                    this.log(`Error loading component file \`${path}\`: \`${error}\``, "error");
                }
            };
        };

        this.registerCommands();

        this.web_server.listen(this.config.port, () => this.log(`Listening at port: ${this.config.port}`, "reload"));

        // await mongoose.connect(this.config.mongodb, { autoIndex: true }).then(() => { this.log("MongoDB Connected!", "reload") });
        /* @ts-ignore */
        this.web_server.post("/api/interactions", async(req, res) => {
            const signature = req.get("X-Signature-Ed25519")!;
            const timestamp = req.get("X-Signature-Timestamp")!;
            /* @ts-ignore */
            const isVerified = nacl.sign.detached.verify(Buffer.from(`${timestamp}${JSON.stringify(req.body)}`), Buffer.from(signature, "hex"), Buffer.from(this.config.public_key, "hex"));
            if (!isVerified) return res.status(401).end("invalid request signature");
            if (req.body.type === 1) return res.status(200).send({ type: 1 });

            const interaction = new Interaction(req, res, this);
            this.emit("interaction", interaction);
        });
        return true;
    };
};

export { Client };