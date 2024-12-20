import type { TokenOrDoc } from '../extensions';
import type { AnimationPayload } from '../schema/payload.ts';
// import type { ExecutableAnimation } from '../storage/AnimCore.ts';
import { ErrorMsg, warn } from '../utils.ts';
import { executeAnimation } from './animation.ts';
import { executeCrosshair } from './crosshair.ts';
import { executeGraphic } from './graphic.ts';
import { executeSound } from './sound.ts';

export interface GameData {
	sources: TokenOrDoc[];
	targets?: (TokenOrDoc | string | Point | MeasuredTemplateDocumentPF2e)[];
	// animations: ExecutableAnimation[];
	// queue: Sequence[];
	currentIndex: number;
	item?: ItemPF2e<any>;
	user?: string;
}

/**
 * A safe wrapper around a decoded payload, so that other code knows how to handle the returned sequence or supporting Sequencer data.
 *
 * The following `type`s are possible:
 * - `'sequence'`: a sequence (`new Sequence()`) that can be `.play()`ed or merged with `.addSequence()`
 * - `'namedLocation'`: a named location returned by a crosshair (since named locations can't be merged with `.addSequence()`)
 * - `'null'`: a blank return that indicates no action should be taken (occurs when animations are played by other users)
 */
type DecodedPayload =
	| { type: 'sequence'; data: Sequence }
	| { type: 'namedLocation'; data: { name: string; position: Vector2 } }
	| { type: 'null' };

/**
 * The top-level payload-decoding function. A payload goes in with the current game data (i.e. execution context), and an appropriate comes out.
 *
 * This should probably either be `.play()`ed immediately or merged with another sequence using `.addSequence()`. Named locations must be directly registered with `.addNamedLocation()`, since you cannot `.addSequence()` a named location.
 */
export async function decodePayload(payload: AnimationPayload, data: GameData): Promise<DecodedPayload> {
	if (!payload) throw ErrorMsg.send(`Payload missing—your data may be corrupted.`);

	const context = prepareExecutionContext(data);

	if (payload.type === 'graphic') return { type: 'sequence', data: executeGraphic(payload, context) };
	if (payload.type === 'sound') return { type: 'sequence', data: executeSound(payload, context) };
	if (payload.type === 'crosshair')
		return { type: 'namedLocation', data: await executeCrosshair(payload, context) };
	if (payload.type === 'animation') {
		if (game.userId === data.user) return { type: 'sequence', data: await executeAnimation(payload, context) };
		return { type: 'null' };
	}
	if (payload.type === 'macro') {
		return {
			type: 'sequence',
			data: new Sequence().macro(payload.document, { ...context, ...payload.options }),
		};
	}

	throw ErrorMsg.send(
		`Failed to execute payload with unrecognised type \`${(payload as any).type.toString()}\`!`,
	);
}

/**
 * A convenience interface that describes the context in which an animation is being triggered.
 * - `sources`: the source tokens
 * - `targets`: the target tokens
 * - `templates`: any attached templates
 * - `user`: the triggering user
 * - `currentIndex`: in a set of multiple payloads, this is the currently decoding index (starting from zero)
 */
export interface ExecutionContext {
	sources: TokenOrDoc[];
	targets: TokenOrDoc[];
	templates: MeasuredTemplateDocumentPF2e[];
	user?: string;
	currentIndex: number;
}

/**
 * Converts `GameData` to `ExecutionContext`, notably by splitting out the former's `targets` to targetted tokens and templates.
 */
function prepareExecutionContext(data: GameData): ExecutionContext {
	return {
		sources: data.sources ?? [],
		targets: (data.targets ?? []).filter(target => target instanceof TokenDocument),
		templates: (data.targets ?? []).filter(target => target instanceof MeasuredTemplateDocumentPF2e),
		user: data.user,
		currentIndex: data.currentIndex,
	};
}

export function addCustomExecutionContext(
	sources: string[] = [],
	targets: string[] = [],
	data: ExecutionContext,
): ExecutionContext {
	sources.forEach(async (uuid) => {
		const doc = await fromUuid(uuid);
		if (doc instanceof TokenDocument) {
			data.sources.push(doc);
		} else {
			warn(`Could not find custom source token \`${uuid}\`.`);
		}
	});
	targets.forEach(async (uuid) => {
		const doc = await fromUuid(uuid);
		if (doc instanceof TokenDocument) {
			data.targets.push(doc);
		} else {
			warn(`Could not find custom target token \`${uuid}\`.`);
		}
	});
	return data;
}

// TODO: be smart enough to select a particular element in the `data.<...>` array (e.g. for ranged bounce)
/**
 * Converts a schema-compliant position to something Sequencer can actually handle. Notably, this means:
 * - Converting implicit (0-default) X-Y coordinates to an explicit coordinate-object;
 * - Correctly identifying the appropriate token for `SOURCES`, `TARGETS`, and `TEMPLATES` (depending on `context`);
 * - Leaving named locations (e.g. from crosshairs) untouched.
 * @param position The target position.
 * @param context The execution context.
 * @returns Something that can go into Sequencer's positional methods, such as effects' `.atLocation()` and animations' `teleportTo()`.
 */
export function positionToArgument(
	position: string | Partial<Vector2>,
	context: ExecutionContext,
): string | Vector2 | TokenPF2e | MeasuredTemplateDocumentPF2e {
	if (typeof position === 'object') return offsetToVector2(position);

	if (position === 'SOURCES') return context.sources[0];
	if (position === 'TARGETS') return context.targets[0];
	if (position === 'TEMPLATES') return context.templates[0];

	if (typeof position === 'string') return position;

	throw new ErrorMsg(`Could not resolve position \`${position}\`.`);
}

// TODO: convert this to a prompt for the GM to accept when permissions fail
export async function verifyPermissions(actor: Actor): Promise<boolean> {
	return actor.permission === 3;
}

/**
 * Converts the ubiquitous `offset` schema (`{x?: number, y?: number}` with default values of 0) into the Sequencer-desired full form, where both properties are necessarily defined.
 * @param offset The object as permitted by the schema
 * @returns A `Vector2` object satisfying `{x: number, y: number}`.
 */
export function offsetToVector2(offset: Partial<Vector2> | undefined): Vector2 {
	return {
		x: offset?.x ?? 0,
		y: offset?.y ?? 0,
	};
}

// #region Old effect data being temporarily preserved for Spappz's reference
//
// 	if (isTrueish(payload.zIndex)) seq.zIndex(payload.zIndex);
// 	if (isTrueish(payload.randomRotation)) seq.randomRotation(payload.randomRotation);
// 	if (isTrueish(payload.spriteOffset))
// 		seq.spriteOffset(offsetToVector2(payload.spriteOffset.offset), payload.spriteOffset);
// 	if (isTrueish(payload.spriteRotation)) seq.spriteRotation(payload.spriteRotation);
// 	if (isTrueish(payload.waitUntilFinished)) seq.waitUntilFinished(payload.waitUntilFinished);
// 	if (isTrueish(payload.missed)) seq.missed(payload.missed);
// 	if (isTrueish(payload.rotation)) seq.rotate(payload.rotation);
// 	if (isTrueish(payload.belowTokens)) seq.belowTokens(payload.belowTokens);
// 	if (isTrueish(payload.randomizeMirrorX)) seq.randomizeMirrorX(payload.randomizeMirrorX);
// 	if (isTrueish(payload.randomizeMirrorY)) seq.randomizeMirrorY(payload.randomizeMirrorY);
// 	if (isTrueish(payload.mirrorX)) seq.mirrorX(payload.mirrorX);
// 	if (isTrueish(payload.mirrorY)) seq.mirrorY(payload.mirrorY);
// 	if (isTrueish(payload.template)) seq.template(payload.template);
// 	if (isTrueish(payload.scaleIn)) seq.scaleIn(payload.scaleIn.scale, payload.scaleIn.duration, payload.scaleIn);
// 	if (isTrueish(payload.scaleOut))
// 		seq.scaleOut(payload.scaleOut.scale, payload.scaleOut.duration, payload.scaleOut);
// 	if (isTrueish(payload.anchor)) seq.anchor(payload.anchor);
// 	if (isTrueish(payload.opacity)) seq.opacity(payload.opacity);
// 	if (isTrueish(payload.mask)) seq.mask();
// 	if (isTrueish(payload.repeats)) {
// 		if (typeof payload.repeats === 'object') {
// 			seq.repeats(payload.repeats.count, payload.repeats.delayMin, payload.repeats.delayMax);
// 		} else {
// 			seq.repeats(payload.repeats);
// 		}
// 	}
// 	if (isTrueish(payload.scale)) {
// 		if (typeof payload.scale === 'object') {
// 			seq.scale(payload.scale.min, payload.scale.max);
// 		} else {
// 			seq.scale(payload.scale);
// 		}
// 	}
// 	if (isTrueish(payload.scaleToObject)) {
// 		if (typeof payload.scaleToObject === 'object') {
// 			seq.scaleToObject(payload.scaleToObject.value, payload.scaleToObject);
// 		} else {
// 			seq.scaleToObject(payload.scaleToObject);
// 		}
// 	}
// 	if (isTrueish(payload.size)) {
// 		if (typeof payload.size === 'object') {
// 			// @ts-expect-error TODO: Fix in Sequencer types
// 			seq.size(payload.size.value, payload.size);
// 		} else {
// 			seq.size(payload.size);
// 		}
// 	}
// 	if (isTrueish(payload.persist)) {
// 		if (typeof payload.persist === 'object') {
// 			// @ts-expect-error TODO: Fix in Sequencer types
// 			seq.persist(payload.persist?.value || false, payload.persist);
// 		} else {
// 			seq.persist(payload.persist || false);
// 		}
// 	}
// 	if (isTrueish(payload.tieToDocuments)) {
// 		if (!data.item) {
// 			log('tieToDocuments was called with no item present!');
// 		} else {
// 			seq.tieToDocuments([data.item]);
// 		}
// 	}
// 	if (isTrueish(payload.remove)) {
// 		[payload.remove].flat().forEach((origin) => {
// 			if (origin === 'all') {
// 				Sequencer.EffectManager.endEffects({ object: data.targets });
// 			}
// 			Sequencer.EffectManager.endEffects({ origin, object: data.targets });
// 		});
// 	}
// 	if (data.item) {
// 		seq.origin(data.item);
// 		seq.name(data.item.name);
// 	}
// 	if (isTrueish(payload.id)) seq.origin(payload.id);
// 	if (isTrueish(payload.name)) seq.name(payload.name);

// export function parseOffsetInSitu<T extends { offset?: Partial<Vector2>; gridUnits?: boolean }>(
// 	obj: T,
// ): T & { offset: Vector2 & { gridUnits?: boolean } } {
// 	return {
// 		...obj,
// 		offset: {
// 			...obj.offset,
// 			x: obj?.offset?.x ?? 0,
// 			y: obj?.offset?.y ?? 0,
// 		},
// 	};
// }
// #endregion

/**
 * Converts schema values that can be either a single number or a range of numbers into something Sequencer can read (with a spread operator). For instance, Sequencer's `.delay()` effect method takes either a single number or two arguments (the former being the minimum and the latter the maximum).
 */
export function parseMinMaxObject(value: number | { min: number; max: number }): [number, number?] {
	if (typeof value === 'number') return [value];
	return [value.min, value.max];
}