/**
 * Sentinels used in Select components where the value semantically means
 * "no segment chosen" or "all segments". Safe because real segment IDs are
 * short hex strings (from `secrets.token_hex(4)`) — they cannot start with
 * a double underscore.
 */
export const SEGMENT_NONE = '__none__'
export const SEGMENT_ALL = '__all__'
