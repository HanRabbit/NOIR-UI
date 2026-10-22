import React from 'react';

/* Minimal stroke icons so the library carries no icon dependency */
const Svg=({size=16, children, strokeWidth=1.75, ...rest})=>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>{children}</svg>;

export const IconCheck=(p)=><Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5"/></Svg>;
export const IconX=(p)=><Svg {...p}><path d="M6 6l12 12M18 6L6 18"/></Svg>;
export const IconChevron=(p)=><Svg {...p}><path d="M6 9l6 6 6-6"/></Svg>;
export const IconChevronRight=(p)=><Svg {...p}><path d="M9 6l6 6-6 6"/></Svg>;
export const IconSearch=(p)=><Svg {...p}><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></Svg>;
export const IconSun=(p)=><Svg {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/></Svg>;
export const IconMoon=(p)=><Svg {...p}><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/></Svg>;
export const IconAlert=(p)=><Svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></Svg>;
export const IconInfo=(p)=><Svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/></Svg>;
export const IconArrowRight=(p)=><Svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Svg>;
export const IconCorner=(p)=><Svg {...p}><path d="M9 10l-5 5 5 5"/><path d="M20 4v7a4 4 0 01-4 4H4"/></Svg>;
