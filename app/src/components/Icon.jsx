import React from 'react'

const PATHS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5a1 1 0 001 1H9v-6h6v6h2.5a1 1 0 001-1V10"/>',
  box: '<path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z"/><path d="M3 8.5V16l9 4.5 9-4.5V8.5"/><path d="M12 13v7.5"/>',
  layers: '<path d="M9 5a3 3 0 016 0"/><path d="M12 8v3"/><path d="M4 20l6-6.5c.6-.6 1.4-1 2-1s1.4.4 2 1L20 20"/><path d="M4 20h16"/>',
  swap: '<path d="M4 8h13"/><path d="M14 4l3 4-3 4"/><path d="M20 16H7"/><path d="M10 12l-3 4 3 4"/>',
  users: '<circle cx="8.5" cy="9" r="3"/><circle cx="16" cy="10" r="2.4"/><path d="M2.7 19c.7-3 2.9-5 5.8-5s5.1 2 5.8 5"/><path d="M14.4 15.2c2.3.3 4 2.1 4.6 3.8"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  store: '<path d="M4 9.5 5.2 4h13.6L20 9.5"/><path d="M4.5 9.5h15v10h-15z"/><path d="M9.5 19.5V14h5v5.5"/>',
  bell: '<path d="M6 8a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M9.5 20a2.5 2.5 0 005 0"/>',
  chart: '<path d="M4 20V10"/><path d="M11 20V4"/><path d="M18 20v-7"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  arrowRight: '<path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>',
  tag: '<path d="M12 3h6a2 2 0 012 2v6a2 2 0 01-.6 1.4l-9 9a2 2 0 01-2.8 0l-5-5a2 2 0 010-2.8l9-9A2 2 0 0112 3Z"/><circle cx="16.5" cy="7.5" r="1.4" fill="currentColor" stroke="none"/>',
  printer: '<path d="M6 9V4h12v5"/><rect x="4" y="9" width="16" height="7" rx="1.5"/><path d="M7 14h10v6H7z"/><path d="M8 12h.01"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 20h16"/>',
  x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 014.8 1c0 1.7-2.3 1.9-2.3 3.5"/><circle cx="12" cy="17" r="0.1" fill="currentColor" stroke="none"/>',
}

export default function Icon({ name, size = 18, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      dangerouslySetInnerHTML={{ __html: PATHS[name] || '' }}
    />
  )
}
