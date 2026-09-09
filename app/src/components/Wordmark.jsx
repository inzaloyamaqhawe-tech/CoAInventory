import React from 'react'
import logoBlack from '../assets/logo-mark.png'
import logoWhite from '../assets/logo-mark-white.png'

// The real brand mark — wings and the "CHIEFS OF ANGELS" wordmark together,
// cropped tight from the source logo, background stripped to transparent.
// `variant="white"` for a dark surface (the sign-in hero), plain/black for
// everything on the app's light surfaces (the nav header).
export default function Wordmark({ height = 28, variant = 'black', decorative = false }) {
  return (
    <img
      src={variant === 'white' ? logoWhite : logoBlack}
      alt={decorative ? '' : 'Chiefs of Angels'}
      style={{ height, width: 'auto', display: 'block' }}
    />
  )
}
