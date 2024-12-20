import { z } from 'zod';
import { angle, filePath, hexColour, ID } from '../helpers/atoms';
import { nonEmpty, nonZero } from '../helpers/refinements';

/**
 * Zod schema for the shared template properties.
 */
const baseTemplate = z
	.object({
		size: z
			.object({
				default: z.number().positive().describe('The initial size of the template.'),
				min: z
					.number()
					.positive()
					.optional()
					.describe('The minimum size of the template, if a range is permitted.'),
				max: z
					.number()
					.positive()
					.optional()
					.describe('The maximum size of the template, if a range is permitted.'),
			})
			.strict()
			.refine(obj => obj.max === obj.min, '`max` and `min` must be defined together.')
			.refine(obj => (obj.max ?? Infinity) > (obj.min ?? 0), '`max` must be greater than `min`.')
			.describe(
				'Sets the length for `RAY` and `RECTANGLE` templates, or the radius for `CIRCLE` and `CONE` templates.',
			),
		// TODO: is there a way to cause persistance with `Sequencer.Crosshair.show()`?
		// persist: z
		// 	.literal(true)
		// 	.optional()
		// 	.describe('Causes the placed template to persist (that is, be actually placed on the scene).'),
	})
	.strict();

/**
 * Zod schema for the options specific to a `crosshair`-preset animation.
 */
export const crosshairOptions = z
	.object({
		name: ID.describe(
			'Identifies the crosshair\'s selected position so that it can be used elsewhere (for instance, in the `atLocation` property of another animation).',
		),
		label: z
			.object({
				text: z.string().min(1).describe('The text to display.'),
				dx: z
					.number()
					.refine(...nonZero)
					.optional()
					.describe('The text\'s offset along the x-axis, in pixels.'),
				dy: z
					.number()
					.refine(...nonZero)
					.optional()
					.describe('The text\'s offset along the y-axis, in pixels.'),
			})
			.optional()
			.describe(
				'You can set some text to attach to the crosshair while it\'s being positioned. This is a purely visual effect.',
			),
		icon: z
			.object({
				texture: filePath.describe('The filepath to the icon\'s image.'),
				borderVisible: z.literal(true).optional().describe('Draws a border around the icon.'),
			})
			.strict()
			.refine(...nonEmpty)
			.optional()
			.describe('Sets a custom icon the crosshair.'),
		template: z
			.discriminatedUnion('type', [
				baseTemplate
					.extend({
						type: z.enum(['CIRCLE', 'RECTANGLE']).describe('The shape of the crosshair\'s template.'),
					})
					.strict(),
				baseTemplate
					.extend({
						type: z.literal('CONE').describe('The shape of the crosshair\'s template.'),
						angle: z
							.number()
							.positive()
							.lt(360)
							.optional()
							.describe('Sets the template\'s angular width (default: 90°).'),
						direction: angle
							.optional()
							.describe('Sets the template\'s initial orientation (default: 0°, rightwards).'),
					})
					.strict(),
				baseTemplate
					.extend({
						type: z.literal('RAY').describe('The shape of the crosshair\'s template.'),
						width: z
							.number()
							.positive()
							.multipleOf(5)
							.optional()
							.describe(
								'Sets the template\'s width, in grid units (default: the scene\'s grid distance—typically 5 feet).',
							),
						direction: angle
							.optional()
							.describe('Sets the template\'s initial orientation (default: 0°, rightwards).'),
					})
					.strict(),
			])
			.optional()
			.describe('Configures a template to attach to the crosshair (default: ephemeral, 1 × 1 square).'),
		snap: z
			.object({
				position: z
					.array(
						z.enum([
							'BOTTOM_LEFT_CORNER',
							'BOTTOM_LEFT_VERTEX',
							'BOTTOM_RIGHT_CORNER',
							'BOTTOM_RIGHT_VERTEX',
							'BOTTOM_SIDE_MIDPOINT',
							'CENTER',
							'CORNER',
							'EDGE_MIDPOINT',
							'LEFT_SIDE_MIDPOINT',
							'RIGHT_SIDE_MIDPOINT',
							'SIDE_MIDPOINT',
							'TOP_LEFT_CORNER',
							'TOP_LEFT_VERTEX',
							'TOP_RIGHT_CORNER',
							'TOP_RIGHT_VERTEX',
							'TOP_SIDE_MIDPOINT',
							'VERTEX',
						]),
					)
					.refine(
						arr => arr.length !== 1 || arr[0] !== 'CENTER',
						'`["CENTER"]` is the default value and doesn\'t require definition.',
					)
					.optional()
					.describe(
						'Forces the crosshair to snap to specific points on the grid (default: `["CENTER"]`). Leave the array empty (`[]`) to disable grid-snapping.\nFor Pathfinder 2e, you\'ll probably want one or more of `CENTER`, `SIDE_MIDPOINT`, and `VERTEX` (for instance, cones are typically `["SIDE_MIDPOINT", "VERTEX"]`).',
					),
				direction: z
					.number()
					.int()
					.gte(2)
					.lte(8)
					.optional()
					.describe(
						'For a non-circular template crosshair, this forces the template\'s orientation to snap to specific angles. The number determines how many angles are allowed (for example, `4` would force snapping to up, down, left, and right only).',
					),
			})
			.refine(...nonEmpty)
			.optional()
			.describe('Configures custom snapping behaviour. By default, the crosshair snaps to spaces\' centres.'),
		lockDrag: z
			.literal(true)
			.optional()
			.describe('Prevents the crosshair\'s final position from being dragged.'),
		lockManualRotation: z
			.literal(true)
			.optional()
			.describe('Prevents the crosshair from being manually rotated.'),
		noGridHighlight: z
			.literal(true)
			.optional()
			.describe('Prevents the crosshair\'s template from highlighting of the grid.'),
		location: z
			.object({
				limitRange: z
					.object({
						min: z
							.number()
							.positive()
							.optional()
							.describe(
								'The minimum distance to the placeable, in grid units (typically feet), that the crosshair can be placed.',
							),
						max: z
							.number()
							.positive()
							.optional()
							.describe(
								'The maximum distance to the placeable, in grid units (typically feet), that the crosshair can be placed.',
							),
						fill: z
							.object({
								color: hexColour.optional().describe('The fill colour (default: #66aa66).'),
								alpha: z
									.number()
									.gt(0)
									.lt(1)
									.optional()
									.describe('The transparency of the \'s fill colour (default: 0.25).'),
							})
							.strict()
							.refine(...nonEmpty)
							.optional()
							.describe(
								'Fills the valid crosshair-placement area with a particular colour (default: #66aa66, 25% opacity).',
							),
						line: z
							.object({
								color: hexColour.optional().describe('The colour of the line (default: #228822).'),
								alpha: z
									.number()
									.gt(0)
									.lt(1)
									.optional()
									.describe('The transparency of the \'s fill colour (default: 0.5).'),
							})
							.strict()
							.refine(...nonEmpty)
							.optional()
							.describe(
								'Draws an outline around the valid crosshair-placement area (default: #228822, 50% opacity).',
							),
						invisible: z
							.literal(true)
							.describe('Prevents the range limits from being visible.')
							.optional(),
					})
					.strict()
					.refine(
						obj => obj.min || obj.max,
						'`limitRange` requires at least one of the `limitRange.min` and `limitRange.max` properties.',
					)
					.refine(
						obj => (obj.min ?? 0) <= (obj.max ?? Infinity),
						'`min` must be smaller than `max`, or equal to it.',
					)
					.refine(
						obj => obj.invisible || !(obj.fill || obj.line),
						'`fill` and `line` are redundant when `invisible` is enabled.',
					)
					.optional()
					.describe('Impose limits on where the crosshair may be placed.'),
				hideRangeTooltip: z
					.literal(true)
					.optional()
					.describe(
						'During the crosshair\'s placement, its current range is shown by default next to the cursor. You can disable that with this option.\nThis option is automatically disabled if `lockToEdge` is enabled.',
					),
				lockToEdge: z
					.literal(true)
					.optional()
					.describe(
						'Locks the crosshair to the edge of the placeable (useful for lines and cones without a range, such as *lightning bolt* and *cone of cold*).',
					),
				lockToEdgeDirection: z
					.literal(true)
					.optional()
					.describe(
						'If the crosshair is locked to the placeable\'s edge (`lockToEdge`), then this also forces an attached `CONE` or `RAY` template to be oriented away from that placeable.',
					),
				offset: z
					.object({
						x: z
							.number()
							.refine(...nonZero)
							.optional(),
						y: z
							.number()
							.refine(...nonZero)
							.optional(),
					})
					.strict()
					.refine(...nonEmpty)
					.optional()
					.describe(
						'Allows you to offset the crosshair\'s recorded position from its placed location (values in pixels).',
					),
				wallBehavior: z
					.enum(['LINE_OF_SIGHT', 'NO_COLLIDABLES'])
					.optional()
					.describe(
						'Defines how the crosshair should interact with walls (default: `ANYWHERE`, no interaction).\n`LINE_OF_SIGHT`: the crosshair\'s position must be visible from the placeable.\n`NO_COLLIDABLES`: the line between the placeable and the crosshair\'s position must pass through no movement-blocking walls (i.e. line-of-effect).',
					),
			})
			.strict()
			.refine(...nonEmpty)
			.refine(
				obj => obj.lockToEdge || !obj.lockToEdgeDirection,
				'`lockToEdgeDirection` requires `lockToEdge`.',
			)
			.refine(obj => !obj.lockToEdge || !obj.limitRange, '`limitRange` is incompatible with `lockToEdge`.')
			.refine(
				obj => !obj.hideRangeTooltip || !obj.lockToEdge,
				'`hideRangeTooltip` is redundant if `lockToEdge` is enabled.',
			)
			.optional()
			.describe(
				'Configures the permissible area in which the crosshair can be placed, with respect to an anchoring placeable (typically an actor\'s token).',
			),
		borderColor: hexColour.optional().describe('Sets the border colour of the crosshair.'),
		fillColor: hexColour.optional().describe('Sets the fill colour of the crosshair.'),
	})
	.strict()
	// refinements are applied to `animationPayload` in `src/schema/animation.ts` due to a Zod limitation
	.describe('The options specific to a `crosshair`-preset animation.');