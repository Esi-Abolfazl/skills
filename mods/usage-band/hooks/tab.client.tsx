// One segment of a Models card filter. A Button on the desktop surface ignores the style of its
// Text (only its hover differs), so the segment is a Client that draws its own fill.
import type { ClientSurface } from 'claude-code'

type Props = { row: 'period' | 'source'; id: string; label: string; active: boolean }
type State = { hover?: boolean }

export default function Tab(props: Props, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements
  surface.onPointer(e => {
    if (e.type === 'up' && e.button === 'left') surface.post({ pick: { row: props.row, id: props.id } })
    const hover = e.type === 'leave' ? false : e.type === 'enter' || e.type === 'move' ? true : surface.state?.hover
    if (hover !== surface.state?.hover) surface.setState({ hover })
  })
  const on = props.active
  return (
    <Box width="100%" justifyContent="center" backgroundColor={on ? 'suggestion' : surface.state?.hover ? 'subtle' : undefined}>
      <Text bold={on} color={on ? 'inverseText' : undefined} dimColor={!on && !surface.state?.hover} wrap="truncate">
        {props.label}
      </Text>
    </Box>
  )
}
