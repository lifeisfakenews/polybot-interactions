import { Client } from "polybot-interactions";
import config from "./config";

const client = new Client(config);
client.init();

process.on("unhandledRejection", handleError);
process.on("uncaughtException", handleError);

function handleError(error:any) {
    console.log(error);
    client.log(`${error.message}\n\`\`\`${error.stack}\`\`\``, {footer: "true", type: "error"});
};