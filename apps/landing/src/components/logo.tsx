export default function Logo({className}: {className?: string}) {
    return (
        <div className={className}>
        <svg width="100%" height="100%" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" >
            <g transform="rotate(-12 32 32)">
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none" />
                <rect x="18" y="26" width="6" height="12" rx="3" fill="currentColor" />
                <rect x="26" y="20" width="6" height="24" rx="3" fill="currentColor" />
                <rect x="34" y="20" width="6" height="24" rx="3" fill="currentColor" />
                <rect x="42" y="26" width="6" height="12" rx="3" fill="currentColor" />
            </g>
        </svg>
        </div>
    );
}