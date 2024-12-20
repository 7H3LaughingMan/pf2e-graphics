import { z } from 'zod';
import { nonZero, uniqueItems } from './refinements';

/**
 * Zod schema for any possible value that can be encoded in JSON.
 */
export const JSONValue = z
	.union([z.string(), z.number(), z.boolean(), z.object({}), z.null(), z.undefined()])
	.describe('Any possible value that can be encoded in JSON.');

/**
 * An animation's 'ID' is an almost-unique string to allow other options to reference it. This is notably important for `generic` animations, as well as animations that `remove` others.
 */
export const ID = z
	.string()
	.regex(
		/^[a-z0-9][\w!?&()'.,:;\-]{4,}[a-z0-9!?)]$/i,
		'Animation IDs should be easily readable and reasonably unique.',
	)
	.refine(
		str =>
			![
				'SOURCE',
				'SOURCES', // *
				'TARGET',
				'TARGETS', // *
				'TEMPLATE',
				'TEMPLATES', // *
			].includes(str),
		'This name is reserved.',
		// * Technically only these NEED to be reserved, but better safe than sorry when it comes to internally meaningful strings imo
	)
	.describe(
		'An animation\'s name serves as its \'ID\': an almost-unique, case-sensitive string to allow other options to reference it. This is notably important for named locations (set by crosshairs), `generic` animations, and payloads that `remove` others. It must unique across *all* named animations that might be executed in your world, so make sure it\'s reasonably distinguished!',
	);

/**
 * Zod schema for a Foundry document's UUID.
 */
export const UUID = z
	.string()
	.regex(
		/^(?:Scene\.[a-zA-Z0-9]{16}\.|Compendium\.[\w-]+\.[\w-]+\.)?(?:Token|Actor|Item|MeasuredTemplate|AmbientLight|ActiveEffect)\.[a-zA-Z0-9]{16}$/,
		'Must be a valid UUID.',
	)
	.describe('A Foundry document\'s UUID.');

/**
 * Zod schema for a Foundry item's slug for the pf2e system.
 */
export const slug = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'String must be a valid slug.')
	.describe('A Foundry item\'s slug for the pf2e system.');

/**
 * Zod schema for a roll option in the pf2e system.
 */
export const rollOption = z
	.string()
	.regex(
		/^[a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9]+(?:-[a-z0-9]+)*)*(?::-?\d+)?$/,
		'String must be a valid roll option.',
	)
	.describe('A roll option in the pf2e system.');

/**
 * Zod schema for a hexadecimal colour, represented as a string (leading hash).
 */
export const hexColour = z
	.string()
	.regex(/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i, 'String must be a valid hexadecimal colour-code.')
	.describe('A hexadecimal colour, represented as a string (leading hash).');

/**
 * Zod schema for an angle in degrees. The value is normalised from -180° < x <= 180°, with a value of 0° being disallowed as the default.
 */
export const angle = z
	.number()
	.gt(-180)
	.lte(180)
	.refine(...nonZero)
	.describe(
		'An angle in degrees. The value is normalised from -180° < x <= 180°, with a value of 0° being disallowed as the default.',
	);

/**
 * Zod schema for a filepath (cross-platform-safe) to a meaningful animation file (extension required).
 */
export const filePath = z
	.string()
	.regex(
		/^\w[^":<>?\\|/]+(?:\/[^":<>?\\|/]+)+\.\w\w\w\w?$/,
		'String must be a valid filepath. The following characters are unsafe for cross-platform filesystems: ":<>?\\|',
	)
	.describe('A filepath (cross-platform-safe) to a meaningful animation file (extension required).');

/**
 * Zod schema for a Sequencer database entry.
 */
export const sequencerDBEntry = z
	.string()
	.regex(/^\w[\w-]+(?:\.(?:[\w-]+|\{\w+(?:,[^{},]+)+\}))+$/, 'String must be a valid Sequencer database entry.');

/**
 * Zod schema for an easing function (c.f. [easings.net](https://easings.net)).
 */
export const easing = z
	.enum([
		'easeInBack',
		'easeInBounce',
		'easeInCirc',
		'easeInCubic',
		'easeInElastic',
		'easeInExpo',
		'easeInOutBack',
		'easeInOutBounce',
		'easeInOutCirc',
		'easeInOutCubic',
		'easeInOutElastic',
		'easeInOutExpo',
		'easeInOutQuad',
		'easeInOutQuart',
		'easeInOutQuint',
		'easeInOutSine',
		'easeInQuad',
		'easeInQuart',
		'easeInQuint',
		'easeInSine',
		'easeOutBack',
		'easeOutBounce',
		'easeOutCirc',
		'easeOutCubic',
		'easeOutElastic',
		'easeOutExpo',
		'easeOutQuad',
		'easeOutQuart',
		'easeOutQuint',
		'easeOutSine',
	])
	.describe(
		'An easing function for non-linear transitions.\nSee [easings.net](https://easings.net) for more information.',
	);

/**
 * A single predicate (recursive) for the pf2e system.
 */
export type Predicate =
	| string
	| { eq: [string, string | number] }
	| { gt: [string, string | number] }
	| { gte: [string, string | number] }
	| { lt: [string, string | number] }
	| { lte: [string, string | number] }
	| { and: Predicate[] }
	| { or: Predicate[] }
	| { xor: Predicate[] }
	| { not: Predicate }
	| { nand: Predicate[] }
	| { nor: Predicate[] }
	| { if: Predicate; then: Predicate }
	| { iff: Predicate[] };

/**
 * Zod schema for a single predicate (recursive) for the pf2e system.
 */
export const predicate: z.ZodType<Predicate> = z
	.union([
		rollOption,
		z.object({ eq: z.tuple([rollOption, rollOption.or(z.number())]) }).strict(),
		z.object({ gt: z.tuple([rollOption, rollOption.or(z.number())]) }).strict(),
		z.object({ gte: z.tuple([rollOption, rollOption.or(z.number())]) }).strict(),
		z.object({ lt: z.tuple([rollOption, rollOption.or(z.number())]) }).strict(),
		z.object({ lte: z.tuple([rollOption, rollOption.or(z.number())]) }).strict(),
		z
			.object({
				and: z.lazy(() =>
					z
						.array(predicate)
						.min(1)
						.refine(...uniqueItems),
				),
			})
			.strict(),
		z
			.object({
				or: z.lazy(() =>
					z
						.array(predicate)
						.min(1)
						.refine(...uniqueItems),
				),
			})
			.strict(),
		z
			.object({
				xor: z.lazy(() =>
					z
						.array(predicate)
						.min(1)
						.refine(...uniqueItems),
				),
			})
			.strict(),
		z.object({ not: z.lazy(() => predicate) }).strict(),
		z
			.object({
				nand: z.lazy(() =>
					z
						.array(predicate)
						.min(1)
						.refine(...uniqueItems),
				),
			})
			.strict(),
		z
			.object({
				nor: z.lazy(() =>
					z
						.array(predicate)
						.min(1)
						.refine(...uniqueItems),
				),
			})
			.strict(),
		z.object({ if: z.lazy(() => predicate), then: z.lazy(() => predicate) }).strict(),
		z
			.object({
				iff: z.lazy(() =>
					z
						.array(predicate)
						.min(1)
						.refine(...uniqueItems),
				),
			})
			.strict(),
	])
	.describe('A single predicate (recursive) for the pf2e system.');
