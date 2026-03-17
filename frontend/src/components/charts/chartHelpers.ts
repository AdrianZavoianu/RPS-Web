export const STORY_AXIS_TOP_PADDING = 0.2

export function getStoryAxisRange(storyCount: number): [number, number] {
  if (storyCount <= 0) return [0, STORY_AXIS_TOP_PADDING]
  return [
    0,
    storyCount - 1 + STORY_AXIS_TOP_PADDING,
  ]
}
