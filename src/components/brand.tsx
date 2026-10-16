import Link from "next/link";

export function BrandMark({size = 48, className = ""}: {size?: number;className?: string}) {
  return (
    <svg className={className} role="img" aria-label="ZoKivo mascot logo" width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 24C15 17 21 12 27 13L30 6C32 2 37 2 40 6L47 13C63 9 72 20 70 37L70 51C70 68 58 76 40 76C22 76 10 65 10 49V37C10 31 12 27 16 24Z" fill="#FFCE4B" stroke="#1C1C32" strokeWidth="5.5" strokeLinejoin="round"/>
      <path d="M26 35L34 40L26 45M54 35L46 40L54 45" stroke="#1C1C32" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M32 56C37 61 45 61 50 55" stroke="#1C1C32" strokeWidth="4.5" strokeLinecap="round"/>
      <circle cx="19" cy="54" r="4.5" fill="#FF829D"/><circle cx="62" cy="54" r="4.5" fill="#FF829D"/>
      <path d="M63 8L65 3L67 8L72 10L67 12L65 17L63 12L58 10Z" fill="#8C67FF"/>
    </svg>
  );
}
export function Brand({inverse = false}: {inverse?: boolean}) {
  return <Link href="/" className={"brand "+(inverse?"brand--inverse":"")} aria-label="ZoKivo home"><BrandMark size={51}/><span className="brand-name">Zo<span>Kivo</span><span className="brand-bang">!</span></span></Link>;
}
