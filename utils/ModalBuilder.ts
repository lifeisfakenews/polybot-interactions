export type ModalData = {
    title?: string;
    custom_id?: string;
    components: {
        type: 1;
        components: [TextInputData];
    }[];
}

class ModalBuilder {
    data: ModalData;

    constructor(modal?:ModalData|string) {
        this.data = typeof modal == "string" ? {custom_id: modal, components: []} : modal ?? {components: []};
    };
    setTitle(title:string) {
        this.data.title = title;
        return this;
    };
    setCustomId(id:string) {
        this.data.custom_id = id;
        return this;
    };
    addComponents(components:TextInputBuilder[]|TextInputBuilder) {
        if(Array.isArray(components)) {
            /* @ts-ignore */
            this.data.components = [...this.data.components, ...components.map(x => ({type: 1, components: [x.toJSON()]}))];
        } else {
            this.data.components.push({type: 1, components: [components.toJSON()]});
        }
        return this;
    };
    toJSON() {
        return this.data;
    };
    toString() {
        return JSON.stringify(this.data, null, 2);
    };
}

export enum TextInputStyles {
    "SHORT" = 1,
    "PARAGRAPH" = 2,
    "LONG" = 3,
}

export type TextInputData = {
    type: 4;
    label?: string;
    required?: boolean;
    custom_id?: string;
    placeholder?: string;
    style?: TextInputStyles;
    min_length?: number;
    max_length?: number;
    value?: string;
}

class TextInputBuilder {
    data: TextInputData;

    constructor(input?:TextInputData|string|TextInputStyles) {
        this.data = typeof input == "string" ? {custom_id: input, type: 4, style: TextInputStyles.SHORT} : typeof input == "number" ? {type: 4, style: input} : input ?? {type: 4, style: TextInputStyles.SHORT};
    };
    setLabel(title:string) {
        this.data.label = title;
        return this;
    };
    setRequired(required:boolean) {
        this.data.required = required;
        return this;
    };
    setCustomId(id:string) {
        this.data.custom_id = id;
        return this;
    };
    setPlaceholder(placeholder:string) {
        this.data.placeholder = placeholder;
        return this;
    };
    setStyle(style:TextInputStyles) {
        this.data.style = style;
        return this;
    };
    setMaxLength(max_length:number) {
        this.data.max_length = max_length;
        return this;
    };
    setMinLength(min_length:number) {
        this.data.min_length = min_length;
        return this;
    };
    setValue(value:string) {
        this.data.value = value;
        return this;
    };
    toJSON() {
        return this.data;
    };
    toString() {
        return JSON.stringify(this.data, null, 2);
    };
}

export { ModalBuilder, TextInputBuilder };