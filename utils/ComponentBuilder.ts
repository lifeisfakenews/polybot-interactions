import type { ChannelTypes, MessageComponentEmoji } from "../types";


export type RowData = {
    type: 1;
    components: ButtonData[];
}

class RowBuilder {
    data: RowData;

    constructor(data?:RowData) {
        this.data = data ?? {type: 1, components: []};
    };
    addComponents(components:ButtonBuilder|ButtonBuilder[]) {
        if(Array.isArray(components)){
            this.data.components = [...this.data.components, ...components.map((x)=>x.toJSON())];
        } else {
            this.data.components.push(components.toJSON());
        }
        return this;
    };
    toJSON() {
        return this.data;
    };
    toString() {
        return JSON.stringify(this.data, null, 2);
    }
};

export enum ButtonStyles {
    "PRIMARY" = 1,
    "SECONDARY" = 2,
    "SUCCESS" = 3,
    "DANGER" = 4,
    "LINK" = 5
}

export type ButtonData = {
    type: 2;
    label?: string;
    custom_id?: string;
    style?: ButtonStyles;
    emoji?: MessageComponentEmoji;
    url?: string;
    disabled?: boolean;
}

class ButtonBuilder {
    data: ButtonData;

    constructor(button?:ButtonData|ButtonStyles|string) {
        this.data = typeof button == "string" ? {custom_id: button, type: 2} : typeof button == "number" ? {type: 2, style: button} : button ?? {type: 2, style: ButtonStyles.SECONDARY};
    }
    setLabel(title:string) {
        this.data.label = title;
        return this;
    };
    setCustomId(id:string) {
        this.data.custom_id = id;
        return this;
    };
    setStyle(style:ButtonStyles) {
        this.data.style = style;
        return this;
    };
    setUrl(url:string) {
        this.data.url = url;
        return this;
    };
    setDisabled(disabled:boolean) {
        this.data.disabled = disabled;
        return this;
    };
    setEmoji(emoji:MessageComponentEmoji) {
        this.data.emoji = emoji;
        return this;
    };
    toJSON() {
        return this.data;
    };
    toString() {
        return JSON.stringify(this.data, null, 2);
    };
}

export enum SelectTypes {
    "TEXT" = 3,
    "USER" = 5,
    "ROLE" = 6,
    "MENTIONABLE" = 7,
    "CHANNEL" = 8
};
export enum SelectDefaultTypes {
    "USER" = "user",
    "ROLE" = "role",
    "CHANNEL" = "channel"
}

type SelectOption = {
    label: string;
    value: string;
    description?: string;
    emoji?: MessageComponentEmoji;
    default?: boolean;
}
type SelectDefault = {
    id: string;
    type: SelectDefaultTypes;
}

export type SelectData = {
    type?: SelectTypes;
    custom_id?: string;
    options?: SelectOption[];
    channel_types?: ChannelTypes[];
    placeholder?: string;
    default_values?: SelectDefault[];
    min_values?: number;
    max_values?: number;
    disabled?: boolean;
}


class SelectBuilder {
    data: SelectData;

    constructor(select?:SelectData|string|SelectTypes) {
        this.data = typeof select == "string" ? {custom_id: select, type: SelectTypes.TEXT} : typeof select == "number" ? {type: select} : select ?? {type: SelectTypes.TEXT};
    }
    setType(type:SelectTypes) {
        this.data.type = type;
        return this;
    };
    setCustomId(id:string) {
        this.data.custom_id = id;
        return this;
    };
    addOptions(options:SelectOption[]|SelectOption) {
        this.data.type = SelectTypes.TEXT;
        this.data.options = this.data.options ?? [];
        if (Array.isArray(options)) {
            this.data.options = [...this.data.options, ...options];
        } else {
            this.data.options.push(options);
        };
        return this;
    };
    setChannelTypes(channel_types:ChannelTypes[]) {
        this.data.channel_types = channel_types;
        return this;
    };
    setPlaceholder(placeholder:string) {
        this.data.placeholder = placeholder;
        return this;
    };
    addDefaultValues(values:SelectDefault[]|SelectDefault) {
        this.data.default_values = this.data.default_values ?? [];
        if (Array.isArray(values)) {
            this.data.default_values = [...this.data.default_values, ...values];
        } else {
            this.data.default_values.push(values);
        };
        return this;
    };
    setMin(min:number) {
        this.data.min_values = min;
        return this;
    };
    setMax(max:number) {
        this.data.max_values = max;
        return this;
    };
    setDisabled(disabled:boolean) {
        this.data.disabled = disabled;
        return this;
    };
    toJSON() {
        // if (this.data.type == SelectTypes.TEXT && !this.data.options?.length) return {};
        return {
            type: 1,
            components: [this.data]
        };
    };
    toString() {
        return JSON.stringify(this.data, null, 2);
    };
}

export { RowBuilder, SelectBuilder, ButtonBuilder };