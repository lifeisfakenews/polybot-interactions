import * as types from "../types";

export default {
    custom_id: "b_example",
    type: types.ExportedComponentTypes.BUTTON,
    async execute(client, interaction) {
    
        await interaction.reply({ content: "Example button" });
    }
} as types.ExportedComponent;
