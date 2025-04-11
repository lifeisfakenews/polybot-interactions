import { CommandBuilder, Interaction, Client } from "./utils";


/**
 * 			FRAMEWORK TYPES
 */

export type ExportedCommand = {
    visible?: boolean;
    staff_only?: boolean;
    command: CommandBuilder;
    execute: (client: Client, interaction: Interaction) => Promise<void>;
    autocomplete?: (client: Client, interaction: Interaction) => Promise<void>;
}
export type ExportedComponent = {
    custom_id: string;
    type: ExportedComponentTypes;
    staff_only?: boolean;
    execute: (client: Client, interaction: Interaction) => Promise<void>;
}
export enum ExportedComponentTypes {
    "BUTTON" = 1,
    "STRING_SELECT" = 2,
    "ROLE_SELECT" = 3,
    "USER_SELECT" = 4,
    "CHANNEL_SELECT" = 5,
}

/**
 * 			DISCORD TYPES
 */
export type Guild = {
    id: string;
    name: string;
    icon: string;
	icon_hash?: string | null;
	splash: string | null;
	discovery_splash: string | null;
	owner?: boolean;
    owner_id: string;
    permissions?: string;
	region?: string | null;
	afk_channel_id?: string;
	afk_timeout: number;
	widget_enabled?: boolean;
	widget_channel_id?: string | null;
	verification_level: number;
	default_message_notifications: number;
	explicit_content_filter: number;
	roles: GuildRole[];
	emojis: GuildEmoji[];
	features: GuildFeatures[];
	mfa_level: number;
	application_id: string | null;
	system_channel_id: string | null;
    system_channel_flags: number;
	rules_channel_id: string | null;
    max_presences?: number | null;
	max_members?: number;
	vanity_url_code?: string;
	description: string | null;
	banner: string | null;
	premium_tier: number;
	premium_subscription_count?: number;
	preferred_locale: string;
	public_updates_channel_id: string | null;
	max_video_channel_users?: number;
	max_stage_video_channel_users?: number;
	approximate_member_count?: number;
	approximate_presence_count?: number;
	welcome_screen?: GuildWelcomeScreen;
	nsfw_level: number;
	stickers?: Sticker[];
	premium_progress_bar_enabled: boolean;
	safety_alerts_channel_id: string | null;
	incidents_data: GuildIncidentsData | null;
}
export type GuildMember = {
    user: User;
	nick?: string;
	avatar?: string;
	banner?: string;
	roles: string[];
	joined_at: string;
	premium_since?: string;
	deaf: boolean;
	mute: boolean;
	pending?: boolean;
	permissions?: string;
	communication_disabled_until?: string;
	avatar_decoration_data?: UserAvatarDecorationData | null;
}
export enum GuildFeatures {
    "ANIMATED_BANNER" = "ANIMATED_BANNER",
    "ANIMATED_ICON" = "ANIMATED_ICON",
    "APPLICATION_COMMAND_PERMISSIONS_V2" = "APPLICATION_COMMAND_PERMISSIONS_V2",
    "AUTO_MODERATION" = "AUTO_MODERATION",
    "BANNER" = "BANNER",
    "COMMUNITY" = "COMMUNITY",
    "CREATOR_MONETIZABLE_PROVISIONAL" = "CREATOR_MONETIZABLE_PROVISIONAL",
    "CREATOR_STORE_PAGE" = "CREATOR_STORE_PAGE",
    "DEVELOPER_SUPPORT_SERVER" = "DEVELOPER_SUPPORT_SERVER",
    "DISCOVERABLE" = "DISCOVERABLE",
    "FEATURABLE" = "FEATURABLE",
    "INVITES_DISABLED" = "INVITES_DISABLED",
    "INVITE_SPLASH" = "INVITE_SPLASH",
    "MEMBER_VERIFICATION_GATE_ENABLED" = "MEMBER_VERIFICATION_GATE_ENABLED",
    "MORE_STICKERS" = "MORE_STICKERS",
    "NEWS" = "NEWS",
    "PARTNERED" = "PARTNERED",
    "PREVIEW_ENABLED" = "PREVIEW_ENABLED",
    "RAID_ALERTS_DISABLED" = "RAID_ALERTS_DISABLED",
    "ROLE_ICONS" = "ROLE_ICONS",
    "ROLE_SUBSCRIPTIONS_AVAILABLE_FOR_PURCHASE" = "ROLE_SUBSCRIPTIONS_AVAILABLE_FOR_PURCHASE",
    "ROLE_SUBSCRIPTIONS_ENABLED" = "ROLE_SUBSCRIPTIONS_ENABLED",
    "TICKETED_EVENTS_ENABLED" = "TICKETED_EVENTS_ENABLED",
    "VANITY_URL" = "VANITY_URL",
    "VERIFIED" = "VERIFIED",
    "VIP_REGIONS" = "VIP_REGIONS",
    "WELCOME_SCREEN_ENABLED" = "WELCOME_SCREEN_ENABLED",
}
export type GuildRole = {
    id: string;
    name: string;
    color: number;
    hex_color?: string;
    hoist: boolean;
    icon_url?: string;
    unicode_emoji?: string;
    position: number;
    permissions: number;
    managed: boolean;
    mentionable: boolean;
    tags?: GuildRoleTags;
    flags: GuildRoleFlags[];
}
export type GuildRoleTags = {
    bot_id?: string;
    integration_id?: string;
    premium_subscriber?: null;
    subscription_listing_id?: string;
    available_for_purchase?: null;
    guild_connections?: null;
}
export enum GuildRoleFlags {
    "IN_PROMPT" = "IN_PROMPT"
}
export type GuildEmoji = {
    id: string;
    name: string;
    roles: string[];
    user?: User;
    require_colons?: boolean;
    managed?: boolean;
    animated?: boolean;
    available?: boolean;
}
export type GuildWelcomeScreen = {
    description: string | null;
    welcome_channels: GuildWelcomeScreenChannel[];
}
export type GuildWelcomeScreenChannel = {
    channel_id: string;
    description: string;
    emoji_id: string | null;
    emoji_name: string | null;
}
export type GuildIncidentsData = {
	invites_disabled_until: string | null;
	dms_disabled_until: string | null;
	dm_spam_detected_at: string | null;
	raid_detected_at: string | null;
}

export type Channel = {
    id: string;
    type: ChannelTypes;
    guild_id: string;
    position: number;
    permission_overwrites: ChannelOverwrite[];
    name: string;
    topic?: string;
    nsfw: boolean;
    last_message_id?: string;
    /**
     * @requires type = 2 | 13
     */
    bitrate?: number;
    /**
     * @requires type = 2 | 13
     */
    user_limit?: number;
    rate_limit_per_user?: number;
    /**
     * @requires type = 10 | 11 | 12
     */
    owner_id?: string;
    parent_id?: string;
    last_pin_timestamp?: string;
    /**
     * @requires type = 2 | 13
     */
    rtc_region?: string;
    /**
     * @requires type = 2 | 13
     */
    video_quality_mode?: number;
    /**
     * @requires type = 10 | 11 | 12
     */
    message_count?: number;
    /**
     * @requires type = 10 | 11 | 12
     */
    member_count?: number;
    /**
     * @requires type = 10 | 11 | 12
    */
    thread_metadata?: {
       archived: boolean;
       auto_archive_duration: number;
       archive_timestamp: string;
       locked: boolean;
       invitable?: boolean;
    };
    default_auto_archive_duration?: number;
    permissions?: string;
    flags?: number;
    /**
     * @requires type = 10 | 11 | 12
     */
    total_message_sent?: number;
    /**
     * @requires type = 15 | 19
     */
    available_tags?: ChannelTag[];
    /**
     * @requires type = 15 | 19
     */
    applied_tags?: string[];
    /**
     * @requires type = 15 | 19
     */
    default_reaction_emoji?: ChannelDefaultReaction;
    default_thread_rate_limit_per_user?: number;
    /**
     * @requires type = 15 |19
     */
    default_sort_order?: number;
    /**
     * @requires type = 15
     */
    default_forum_layout?: number;
}
export type ChannelOverwrite = {
    id: string;
    type: ChannelOverwriteTypes;
    allow: string | number;
    deny: string | number;
}
export enum ChannelOverwriteTypes {
    "ROLE" = 0,
    "MEMBER" = 1,
}
export enum ChannelTypes {
    "GUILD_TEXT" = 0,
    "DM" = 1,
    "GUILD_VOICE" = 2,
    "GROUP_DM" = 3,
    "GUILD_CATEGORY" = 4,
    "GUILD_ANNOUNCEMENT" = 5,
    "ANNOUNCEMENT_THREAD" = 10,
    "PUBLIC_THREAD" = 11,
    "PRIVATE_THREAD" = 12,
    "GUILD_STAGE_VOICE" = 13,
    "GUILD_DIRECTORY" = 14,
    "GUILD_FORUM" = 15,
    "GUILD_MEDIA" = 19,

}
export type ChannelTag = {
    id: string;
    name: string;
    moderated: boolean;
    emoji_id: string | null;
    emoji_name: string | null;
}
export type ChannelDefaultReaction = {
    emoji_id: string | null;
    emoji_name: string | null;
}

export type Message = {
    id: string;
    channel_id: string;
    author: User;
    content: string;
    timestamp: string;
    edited_timestamp: string | null;
    tts: boolean;
    mention_everyone: boolean;
    mentions: User[];
    mention_roles: string[];
    mention_channels: MessageChannelMention[];
    attachments: MessageAttachment[];
    embeds: MessageEmbed[];
    reactions: MessageReaction[];
    nonce?: string | null;
    pinned: boolean;
    webhook_id?: string;
    type: number;
    activity?: MessageActivity;
    application_id?: string;
    message_reference?: MessageReference;
    flags?: MessageFlags;
    referenced_message?: Message | null;
    interaction?: MessageInteractionMetadata;
    thread?: Channel;
    components?: MessageComponent[];
    sticker_items?: StickerItem[];
    stickers?: Sticker[];
    position?: number;
    role_subscription_data?: MessageRoleSubscriptionData;
    resolved?: MessageResolved;
    poll?: Poll;
    call?: MessageCall;
}
export enum MessageTypes {
    "DEFAULT" = 0,
    "RECIPIENT_ADD" = 1,
    "RECIPIENT_REMOVE" = 2,
    "CALL" = 3,
    "CHANNEL_NAME_CHANGE" = 4,
    "CHANNEL_ICON_CHANGE" = 5,
    "CHANNEL_PINNED_MESSAGE" = 6,
    "GUILD_MEMBER_JOIN" = 7,
    "USER_PREMIUM_GUILD_SUBSCRIPTION" = 8,
    "USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_1" = 9,
    "USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_2" = 10,
    "USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_3" = 11,
    "CHANNEL_FOLLOW_ADD" = 12,
    "GUILD_DISCOVERY_DISQUALIFIED" = 14,
    "GUILD_DISCOVERY_REQUALIFIED" = 15,
    "GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING" = 16,
    "GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING" = 17,
    "THREAD_CREATED" = 18,
    "REPLY" = 19,
    "CHAT_INPUT_COMMAND" = 20,
    "THREAD_STARTER_MESSAGE" = 21,
    "GUILD_INVITE_REMINDER" = 22,
    "CONTEXT_MENU_COMMAND" = 23,
    "AUTO_MODERATION_ACTION" = 24,
    "ROLE_SUBSCRIPTION_PURCHASE" = 25,
    "INTERACTION_PREMIUM_UPSELL" = 26,
    "STAGE_START" = 27,
    "STAGE_END" = 28,
    "STAGE_SPEAKER" = 29,
    "STAGE_TOPIC" = 31,
    "GUILD_APPLICATION_PREMIUM_SUBSCRIPTION" = 32,
    "GUILD_INCIDENT_ALERT_MODE_ENABLED" = 36,
    "GUILD_INCIDENT_ALERT_MODE_DISABLED" = 37,
    "GUILD_INCIDENT_REPORT_RAID" = 38,
    "GUILD_INCIDENT_REPORT_FALSE_ALARAM" = 39,
    "PURCHASE_NOTIFICATION" = 44,
    "POLL_RESULT" = 46,

}
export enum MessageComponentTypes {
    "ACTION_ROW" = 1,
    "BUTTON" = 2,
    "STRING_SELECT" = 3,
    "TEXT_INPUT" = 4,
    "USER_SELECT" = 5,
    "ROLE_SELECT" = 6,
    "MENTIONABLE_SELECT" = 7,
    "CHANNEL_SELECT" = 8,
}
export type MessageComponent = {
    type: MessageComponentTypes.ACTION_ROW;
    components: MessageComponentActionRow[];
}
export type MessageComponentActionRow = MessageComponentButton | MessageComponentSelect;

export type MessageComponentEmoji = {
	id?: string;
	name?: string;
	animated?: boolean;
}

export type MessageComponentButton = (MessageComponentButtonWithCustomId | MessageComponentButtonWithURL) & {
    type: MessageComponentTypes.BUTTON,
    label?: string;
	style: MessageComponentButtonStyles;
	emoji?: MessageComponentEmoji;
	disabled?: boolean;
}
export type MessageComponentButtonWithCustomId = {
    style: MessageComponentButtonStyles.PRIMARY | MessageComponentButtonStyles.SECONDARY | MessageComponentButtonStyles.SUCCESS | MessageComponentButtonStyles.DANGER;
	custom_id: string;
}
export type MessageComponentButtonWithURL = {
    style: MessageComponentButtonStyles.LINK;
	url: string;
}
export enum MessageComponentButtonStyles {
	PRIMARY = 1,
	SECONDARY,
	SUCCESS,
	DANGER,
	LINK,
}
export type MessageComponentSelect = (MessageComponentStringSelect | MessageComponentAutoPopulatedSelect) & {
    type: MessageComponentTypes.STRING_SELECT | MessageComponentTypes.CHANNEL_SELECT | MessageComponentTypes.MENTIONABLE_SELECT | MessageComponentTypes.ROLE_SELECT | MessageComponentTypes.USER_SELECT;
    custom_id: string;
    placeholder?: string;
    min_values?: number;
    max_values?: number;
    disabled?: boolean;
}
export type MessageComponentAutoPopulatedSelect = MessageComponentChannelSelect | {
    type: MessageComponentTypes.MENTIONABLE_SELECT | MessageComponentTypes.ROLE_SELECT | MessageComponentTypes.USER_SELECT;
    default_values?: MessageComponentSelectDefaultValue[];
}
export type MessageComponentChannelSelect = {
    type: MessageComponentTypes.CHANNEL_SELECT;
    default_values?: MessageComponentSelectDefaultValue[];
    channel_types?: ChannelTypes[];
}
export type MessageComponentStringSelect = {
    type: MessageComponentTypes.STRING_SELECT;
    options: MessageComponentSelectOption[];
}
export type MessageComponentSelectOption = {
	label: string;
	value: string;
	description?: string;
	emoji?: MessageComponentEmoji;
	default?: boolean;
}
export type MessageComponentSelectDefaultValue = {
    type: MessageComponentSelectDefaultValueType;
    id: string;
}
export enum MessageComponentSelectDefaultValueType {
    "CHANNEL" = "channel",
    "ROLE" = "role",
    "USER" = "user",
}

export type MessageActivity = {
    type: MessageActivityTypes;
    party_id?: string;
}
export enum MessageActivityTypes {
    "JOIN" = 1,
    "SPECTATE" = 2,
    "LISTEN" = 3,
    "JOIN_REQUEST" = 5,
}
export enum MessageFlags {
    "CROSSPOSTED" = 1 << 0,
    "IS_CROSSPOST" = 1 << 1,
    "SUPPRESS_EMBEDS" = 1 << 2,
    "SOURCE_MESSAGE_DELETED" = 1 << 3,
    "URGENT" = 1 << 4,
    "HAS_THREAD" = 1 << 5,
    "EPHEMERAL" = 1 << 6,
    "LOADING" = 1 << 7,
    "FAILED_TO_MENTION_SOME_ROLES_IN_THREAD" = 1 << 8,
    "SUPRESS_NOTIFICATIONS" = 1 << 12,
    "IS_VOICE_MESSAGE" = 1 << 13,
    "HAS_SNAPSHOT" = 1 << 14,
}
export type MessageInteractionMetadata = (MessageComponentInteractionMetadata | MessageCommandInteractionMetadata | MessageModalSubmitInteractionMetadata) & {
    id: string;
    user: User;
    authorizing_integration_owners: MessageInteractionIntegrationOwners;
    original_response_mnessage_id?: string;
} 
export type MessageComponentInteractionMetadata = {
    type: MessageInteractionTypes.MESSAGE_COMPONENT;
    interacted_message_id: string;
}
export type MessageCommandInteractionMetadata = {
    type: MessageInteractionTypes.APPLICATION_COMMAND;
    target_message_id?: string;
    target_user?: User;
}
export type MessageModalSubmitInteractionMetadata = {
    type: MessageInteractionTypes.MODAL_SUBMIT;
    triggering_interaction_metadata: MessageComponentInteractionMetadata | MessageCommandInteractionMetadata;
}
export type MessageInteractionIntegrationOwners = {
    [T in MessageInteractionIntegrationOwnersTypes]: string
}
export enum MessageInteractionIntegrationOwnersTypes {
    "GUILD_INSTALL" = "0",
    "USER_INSTALL" = "1"
}
export enum MessageInteractionTypes {
    "PING" = 1,
    "APPLICATION_COMMAND" = 2,
    "MESSAGE_COMPONENT" = 3,
    "APPLICATION_COMMAND_AUTOCOMPLETE_RESULT" = 4,
    "MODAL_SUBMIT" = 5,
}
export type MessageCall = {
    participants: string[];
    ended_timestamp?: string | null;
}
export type MessageReference = {
    type: MessageReferenceTypes;
    message_id?: string;
    channel_id?: string;
    guild_id?: string;
    fail_if_not_exists?: boolean;
}
export enum MessageReferenceTypes {
    "DEFAULT" = 0,
    "FORWARD" = 1,
}
export type MessageReaction = {
    count: number;
    count_details: {
        burst: number;
        normal: number;
    };
    me: boolean;
    me_burst: boolean;
    emoji: Emoji;
    burst_colors: string[];
}
export type MessageEmbed = MessageEmbedPoll & {
    title?: string;
    type?: MessageEmbedTypes;
    description?: string;
    url?: string;
    timestamp?: string;
    color?: number;
    footer?: MessageEmbedFooter;
    image?: MessageEmbedImage;
    thumbnail?: MessageEmbedThumbnail;
    video?: MessageEmbedVideo;
    provider?: MessageEmbedProvider;
    author?: MessageEmbedAuthor;
    fields?: MessageEmbedField[];
}
export enum MessageEmbedTypes {
    "RICH" = "rich",
    "IMAGE" = "image",
    "VIDEO" = "video",
    "GIFV" = "gifv",
    "ARTICLE" = "article",
    "LINK" = "link",
    "POLL_RESULT" = "poll_result",
}
export type MessageEmbedFooter = {
    text: string;
    icon_url?: string;
}
export type MessageEmbedImage = {
    url: string;
}
export type MessageEmbedThumbnail = {
    url: string;
}
export type MessageEmbedVideo = {
    url: string;
}
export type MessageEmbedProvider = {
    name: string;
    url?: string;
}
export type MessageEmbedAuthor = {
    name: string;
    url?: string;
    icon_url?: string;
}
export type MessageEmbedField = {
    name: string;
    value: string;
    inline?: boolean;
}
export type MessageEmbedPoll = {
    type: MessageEmbedTypes.POLL_RESULT;
    poll_question_text: string;
    victor_answer_votes: number;
    total_votes: number;
    victor_answer_id?: string;
    victor_answer_text?: string;
    victor_answer_emoji_id?: string;
    victor_answer_emoji_name?: string;
    victor_answer_emoji_animated?: boolean;
}
export type MessageAttachment = {
    id: string;
    filename: string;
    title?: string;
    description?: string;
    content_type?: string;
    size: number;
    url: string;
    proxy_url: string;
    height?: number;
    width?: number;
    ephemeral?: boolean;
    duration_secs?: number;
    waveform?: string;
    flags?: MessageAttachmentFlags;
}
export enum MessageAttachmentFlags {
    "IS_REMIX" = 1 << 2.
}
export type MessageChannelMention = {
    id: string;
    guild_id: string;
    type: ChannelTypes;
    name: string;
}
export type MessageAllowedMentions = {
    parse?: string[];
    roles?: string[];
    users?: string[];
    replied_user?: boolean;
}
export type MessageRoleSubscriptionData = {
    role_subscription_listing_id: string;
    tier_name: string;
    total_months_subscribed: number;
    is_renewal: boolean;
}
export type MessageResolved = {
    users?: Map<string, User>;
    members?: Map<string, GuildMember>;
    roles?: Map<string, GuildRole>;
    channels?: Map<string, Channel>;
    messages?: Map<string, Message>;
    attachments?: Map<string, MessageAttachment>;
}

export type Emoji = {
    id: string | null;
    name: string | null;
    roles?: string[];
    user?: User;
    require_colons?: boolean;
    managed?: boolean;
    animated?: boolean;
    available?: boolean;
}

export type Poll = {
    question: PollMedia;
    answers: PollAnswer[];
    expiry: string | null;
    allow_multiselect: boolean;
    layout_type: PollLayoutType;
    results?: PollResults;
}
export enum PollLayoutType {
    "DEFAULT" = 1,
}
export type PollAnswer = {
    answer_id: string;
    poll_media: PollMedia;
}
export type PollMedia = {
    text: string;
    emoji?: Emoji;
}
export type PollResults = {
    is_finalized: boolean;
    answer_counts: PollAnswerCount[];
}
export type PollAnswerCount = {
    id: string;
    count: number;
    me_voted: boolean;
}

export type Sticker = {
	id: string;
	pack_id?: string;
	name: string;
	description: string | null;
	tags: string;
	asset: string;
	type: number;
	format_type: number;
	available: boolean;
	guild_id: string | null;
	user: User | null;
	sort_value: number;
}
export type StickerItem = {
    id: string;
    name: string;
    format_type: StickerFormatType;
}
export enum StickerFormatType {
	"PNG" = 1,
	"APNG" = 2,
	"LOTTIE" = 3,
    "GIF" = 4
}
export enum StickerType {
	"STANDARD" = 1,
	"GUILD" = 2,
}

export type User = {
	id: string;
	username: string;
	discriminator: string;
	global_name: string | null;
	avatar: string | null;
	bot?: boolean;
	system?: boolean;
	mfa_enabled?: boolean;
	banner?: string | null;
	accent_color?: number | null;
	locale?: string;
	verified?: boolean;
	email?: string | null;
	flags?: number;
	premium_type?: UserPremiumType;
	public_flags?: number;
	avatar_decoration_data?: UserAvatarDecorationData | null;
}
export type UserAvatarDecorationData = {
	asset: string;
	sku_id: string;
}
export enum UserFlags {
	"STAFF" = 1 << 0,
	"PARTNER" = 1 << 1,
	"HYPESQUAD" = 1 << 2,
	"BUG_HUNTER_LEVEL_1" = 1 << 3,
	"MFA_SMS" = 1 << 4,
	"PREMIUM_PROMO_DISMISSED" = 1 << 5,
	"HYPESQUAD_ONLINE_HOUSE_2" = 1 << 7,
	"HYPESQUAD_ONLINE_HOUSE_3" = 1 << 8,
	"PREMIUM_EARLY_SUPPORTER" = 1 << 9,
	"TEAM_PSEUDO_USER" = 1 << 10,
	"BUG_HUNTER_LEVEL_2" = 1 << 14,
	"VERIFIED_BOT" = 1 << 16,
	"VERIFIED_DEVELOPER" = 1 << 17,
	"CERTIFIED_MODERATOR" = 1 << 18,
	"BOT_HTTP_INTERACTIONS" = 1 << 19,
	"SPAMMER" = 1 << 20,
    "DISABLE_PREMIUM" = 1 << 21,
    "ACTIVE_DEVELOPER" = 1 << 22,
    "QUARANTINED" = 17_592_186_044_416,
    "COLLABORATOR" = 1_125_899_906_842_624,
    "RESTRICTED_COLLABORATOR" = 2_251_799_813_685_248,
}
export enum UserPremiumType {
	"NONE" = 0,
	"NITRO_CLASSIC" = 1,
	"NITRO" = 2,
	"NITRO_BASIC" = 3,
}

export enum Permissions {
    "CREATE_INSTANT_INVITE" = "CREATE_INSTANT_INVITE",
    "KICK_MEMBERS" = "KICK_MEMBERS",
    "BAN_MEMBERS" = "BAN_MEMBERS",
    "ADMINISTRATOR" = "ADMINISTRATOR",
    "MANAGE_CHANNELS" = "MANAGE_CHANNELS",
    "MANAGE_GUILD" = "MANAGE_GUILD",
    "ADD_REACTIONS" = "ADD_REACTIONS",
    "VIEW_AUDIT_LOG" = "VIEW_AUDIT_LOG",
    "PRIORITY_SPEAKER" = "PRIORITY_SPEAKER",
    "STREAM" = "STREAM",
    "VIEW_CHANNEL" = "VIEW_CHANNEL",
    "SEND_MESSAGES" = "SEND_MESSAGES",
    "SEND_TTS_MESSAGES" = "SEND_TTS_MESSAGES",
    "MANAGE_MESSAGES" = "MANAGE_MESSAGES",
    "EMBED_LINKS" = "EMBED_LINKS",
    "ATTACH_FILES" = "ATTACH_FILES",
    "READ_MESSAGE_HISTORY" = "READ_MESSAGE_HISTORY",
    "MENTION_EVERYONE" = "MENTION_EVERYONE",
    "USE_EXTERNAL_EMOJIS" = "USE_EXTERNAL_EMOJIS",
    "VIEW_GUILD_INSIGHTS" = "VIEW_GUILD_INSIGHTS",
    "CONNECT" = "CONNECT",
    "SPEAK" = "SPEAK",
    "MUTE_MEMBERS" = "MUTE_MEMBERS",
    "DEAFEN_MEMBERS" = "DEAFEN_MEMBERS",
    "MOVE_MEMBERS" = "MOVE_MEMBERS",
    "USE_VAD" = "USE_VAD",
    "CHANGE_NICKNAME" = "CHANGE_NICKNAME",
    "MANAGE_NICKNAMES" = "MANAGE_NICKNAMES",
    "MANAGE_ROLES" = "MANAGE_ROLES",
    "MANAGE_WEBHOOKS" = "MANAGE_WEBHOOKS",
    "MANAGE_GUILD_EXPRESSIONS" = "MANAGE_GUILD_EXPRESSIONS",
    "USE_APPLICATION_COMMANDS" = "USE_APPLICATION_COMMANDS",
    "REQUEST_TO_SPEAK" = "REQUEST_TO_SPEAK",
    "MANAGE_EVENTS" = "MANAGE_EVENTS",
    "MANAGE_THREADS" = "MANAGE_THREADS",
    "CREATE_PUBLIC_THREADS" = "CREATE_PUBLIC_THREADS",
    "CREATE_PRIVATE_THREADS" = "CREATE_PRIVATE_THREADS",
    "USE_EXTERNAL_STICKERS" = "USE_EXTERNAL_STICKERS",
    "SEND_MESSAGES_IN_THREADS" = "SEND_MESSAGES_IN_THREADS",
    "USE_EMBEDDED_ACTIVITIES" = "USE_EMBEDDED_ACTIVITIES",
    "MODERATE_MEMBERS" = "MODERATE_MEMBERS",
    "VIEW_CREATOR_MONETIZATION_ANALYTICS" = "VIEW_CREATOR_MONETIZATION_ANALYTICS",
    "USE_SOUNDBOARD" = "USE_SOUNDBOARD",
    "CREATE_GUILD_EXPRESSIONS" = "CREATE_GUILD_EXPRESSIONS",
    "CREATE_EVENTS" = "CREATE_EVENTS",
    "USE_EXTERNAL_SOUNDS" = "USE_EXTERNAL_SOUNDS",
    "SEND_VOICE_MESSAGES" = "SEND_VOICE_MESSAGES",
}
