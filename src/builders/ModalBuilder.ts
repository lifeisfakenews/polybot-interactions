import { ModalComponentTypes } from "../types";
import { SelectBuilder } from "./ComponentBuilder";

type LabelChildComponent = SelectBuilder | TextInputBuilder | FileUploadBuilder | RadioGroupBuilder | CheckboxGroupBuilder | CheckboxBuilder;

class LabelBuilder {
    label: string;
    id?: string;
    component?: LabelChildComponent;

    constructor(label: string) {
        this.label = label;
    };

    setLabel(label: string) {
        this.label = label;
        return this;
    }

    setId(id: string) {
        this.id = id;
        return this;
    }

    setComponent(component: LabelChildComponent) {
        this.component = component;
        return this;
    }

    toJSON() {
        if (!this.component) throw new Error("Cannot convert Label to JSON without a component");
        return {
            type: ModalComponentTypes.LABEL,
            label: this.label,
            id: this.id,
            component: this.component.toJSON()
        };
    };

    toString() {
        return JSON.stringify({ type: ModalComponentTypes.LABEL, label: this.label, id: this.id, component: this.component?.toJSON() }, null, 2);
    }
};

class ModalBuilder {
    title?: string;
    custom_id?: string;
    components: LabelBuilder[];

    constructor(custom_id?: string) {
        this.custom_id = custom_id;
        this.components = [];
    }

    setTitle(title: string) {
        this.title = title;
        return this;
    }

    setCustomId(id: string) {
        this.custom_id = id;
        return this;
    }

    addComponents(components: LabelBuilder | LabelBuilder[]) {
        const array = Array.isArray(components) ? components : [components];
        this.components.push(...array);
        return this;
    }

    toJSON() {
        return {
            title: this.title,
            custom_id: this.custom_id,
            /** @ts-ignore */
            components: this.components.map(c => c.toJSON(true))
        };
    };

    toString() {
        return JSON.stringify(this.toJSON(), null, 2);
    };
};

export enum TextInputStyles {
    "SHORT" = 1,
    "PARAGRAPH" = 2,
}

class TextInputBuilder {
    custom_id: string;
    style: TextInputStyles;
    min_length?: number;
    max_length?: number;
    required?: boolean;
    value?: string;
    placeholder?: string;

    constructor(custom_id: string, style?: TextInputStyles) {
        this.custom_id = custom_id;
        this.style = style ?? TextInputStyles.SHORT;
    }

    setRequired(required: boolean) {
        this.required = required;
        return this;
    }

    setCustomId(id: string) {
        this.custom_id = id;
        return this;
    }

    /**
     * Max length of 100 characters
     */
    setPlaceholder(placeholder: string) {
        this.placeholder = placeholder.slice(0, 100);
        return this;
    }

    setStyle(style: TextInputStyles) {
        this.style = style;
        return this;
    }

    /**
     * Max 4000 characters
     */
    setMaxLength(max_length: number) {
        this.max_length = Math.min(max_length, 4000);
        return this;
    }

    /**
     * Min 1, max 4000
     */
    setMinLength(min_length: number) {
        this.min_length = Math.min(min_length, 4000);
        return this;
    }

    /**
     * Max length of 4000 characters
     */
    setValue(value: string) {
        this.value = value.slice(0, 4000);
        return this;
    }

    toJSON() {
        return {
            type: ModalComponentTypes.TEXT_INPUT,
            custom_id: this.custom_id,
            style: this.style,
            min_length: this.min_length,
            max_length: this.max_length,
            required: this.required,
            value: this.value,
            placeholder: this.placeholder
        };
    };

    toString() {
        return JSON.stringify(this.toJSON(), null, 2);
    };
};

class FileUploadBuilder {
    custom_id: string;
    min_values?: number;
    max_values?: number;
    required?: boolean;

    constructor(custom_id: string) {
        this.custom_id = custom_id;
    }

    /**
     * Max 10 files
     */
    setMin(min: number) {
        this.min_values = Math.min(min, 10);
        return this;
    }

    /**
     * Max 10 files
     */
    setMax(max: number) {
        this.max_values = Math.min(max, 10);
        return this;
    }

    setRequired(required: boolean) {
        this.required = required;
        if (this.required && this.min_values && this.min_values < 1) this.min_values = 1;
        return this;
    }

    toJSON() {
        return {
            type: ModalComponentTypes.FILE_UPLOAD,
            custom_id: this.custom_id,
            min_values: this.min_values,
            max_values: this.max_values,
            required: this.required
        };
    };

    toString() {
        return JSON.stringify(this.toJSON(), null, 2);
    };
};

class RadioGroupBuilder {
    custom_id: string;
    options: { label: string; value: string; description?: string; default?: boolean }[];
    required?: boolean;

    constructor(custom_id: string) {
        this.custom_id = custom_id;
        this.options = [];
    }

    addOptions(options: { label: string; value: string; description?: string; default?: boolean }[]) {
        this.options.push(...options);
        return this;
    }

    setRequired(required: boolean) {
        this.required = required;
        return this;
    }

    toJSON() {
        if (this.options.length < 2) throw new Error("Radio group must have at least 2 options");
        if (this.options.length > 10) throw new Error("Radio group must have at most 10 options");
        return {
            type: ModalComponentTypes.RADIO_GROUP,
            custom_id: this.custom_id,
            options: this.options,
            required: this.required
        };
    };

    toString() {
        return JSON.stringify({ type: ModalComponentTypes.RADIO_GROUP, custom_id: this.custom_id, options: this.options, required: this.required }, null, 2);
    };
};

class CheckboxGroupBuilder {
    custom_id: string;
    options: { label: string; value: string; description?: string; default?: boolean }[];
    min_values?: number;
    max_values?: number;
    required?: boolean;

    constructor(custom_id: string) {
        this.custom_id = custom_id;
        this.options = [];
    }

    addOptions(options: { label: string; value: string; description?: string; default?: boolean }[]) {
        this.options.push(...options);
        return this;
    }

    /**
     * Max 10 options
     */
    setMin(min: number) {
        this.min_values = Math.min(min, 10);
        return this;
    }

    /**
     * Max 10 options, min 1 option
     */
    setMax(max: number) {
        this.max_values = Math.min(max, 10);
        return this;
    }

    setRequired(required: boolean) {
        this.required = required;
        if (this.required && this.min_values && this.min_values < 1) this.min_values = 1;
        return this;
    }

    toJSON() {
        if (this.options.length < 1) throw new Error("Checkbox group must have at least 1 options");
        if (this.options.length > 10) throw new Error("Checkbox group must have at most 10 options");
        return {
            type: ModalComponentTypes.CHECKBOX_GROUP,
            custom_id: this.custom_id,
            options: this.options,
            min_values: this.min_values,
            max_values: this.max_values,
            required: this.required
        };
    };

    toString() {
        return JSON.stringify({ type: ModalComponentTypes.CHECKBOX_GROUP, custom_id: this.custom_id, options: this.options, min_values: this.min_values, max_values: this.max_values, required: this.required }, null, 2);
    };
};

class CheckboxBuilder {
    custom_id: string;
    default?: boolean;

    constructor(custom_id: string) {
        this.custom_id = custom_id;
    }

    setDefault(default_: boolean) {
        this.default = default_;
        return this;
    }

    toJSON() {
        return {
            type: ModalComponentTypes.CHECKBOX,
            custom_id: this.custom_id,
            default: this.default
        };
    };

    toString() {
        return JSON.stringify(this.toJSON(), null, 2);
    };
}

export { ModalBuilder, LabelBuilder, TextInputBuilder, FileUploadBuilder, RadioGroupBuilder, CheckboxGroupBuilder, CheckboxBuilder };