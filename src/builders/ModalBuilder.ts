import { ModalTextInputStyles, MessageComponentTypes } from "../types";
import { type SelectData, SelectBuilder } from "./ComponentBuilder";

type ModalRowComponent = TextInputBuilder | SelectBuilder;
type ModalRowData = ReturnType<ModalRowComponent["toJSON"]>;

export type ModalData = {
    title?: string;
    custom_id?: string;
    components: {
        type: MessageComponentTypes.ACTION_ROW;
        components: [ModalRowData];
    }[];
};

class ModalBuilder {
    data: ModalData;
    v2_enabled: boolean;

    constructor(modal?: ModalData | string) {
        this.data =
            typeof modal == "string"
                ? { custom_id: modal, components: [] }
                : modal ?? { components: [] };
        this.v2_enabled = false;
    }

    setTitle(title: string) {
        this.data.title = title;
        return this;
    }

    setCustomId(id: string) {
        this.data.custom_id = id;
        return this;
    }

    setV2(enabled: boolean) {
        this.v2_enabled = enabled;
        return this;
    }

    addComponents(components: ModalRowComponent | ModalRowComponent[]) {
        const array = Array.isArray(components) ? components : [components];
        for (const c of array) {
            this.data.components.push({
                type: MessageComponentTypes.ACTION_ROW,
                components: [c.toJSON(true)]
            });
        }
        return this;
    }

    toJSON() {
        if (!this.v2_enabled) return this.data;

        const flattened_components = [];

        for (const row of this.data.components) {
            for (const comp of row.components) {
                if (comp.type == MessageComponentTypes.ACTION_ROW) {
                    const component = comp.components[0];
                    const label_text = component.label ?? component.custom_id;
                    delete component.label;
                    flattened_components.push({
                        type: MessageComponentTypes.LABEL,
                        label: label_text,
                        component: component
                    });
                } else {
                    const label_text = comp.label ?? comp.custom_id;
                    delete comp.label;
                    flattened_components.push({
                        type: MessageComponentTypes.LABEL,
                        label: label_text,
                        component: comp
                    });
                };
            };
        };

        return {
            title: this.data.title,
            custom_id: this.data.custom_id,
            components: flattened_components
        };
    }

    toString() {
        return JSON.stringify(this.toJSON(), null, 2);
    }
}

export type TextInputData = {
    type: MessageComponentTypes.TEXT_INPUT;
    label?: string;
    required?: boolean;
    custom_id?: string;
    placeholder?: string;
    style?: ModalTextInputStyles;
    min_length?: number;
    max_length?: number;
    value?: string;
};

class TextInputBuilder {
    data: TextInputData;

    constructor(input?: TextInputData | string | ModalTextInputStyles) {
        this.data =
            typeof input == "string"
                ? { custom_id: input, type: 4, style: ModalTextInputStyles.SHORT }
                : typeof input == "number"
                ? { type: 4, style: input }
                : input ?? { type: 4, style: ModalTextInputStyles.SHORT };
    }

    setLabel(title: string) {
        this.data.label = title;
        return this;
    }

    setRequired(required: boolean) {
        this.data.required = required;
        return this;
    }

    setCustomId(id: string) {
        this.data.custom_id = id;
        return this;
    }

    setPlaceholder(placeholder: string) {
        this.data.placeholder = placeholder;
        return this;
    }

    setStyle(style: ModalTextInputStyles) {
        this.data.style = style;
        return this;
    }

    setMaxLength(max_length: number) {
        this.data.max_length = max_length;
        return this;
    }

    setMinLength(min_length: number) {
        this.data.min_length = min_length;
        return this;
    }

    setValue(value: string) {
        this.data.value = value;
        return this;
    }

    toJSON() {
        return this.data;
    }

    toString() {
        return JSON.stringify(this.data, null, 2);
    }
}

export { ModalBuilder, TextInputBuilder };