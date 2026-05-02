import raw_slurs from "./slurs.json";
import raw_profane_strict from "./profane_strict.json";
import raw_profane_mild from "./profane_mild.json";
import raw_sexual_explicit from "./sexual_explicit.json";
import raw_sexual_mild from "./sexual_mild.json";

const char_map = {
    "4": "a",
    "@": "a",
    "3": "e",
    "1": "i",
    "!": "i",
    "0": "o",
    "$": "s",
    "5": "s",
    "7": "t"
} as Record<string, string>;

function normaliseText(input: string) {
    let text = input.toLowerCase();

    let replaced = "";
    for (const char of text) replaced += char_map[char] ?? char;

    text = replaced;
    text = text.replace(/[^a-z0-9\s]/g, "");
    text = text.replace(/(.)\1{2,}/g, "$1$1");
    text = text.replace(/\s+/g, " ").trim();

    return text;
};

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
};

function compileList(list: [string, boolean][]) {
    return list.map(entry => buildFuzzyPattern(entry[0], entry[1]));
};

function buildFuzzyPattern(word: string, whole_word_only: boolean) {
    if (whole_word_only && word.length <= 3) {
        return new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
    };

    const letters = word.split("").map(letter => {
        const escaped = escapeRegExp(letter);
        return `${escaped}+`;
    });

    const between = "[^a-z0-9]*";
    const pattern_body = letters.join(between);

    const full_pattern = whole_word_only ? `\\b${pattern_body}\\b` : pattern_body;
    return new RegExp(full_pattern, "gi");
};

function moderateTextAgainstList(input: string, list: RegExp[]) {
    let text = input;
    let is_profane = false;

    for (const pattern of list) {
        const replaced = text.replace(pattern, match => "*".repeat(match.length));
        if (replaced !== text) {
            is_profane = true;
            text = replaced;
        };
    };

    return {
        output: text,
        isProfane: is_profane,
    }
};

const slurs = compileList(raw_slurs as [string, boolean][]);
const profane_strict = compileList(raw_profane_strict as [string, boolean][]);
const profane_mild = compileList(raw_profane_mild as [string, boolean][]);
const sexual_explicit = compileList(raw_sexual_explicit as [string, boolean][]);
const sexual_mild = compileList(raw_sexual_mild as [string, boolean][]);

let custom_list: RegExp[] = [];

const default_lists = { "slurs": slurs, "sexual_explicit": sexual_explicit, "sexual_mild": sexual_mild, "profane_mild": profane_mild, "profane_strict": profane_strict } as const;

export function setCustomList(list: [string, boolean][]) {
    custom_list = compileList(list);
};

type WordListName = keyof typeof default_lists;

const default_enabled_word_lists: WordListName[] = ["slurs", "sexual_explicit", "sexual_mild", "profane_mild"];
const default_disabled_word_lists: WordListName[] = ["profane_strict"];

export function moderateTextBasic(text: string, { enabled_word_lists = default_enabled_word_lists, disabled_word_lists = default_disabled_word_lists }: { enabled_word_lists?: WordListName[], disabled_word_lists?: WordListName[] } = {}) {
    const lists = Object.fromEntries(enabled_word_lists.map(list_name => [list_name, default_lists[list_name]]));
    if (custom_list.length > 0) lists["custom"] = custom_list;

    for (const list_name of disabled_word_lists) {
        if (lists[list_name]) delete lists[list_name];
    };

    for (const list_name in enabled_word_lists) {
        /* @ts-ignore */
        if (!lists[list_name]) lists[list_name] = default_lists[list_name];
    };

    let output = normaliseText(text);
    let flags = [];
    for (const [list_name, list] of Object.entries(lists)) {
        const { output: output2, isProfane } = moderateTextAgainstList(output, list);
        if (isProfane) flags.push(list_name);
        output = output2;
    };
    
    return {
        input: text,
        output,
        isProfane: flags.length > 0,
        flags,
    };
};