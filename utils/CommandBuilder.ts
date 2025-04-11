import { ChannelTypes } from "../types";

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

export type CommandData = {
    type?: CommandTypes;
    name?: string;
    name_localizations?: {[key:string]:string};
    description?: string;
    description_localizations?: {[key:string]:string};
    options?: OptionBuilder[];
    integration_types?: IntegrationTypes[];
}

class CommandBuilder {
    data: CommandData;
    
    constructor(command?:CommandData|CommandTypes) {
        if (typeof command === "number") {
            this.data = {type: command, integration_types: [0]};
        } else {
            this.data = command ?? {integration_types: [0]};
        }
    };
    setName(name:string) {
        this.data.name = name;
        return this;
    };
    setNameLocalizations(localizations:{[key:string]:string}) {
        this.data.name_localizations = localizations;
        return this;
    };
    setDescription(description:string) {
        this.data.description = description;
        return this;
    };
    setDescriptionLocalizations(localizations:{[key:string]:string}) {
        this.data.description_localizations = localizations;
        return this;
    };
    setType(type:CommandTypes) {
        this.data.type = type;
        return this;
    };
    setIntegrationTypes(...args:IntegrationTypes[]) {
        this.data.integration_types = args
        return this;
    };
    addOptions(options:OptionBuilder[]|OptionBuilder) {
        this.data.options = this.data.options ?? [];
        if (Array.isArray(options)) {
            this.data.options = [...this.data.options, ...options];
        } else {
            this.data.options.push(options);
        };
        return this;
    };
    toJSON() {
        return this.data;
    };
    toString() {
        return JSON.stringify(this.data, null, 2);
    };
};

export type OptionData = OptionNumber | OptionString | OptionGroup | OptionSubcommand | OptionChannel | OptionGeneric;
type BaseOption = {
    // type?: OptionTypes;
    name?: string;
    name_localizations?: {[key:string]:string};
    description?: string;
    description_localizations?: {[key:string]:string};
    required?: boolean;
}
type OptionGeneric = BaseOption & {
    type?: Exclude<OptionTypes, OptionTypes.SUB_COMMAND_GROUP | OptionTypes.SUB_COMMAND | OptionTypes.CHANNEL | OptionTypes.STRING | OptionTypes.NUMBER | OptionTypes.INTEGER>;
};
type OptionNumber = BaseOption & {
    type: OptionTypes.NUMBER | OptionTypes.INTEGER;
    min_value?: number;
    max_value?: number; 
    autocomplete?: boolean;
    choices?: OptionChoice<number>[];
};
type OptionString = BaseOption & {
    type: OptionTypes.STRING;
    min_length?: number;
    max_length?: number; 
    autocomplete?: boolean;
    choices?: OptionChoice<string>[];
};
type OptionChannel = BaseOption & {
    type: OptionTypes.CHANNEL;
    channel_types?: ChannelTypes[];
    autocomplete?: boolean;
};
type OptionGroup = Omit<BaseOption, "required"> & {
    type: OptionTypes.SUB_COMMAND_GROUP;
    options: OptionSubcommand[];
};
type OptionSubcommand = Omit<BaseOption, "required"> & {
    type: OptionTypes.SUB_COMMAND;
    options: Exclude<OptionData, OptionSubcommand | OptionGroup>[];
};

type OptionChoice<T> = {
    name: string;
    name_localizations?: {[key:string]:string};
    value: T;
}

export enum OptionTypes {
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

class OptionBuilder {
    data: OptionData;

    constructor(option?:OptionData|OptionTypes) {
        if (typeof option === "number") {
            /* @ts-ignore */
            this.data = {type: option};
        } else {
            this.data = option ?? {};
        }
    };
    setName(name:string) {
        this.data.name = name;
        return this;
    };
    setNameLocalizations(localizations:{[key:string]:string}) {
        this.data.name_localizations = localizations;
        return this;
    };
    setDescription(description:string) {
        this.data.description = description;
        return this;
    };
    setDescriptionLocalizations(localizations:{[key:string]:string}) {
        this.data.description_localizations = localizations;
        return this;
    };
    setType(type:OptionTypes) {
        this.data.type = type;
        return this;
    };
    setRequired(required:boolean) {
        if (this.data.type === OptionTypes.SUB_COMMAND_GROUP || this.data.type === OptionTypes.SUB_COMMAND) return this;
        this.data.required = required;
        return this;
    };
    setMin(value:number) {
        if (this.data.type === OptionTypes.STRING) this.data.min_length = value;
        if (this.data.type === OptionTypes.NUMBER || this.data.type === OptionTypes.INTEGER) this.data.min_value = value;
        return this;
    };
    setMax(value:number) {
        if (this.data.type === OptionTypes.STRING) this.data.max_length = value;
        if (this.data.type === OptionTypes.NUMBER || this.data.type === OptionTypes.INTEGER) this.data.max_value = value;
        return this;
    };
    setAutocomplete(autocomplete:boolean) {
        if (this.data.type === OptionTypes.STRING || this.data.type === OptionTypes.NUMBER || this.data.type === OptionTypes.INTEGER) this.data.autocomplete = autocomplete;
        return this;
    };
    setChannelTypes(channel_types:ChannelTypes[]) {
        if (this.data.type !== OptionTypes.CHANNEL) return this;
        this.data.channel_types = channel_types;
        return this;
    };

    addChoices(choices:OptionChoice<string|number>[]|OptionChoice<string|number>) {
        if (this.data.type !== OptionTypes.STRING && this.data.type !== OptionTypes.NUMBER && this.data.type !== OptionTypes.INTEGER) return this;
        this.data.choices = this.data.choices ?? [];
        if (Array.isArray(choices)) {
            /* @ts-ignore */
            this.data.choices = [...this.data.choices, ...choices];
        } else {
            /* @ts-ignore */
            this.data.choices.push(choices);
        };
        return this;
    };

    addOptions(options:OptionBuilder[]|OptionBuilder) {
        if (this.data.type !== OptionTypes.SUB_COMMAND_GROUP && this.data.type !== OptionTypes.SUB_COMMAND) return this;
        this.data.options = this.data.options ?? [];
        if (Array.isArray(options)) {
            /* @ts-ignore */
            this.data.options = [...this.data.options, ...options.map(x => x.toJSON())];
        } else {
            /* @ts-ignore */
            this.data.options.push(options.toJSON());
        };
        return this;
    };

    toJSON() {
        return this.data;
    };

    toString() {
        return JSON.stringify(this.data, null, 2);
    };
};

export { CommandBuilder, OptionBuilder };
