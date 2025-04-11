import tinycolor from "tinycolor2";

type EmbedField = {
    name: string;
    value: string;
    inline?: boolean;
}

export type EmbedData = {
    title?: string;
    description?: string;
    color?: tinycolor.ColorInput | number;
    footer?: {
        text: string;
        icon_url?: string;
    };
    author?: {
        name: string;
        url?: string;
        icon_url?: string;
    };
    url?: string;
    image?: {
        url: string;
    };
    thumbnail?: {
        url: string;
    };
    timestamp?: string;
    fields: EmbedField[];
}

class EmbedBuilder {
    data: EmbedData;

    constructor(embed?:EmbedData) {
        this.data = {fields: []};
        if (embed) {
            for (const field in embed) {
                /* @ts-ignore */
                if (!embed[field]) continue;
                if (field === "thumbnail" || field === "image") {
                    this.data[field] = typeof embed[field] === "string" ? { url: embed[field] } : embed[field];
                } else if (field == "color") {
                    this.setColor(embed[field] as tinycolor.ColorInput);
                } else {
                    /* @ts-ignore */
                    this.data[field] = embed[field];
                };
            };
        };
    };
    setTitle(title:string) {
        this.data.title = title;
        return this;
    }
    setDescription(description:string) {
        this.data.description = description;
        return this;
    }
    setColor(color:tinycolor.ColorInput) {
        const realColor = tinycolor(color);
        if (realColor.isValid()) {
            this.data.color = parseInt(realColor.toHex(), 16);
        };
        return this;
    }
    setFooter(footer:EmbedData["footer"]) {
        this.data.footer = footer;
        return this;
    }
    setAuthor(author:EmbedData["author"]) {
        this.data.author = author;
        return this;
    }
    setUrl(url:string) {
        this.data.url = url;
        return this;
    }
    setImage(image:string) {
        this.data.image = { url: image };
        return this;
    }
    setThumbnail(thumbnail:string) {
        this.data.thumbnail = { url: thumbnail };
        return this;
    }
    setTimestamp(date:string | Date) {
        date = new Date(date);
        /* @ts-ignore */
        this.data.timestamp =  date && date != "Invalid Date" ? date.toISOString() : undefined;
        return this;
    }
    addFields(data:EmbedField[]|EmbedField) {
        if (Array.isArray(data)) {
            this.data.fields = [...this.data.fields, ...data];
        } else {
            this.data.fields.push(data);
        };
        return this;
    }
    toJSON() {
        return this.data;
    }

    toString() {
        return JSON.stringify(this.data, null, 2);
    }
}

export { EmbedBuilder };