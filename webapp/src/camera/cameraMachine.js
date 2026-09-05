// Pure state machine for the constellation camera — no R3F/Three imports,
// so it's testable in plain jsdom. See spec §5 "small state machine".
export const INITIAL_CAMERA_STATE = { mode: 'idle', targetId: null, region: 'news' }

export function cameraReducer(state, action) {
  switch (action.type) {
    case 'FOCUS':
      if (state.mode !== 'idle') return state
      return { ...state, mode: 'focused', targetId: action.id }

    case 'OPEN_READER':
      if (state.mode !== 'focused') return state
      return { ...state, mode: 'reader-open' }

    case 'CLOSE_READER':
      if (state.mode !== 'reader-open' && state.mode !== 'focused') return state
      return { ...state, mode: 'idle', targetId: null }

    case 'BLUR':
      if (state.mode !== 'focused') return state
      return { ...state, mode: 'idle', targetId: null }

    case 'SWITCH_REGION':
      return { mode: 'region-transition', targetId: null, region: action.region }

    case 'REGION_ARRIVED':
      if (state.mode !== 'region-transition') return state
      return { ...state, mode: 'idle' }

    default:
      return state
  }
}
